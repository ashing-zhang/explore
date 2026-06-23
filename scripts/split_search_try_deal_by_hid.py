"""
运行指南：
    请在项目根目录下以模块方式运行：
    python -m scripts.split_search_try_deal_by_hid

输出说明：
    - 读取 data/search_try_deal.csv
    - 输出 data/search_try_deal_by_hid/unique_hids.csv
    - 输出 data/search_try_deal_by_hid/{hid}.csv
    - 每个 hid 文件按预定日期升序排序
    - 针对 20260422 至 20260622 的缺失日期自动补齐空记录
"""

from __future__ import annotations

import csv
import logging
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

NULL_TOKENS = {"", r"\N"}
ENCODING_CANDIDATES = ("utf-8-sig", "utf-8", "gb18030", "gbk")
Row = dict[str, str]


@dataclass(frozen=True)
class SplitConfig:
    """Define input, output, and column settings for CSV splitting."""

    input_csv: Path
    output_dir: Path
    date_start: date
    date_end: date
    group_column_candidates: tuple[str, ...]
    booking_date_column: str
    fill_empty_columns: tuple[str, ...]


def build_default_config(project_root: Path) -> SplitConfig:
    """Build the default configuration for the split task."""
    return SplitConfig(
        input_csv=project_root / "data" / "search_try_deal.csv",
        output_dir=project_root / "data" / "search_try_deal_by_hid",
        date_start=date(2026, 4, 22),
        date_end=date(2026, 6, 22),
        group_column_candidates=("hid", "id"),
        booking_date_column="预定日期",
        fill_empty_columns=("查价数", "试单数", "订单数"),
    )


def detect_csv_encoding(csv_path: Path) -> str:
    """Detect a readable CSV encoding from common candidates."""
    raw_bytes = csv_path.read_bytes()
    for encoding in ENCODING_CANDIDATES:
        try:
            raw_bytes.decode(encoding)
            logger.info("Detected csv encoding: %s", encoding)
            return encoding
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Unable to detect encoding for csv: {csv_path}")


def normalize_header(value: str | None) -> str:
    """Normalize a CSV header to a stripped string."""
    return (value or "").strip()


def normalize_cell(value: str | None) -> str:
    """Normalize a CSV cell and convert null-like markers to empty strings."""
    normalized = (value or "").strip()
    return "" if normalized in NULL_TOKENS else normalized


def read_csv_rows(csv_path: Path, encoding: str) -> tuple[list[str], list[Row]]:
    """Read CSV rows and normalize both headers and cell values."""
    with open(csv_path, "r", encoding=encoding, newline="") as file:
        reader = csv.DictReader(file)
        if not reader.fieldnames:
            raise ValueError(f"CSV has no headers: {csv_path}")

        fieldnames = [normalize_header(name) for name in reader.fieldnames]
        rows: list[Row] = []
        for raw_row in reader:
            row: Row = {}
            for raw_key, raw_value in raw_row.items():
                row[normalize_header(raw_key)] = normalize_cell(raw_value)
            rows.append(row)
    return fieldnames, rows


def resolve_group_column(fieldnames: Iterable[str], candidates: tuple[str, ...]) -> str:
    """Resolve the group column from candidate names."""
    fieldname_set = set(fieldnames)
    for candidate in candidates:
        if candidate in fieldname_set:
            return candidate
    raise ValueError(f"CSV missing group column, expected one of: {candidates}")


def ensure_required_columns(fieldnames: Iterable[str], required_columns: Iterable[str]) -> None:
    """Ensure all required columns exist in the CSV header."""
    fieldname_set = set(fieldnames)
    missing_columns = [column for column in required_columns if column not in fieldname_set]
    if missing_columns:
        raise ValueError(f"CSV missing required columns: {missing_columns}")


def parse_booking_date(value: str, column_name: str) -> date:
    """Parse a booking date from YYYYMMDD format."""
    normalized = normalize_cell(value)
    if not normalized:
        raise ValueError(f"Empty booking date in column: {column_name}")
    try:
        return datetime.strptime(normalized, "%Y%m%d").date()
    except ValueError as exc:
        raise ValueError(f"Invalid booking date '{value}' in column '{column_name}'") from exc


def format_booking_date(value: date) -> str:
    """Format a booking date as YYYYMMDD."""
    return value.strftime("%Y%m%d")


def iterate_dates(start_date: date, end_date: date) -> Iterable[date]:
    """Yield all dates in the inclusive range."""
    current = start_date
    while current <= end_date:
        yield current
        current += timedelta(days=1)


def split_rows_by_group(rows: Iterable[Row], group_column: str) -> dict[str, list[Row]]:
    """Group rows by the configured group column."""
    grouped_rows: dict[str, list[Row]] = {}
    skipped_rows = 0
    for row in rows:
        group_value = normalize_cell(row.get(group_column))
        if not group_value:
            skipped_rows += 1
            continue
        grouped_rows.setdefault(group_value, []).append(row)

    if skipped_rows:
        logger.warning("Skipped %s rows because '%s' is empty.", skipped_rows, group_column)
    return grouped_rows


def build_fill_template(fieldnames: list[str], sample_row: Row, group_column: str) -> Row:
    """Build a template row used for missing-date backfilling."""
    template = {fieldname: "" for fieldname in fieldnames}
    for fieldname in fieldnames:
        template[fieldname] = normalize_cell(sample_row.get(fieldname))
    template[group_column] = normalize_cell(sample_row.get(group_column))
    return template


def sort_and_fill_group_rows(
    rows: list[Row],
    fieldnames: list[str],
    config: SplitConfig,
    group_column: str,
) -> list[Row]:
    """Sort one group's rows by date and add missing dates in the configured range."""
    dated_rows: list[tuple[date, Row]] = []
    skipped_rows = 0
    for row in rows:
        try:
            booking_date = parse_booking_date(row.get(config.booking_date_column, ""), config.booking_date_column)
        except ValueError:
            skipped_rows += 1
            continue
        dated_rows.append((booking_date, row))

    if skipped_rows:
        group_value = normalize_cell(rows[0].get(group_column))
        logger.warning("Skipped %s malformed rows for %s=%s.", skipped_rows, group_column, group_value)

    dated_rows.sort(key=lambda item: item[0])
    if not dated_rows:
        return []

    sample_row = dated_rows[0][1]
    existing_dates = {booking_date for booking_date, _ in dated_rows}
    filled_rows = [row.copy() for _, row in dated_rows]
    template = build_fill_template(fieldnames, sample_row, group_column)

    for missing_date in iterate_dates(config.date_start, config.date_end):
        if missing_date in existing_dates:
            continue
        filled_row = template.copy()
        filled_row[config.booking_date_column] = format_booking_date(missing_date)
        for column_name in config.fill_empty_columns:
            if column_name in filled_row:
                filled_row[column_name] = ""
        filled_rows.append(filled_row)

    filled_rows.sort(
        key=lambda row: (
            parse_booking_date(row.get(config.booking_date_column, ""), config.booking_date_column),
            0 if normalize_cell(row.get("查价数")) else 1,
        )
    )
    return filled_rows


def build_safe_file_name(value: str) -> str:
    """Build a filesystem-safe file name from a group value."""
    safe_value = re.sub(r'[<>:"/\\|?*]+', "_", value.strip())
    return safe_value or "unknown"


def write_csv(csv_path: Path, fieldnames: list[str], rows: Iterable[Row], encoding: str) -> None:
    """Write rows to a CSV file with the given field order."""
    with open(csv_path, "w", encoding=encoding, newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({fieldname: normalize_cell(row.get(fieldname)) for fieldname in fieldnames})


def write_unique_groups(output_dir: Path, group_column: str, group_values: Iterable[str], encoding: str) -> None:
    """Write the unique group values to a CSV file."""
    unique_csv_path = output_dir / f"unique_{group_column}s.csv"
    rows = [{group_column: group_value} for group_value in sorted(set(group_values))]
    write_csv(unique_csv_path, [group_column], rows, encoding)
    logger.info("Saved unique group list: %s", unique_csv_path)


def process_split_task(config: SplitConfig) -> None:
    """Run the full split, sort, and fill workflow."""
    if not config.input_csv.exists():
        raise FileNotFoundError(f"Input CSV does not exist: {config.input_csv}")

    config.output_dir.mkdir(parents=True, exist_ok=True)
    encoding = detect_csv_encoding(config.input_csv)
    fieldnames, rows = read_csv_rows(config.input_csv, encoding=encoding)

    group_column = resolve_group_column(fieldnames, config.group_column_candidates)
    ensure_required_columns(
        fieldnames,
        [group_column, config.booking_date_column, *config.fill_empty_columns],
    )

    grouped_rows = split_rows_by_group(rows, group_column)
    logger.info("Resolved group column: %s", group_column)
    logger.info("Found %s unique %s values.", len(grouped_rows), group_column)
    write_unique_groups(config.output_dir, group_column, grouped_rows.keys(), encoding)

    for group_value, group_rows in sorted(grouped_rows.items()):
        output_path = config.output_dir / f"{build_safe_file_name(group_value)}.csv"
        final_rows = sort_and_fill_group_rows(group_rows, fieldnames, config, group_column)
        write_csv(output_path, fieldnames, final_rows, encoding)
        logger.info("Saved %s rows for %s=%s -> %s", len(final_rows), group_column, group_value, output_path)


def main() -> None:
    """Run the CSV split script with the default project configuration."""
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    config = build_default_config(project_root)
    process_split_task(config)


if __name__ == "__main__":
    main()
