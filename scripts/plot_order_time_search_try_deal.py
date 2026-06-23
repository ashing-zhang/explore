"""
运行指南：
    请在项目根目录下以模块方式运行：
    python -m scripts.plot_order_time_search_try_deal

输出说明：
    - 读取 data/search_try_deal_event_social 目录下的所有 csv 文件
    - 针对每个 csv 绘制 booking_date-quantity 折线图
    - 每张图包含 search_quantity、try_quantity、order_quantity 三条折线
    - 输出到 data/order_time_search_try_deal_plots/{csv_stem}.png
"""

from __future__ import annotations

import csv
import logging
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Iterable


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

ENCODING_CANDIDATES = ("utf-8-sig", "utf-8", "gb18030", "gbk")
NULL_TOKENS = {"", r"\N"}
DATE_COLUMN = "booking_date"
LINE_COLUMNS = ("search_quantity", "try_quantity", "order_quantity")
Row = dict[str, str]


@dataclass(frozen=True)
class PlotConfig:
    """Define the input directory, output directory, and plotting columns."""

    input_dir: Path
    output_dir: Path
    date_column: str
    line_columns: tuple[str, ...]


def build_default_config(project_root: Path) -> PlotConfig:
    """Build the default configuration for the plotting task."""
    return PlotConfig(
        input_dir=project_root / "data" / "search_try_deal_event_social",
        output_dir=project_root / "data" / "order_time_search_try_deal_plots",
        date_column=DATE_COLUMN,
        line_columns=LINE_COLUMNS,
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
    """Read CSV rows with normalized headers and normalized cell values."""
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


def parse_booking_date(value: str) -> date:
    """Parse booking_date in YYYYMMDD format."""
    normalized = normalize_cell(value)
    if not normalized:
        raise ValueError("booking_date is empty")
    try:
        return datetime.strptime(normalized, "%Y%m%d").date()
    except ValueError as exc:
        raise ValueError(f"Invalid booking_date value: {value}") from exc


def parse_quantity(value: str) -> float:
    """Parse a quantity value and fallback to zero for empty values."""
    normalized = normalize_cell(value)
    if not normalized:
        return 0.0
    try:
        return float(normalized)
    except ValueError as exc:
        raise ValueError(f"Invalid quantity value: {value}") from exc


def build_plot_series(rows: Iterable[Row], config: PlotConfig) -> tuple[list[date], dict[str, list[float]]]:
    """Convert CSV rows into x-axis dates and y-axis series."""
    dated_rows = sorted(rows, key=lambda row: parse_booking_date(row.get(config.date_column, "")))
    dates = [parse_booking_date(row.get(config.date_column, "")) for row in dated_rows]
    series = {
        column_name: [parse_quantity(row.get(column_name, "")) for row in dated_rows]
        for column_name in config.line_columns
    }
    return dates, series


def save_line_plot(dates: list[date], series: dict[str, list[float]], output_path: Path, plot_name: str) -> None:
    """Save a quantity line plot for one CSV file."""
    try:
        import matplotlib.dates as mdates
        import matplotlib.pyplot as plt
    except Exception as exc:
        raise RuntimeError("matplotlib is required to plot charts") from exc

    if not dates:
        logger.warning("No rows available for plot %s, skip plotting.", plot_name)
        return

    fig, ax = plt.subplots(figsize=(12, 5))
    for column_name, values in series.items():
        ax.plot(dates, values, linewidth=1.8, marker="o", markersize=3.2, label=column_name)

    ax.set_title(f"Order Time Search Try Deal ({plot_name})")
    ax.set_xlabel("booking_date")
    ax.set_ylabel("quantity")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m-%d"))
    ax.grid(True, axis="y", alpha=0.25)
    ax.legend()
    fig.autofmt_xdate(rotation=45)
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)


def iter_csv_files(input_dir: Path) -> list[Path]:
    """Collect all CSV files under the target directory."""
    return sorted(path for path in input_dir.iterdir() if path.is_file() and path.suffix.lower() == ".csv")


def process_csv_file(csv_path: Path, config: PlotConfig) -> None:
    """Read one CSV file, build its plot data, and save the PNG file."""
    encoding = detect_csv_encoding(csv_path)
    fieldnames, rows = read_csv_rows(csv_path, encoding=encoding)
    ensure_required_columns(fieldnames, [config.date_column, *config.line_columns])
    dates, series = build_plot_series(rows, config)
    output_path = config.output_dir / f"{csv_path.stem}.png"
    save_line_plot(dates, series, output_path=output_path, plot_name=csv_path.stem)
    logger.info("Saved plot: %s", output_path)


def process_all_csv_files(config: PlotConfig) -> None:
    """Process all CSV files and generate plots under the output directory."""
    if not config.input_dir.exists():
        raise FileNotFoundError(f"Input directory does not exist: {config.input_dir}")

    config.output_dir.mkdir(parents=True, exist_ok=True)
    csv_files = iter_csv_files(config.input_dir)
    if not csv_files:
        logger.warning("No csv files found under %s", config.input_dir)
        return

    logger.info("Found %s csv files under %s", len(csv_files), config.input_dir)
    for csv_path in csv_files:
        process_csv_file(csv_path, config)


def main() -> None:
    """Run the plotting task with the default project configuration."""
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    config = build_default_config(project_root)
    process_all_csv_files(config)


if __name__ == "__main__":
    main()
