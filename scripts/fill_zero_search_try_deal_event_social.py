"""
运行指南：
    请在项目根目录下以模块方式运行：
    python -m scripts.fill_zero_search_try_deal_event_social

输出说明：
    - 读取 data/search_try_deal_event_social 目录下的所有 csv 文件
    - 对 search_quantity、try_quantity、order_quantity 三个字段的空值填充为 0
    - 处理结果直接覆盖原 csv 文件
"""

from __future__ import annotations

import csv
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

ENCODING_CANDIDATES = ("utf-8-sig", "utf-8", "gb18030", "gbk")
TARGET_COLUMNS = ("search_quantity", "try_quantity", "order_quantity")
NULL_TOKENS = {"", r"\N"}
Row = dict[str, str]


@dataclass(frozen=True)
class FillZeroConfig:
    """Define the target directory and target columns for zero filling."""

    input_dir: Path
    target_columns: tuple[str, ...]


def build_default_config(project_root: Path) -> FillZeroConfig:
    """Build the default configuration for the fill-zero task."""
    return FillZeroConfig(
        input_dir=project_root / "data" / "search_try_deal_event_social",
        target_columns=TARGET_COLUMNS,
    )


def detect_csv_encoding(csv_path: Path) -> str:
    """Detect a readable encoding for the given CSV file."""
    raw_bytes = csv_path.read_bytes()
    for encoding in ENCODING_CANDIDATES:
        try:
            raw_bytes.decode(encoding)
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
    """Read CSV rows with normalized headers and cell values."""
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


def ensure_required_columns(fieldnames: Iterable[str], required_columns: Iterable[str]) -> None:
    """Ensure the CSV contains all required columns."""
    fieldname_set = set(fieldnames)
    missing_columns = [column for column in required_columns if column not in fieldname_set]
    if missing_columns:
        raise ValueError(f"CSV missing required columns: {missing_columns}")


def fill_empty_quantities(rows: Iterable[Row], target_columns: Iterable[str]) -> tuple[list[Row], int]:
    """Fill empty quantity fields with zero and return updated rows plus fill count."""
    updated_rows: list[Row] = []
    fill_count = 0
    for row in rows:
        updated_row = row.copy()
        for column_name in target_columns:
            if normalize_cell(updated_row.get(column_name)) == "":
                updated_row[column_name] = "0"
                fill_count += 1
        updated_rows.append(updated_row)
    return updated_rows, fill_count


def write_csv(csv_path: Path, fieldnames: list[str], rows: Iterable[Row], encoding: str) -> None:
    """Write rows back to the CSV file with the original field order."""
    with open(csv_path, "w", encoding=encoding, newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({fieldname: normalize_cell(row.get(fieldname)) for fieldname in fieldnames})


def process_csv_file(csv_path: Path, config: FillZeroConfig) -> None:
    """Process one CSV file and overwrite it after filling empty quantities."""
    encoding = detect_csv_encoding(csv_path)
    fieldnames, rows = read_csv_rows(csv_path, encoding=encoding)
    ensure_required_columns(fieldnames, config.target_columns)
    updated_rows, fill_count = fill_empty_quantities(rows, config.target_columns)
    write_csv(csv_path, fieldnames, updated_rows, encoding)
    logger.info("Processed %s, filled %s empty cells.", csv_path.name, fill_count)


def iter_csv_files(input_dir: Path) -> list[Path]:
    """Collect all CSV files under the target directory."""
    return sorted(path for path in input_dir.iterdir() if path.is_file() and path.suffix.lower() == ".csv")


def process_all_csv_files(config: FillZeroConfig) -> None:
    """Process all target CSV files in the configured directory."""
    if not config.input_dir.exists():
        raise FileNotFoundError(f"Input directory does not exist: {config.input_dir}")

    csv_files = iter_csv_files(config.input_dir)
    if not csv_files:
        logger.warning("No csv files found under %s", config.input_dir)
        return

    logger.info("Found %s csv files under %s", len(csv_files), config.input_dir)
    for csv_path in csv_files:
        process_csv_file(csv_path, config)


def main() -> None:
    """Run the fill-zero task with the default project configuration."""
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    config = build_default_config(project_root)
    process_all_csv_files(config)


if __name__ == "__main__":
    main()
