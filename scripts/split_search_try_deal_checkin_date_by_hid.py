"""
运行指南：
    请在项目根目录下以模块方式运行：
    python -m scripts.split_search_try_deal_checkin_date_by_hid

输出说明：
    - 读取 data/search_try_deal_checkin_date.csv
    - 按 hid 拆分并输出到 data/search_try_deal_checkin_date_by_hid/{hid}.csv
    - 每个 hid 文件按 checkin_date 升序排序
    - 针对 2026-04-22 至 2026-06-22 的缺失 checkin_date 自动补齐记录
      （search_quantity、try_quantity、order_quantity 填充为空）
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

ENCODING_CANDIDATES = ("utf-8-sig", "utf-8", "gb18030", "gbk")
NULL_TOKENS = {"", r"\N"}
Row = dict[str, str]


@dataclass(frozen=True)
class SplitConfig:
    """Define input, output, and column settings for CSV splitting."""

    input_csv: Path
    output_dir: Path
    date_start: date
    date_end: date
    group_column_candidates: tuple[str, ...]
    checkin_date_column: str
    fill_empty_columns: tuple[str, ...]


def build_default_config(project_root: Path) -> SplitConfig:
    """Build the default configuration for the checkin_date split task."""
    return SplitConfig(
        input_csv=project_root / "data" / "search_try_deal_checkin_date.csv",
        output_dir=project_root / "data" / "search_try_deal_checkin_date_by_hid",
        date_start=date(2026, 4, 22),
        date_end=date(2026, 6, 22),
        group_column_candidates=("hid", "id"),
        checkin_date_column="checkin_date",
        fill_empty_columns=("search_quantity", "try_quantity", "order_quantity"),
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


def parse_checkin_date(value: str, column_name: str) -> date:
    """Parse checkin_date from common formats such as YYYY/M/D, YYYY-MM-DD, YYYYMMDD."""
    normalized = normalize_cell(value)
    if not normalized:
        raise ValueError(f"Empty date in column: {column_name}")

    s = normalized.strip().strip('"').strip("'")
    s = s.replace("\\", "/").replace("-", "/")
    if " " in s:
        s = s.split(" ", 1)[0]

    digits_only = re.fullmatch(r"\d{8}", s)
    if digits_only:
        try:
            return datetime.strptime(s, "%Y%m%d").date()
        except ValueError as exc:
            raise ValueError(f"Invalid date '{value}' in column '{column_name}'") from exc

    parts = s.split("/")
    if len(parts) == 3 and all(p.isdigit() for p in parts):
        y, m, d = (int(parts[0]), int(parts[1]), int(parts[2]))
        try:
            return date(y, m, d)
        except ValueError as exc:
            raise ValueError(f"Invalid date '{value}' in column '{column_name}'") from exc

    try:
        return datetime.fromisoformat(s).date()
    except ValueError as exc:
        raise ValueError(f"Invalid date '{value}' in column '{column_name}'") from exc


def format_checkin_date(value: date) -> str:
    """Format checkin_date as YYYY/M/D to match the source file style."""
    return f"{value.year}/{value.month}/{value.day}"


def iterate_dates(start_date: date, end_date: date) -> Iterable[date]:
    """Yield all dates in the inclusive range."""
    current = start_date
    while current <= end_date:
        yield current
        current += timedelta(days=1)


def split_rows_by_group(rows: Iterable[Row], group_column: str) -> dict[str, list[Row]]:
    """Group rows by the given group column."""
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
    """Sort one group's rows by checkin_date and add missing dates in the configured range."""
    dated_rows: list[tuple[date, Row]] = []
    skipped_rows = 0
    for row in rows:
        try:
            d = parse_checkin_date(row.get(config.checkin_date_column, ""), config.checkin_date_column)
        except ValueError:
            skipped_rows += 1
            continue
        dated_rows.append((d, row))

    if skipped_rows:
        group_value = normalize_cell(rows[0].get(group_column))
        logger.warning("Skipped %s malformed rows for %s=%s.", skipped_rows, group_column, group_value)

    dated_rows.sort(key=lambda item: item[0])
    if not dated_rows:
        return []

    sample_row = dated_rows[0][1]
    existing_dates = {d for d, _ in dated_rows}
    filled_rows = [row.copy() for _, row in dated_rows]
    template = build_fill_template(fieldnames, sample_row, group_column)

    for missing_date in iterate_dates(config.date_start, config.date_end):
        if missing_date in existing_dates:
            continue
        filled_row = template.copy()
        filled_row[config.checkin_date_column] = format_checkin_date(missing_date)
        for column_name in config.fill_empty_columns:
            if column_name in filled_row:
                filled_row[column_name] = ""
        filled_rows.append(filled_row)

    filled_rows.sort(
        key=lambda row: parse_checkin_date(row.get(config.checkin_date_column, ""), config.checkin_date_column)
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
        [group_column, config.checkin_date_column, *config.fill_empty_columns],
    )

    grouped_rows = split_rows_by_group(rows, group_column)
    logger.info("Resolved group column: %s", group_column)
    logger.info("Found %s unique %s values.", len(grouped_rows), group_column)

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

