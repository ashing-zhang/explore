"""
运行指南：
    请在项目根目录下以模块方式运行：
    python -m scripts.plot_price_sales

输出说明：
    - 执行 sql/min_max_price.sql 获取 price 的最小/最大值作为横轴范围
    - 以 sql/get_room_nights.sql 的结果作为原始数据源（price, room_nights）
    - 从最小 price 开始，以 100 为步长分桶，桶的中值作为 price_range
    - 每个桶内对 room_nights 求和得到 agg_room_nights
    - 绘制 price_range-agg_room_nights 折线图，输出到 data/price_sales_plots/price_sales.png
"""

from __future__ import annotations

import logging
from decimal import Decimal
from pathlib import Path

from odps import ODPS

from scripts.utils import init_odps_client, load_odps_config, read_sql_file, to_float

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def _format_number_for_sql(value: float) -> str:
    """Format a float as a non-scientific decimal for SQL embedding."""
    d = Decimal(str(value))
    return format(d, "f")


def _query_single_row(odps: ODPS, sql: str) -> list:
    """Run SQL and return the first row as a list."""
    instance = odps.run_sql(sql)
    instance.wait_for_success()
    with instance.open_reader() as reader:
        for record in reader:
            values = getattr(record, "values", None)
            if values is None:
                values = list(record)
            return list(values)
    return []


def _query_min_max_price(odps: ODPS, sql: str) -> tuple[float, float]:
    """Query min_price and max_price."""
    row = _query_single_row(odps, sql)
    if len(row) < 2:
        raise RuntimeError("min_max_price.sql did not return (min_price, max_price).")
    min_price = to_float(row[0])
    max_price = to_float(row[1])
    if min_price is None or max_price is None:
        raise RuntimeError(f"Invalid min/max price: {row}")
    return min_price, max_price


def _build_agg_sql(base_sql: str, min_price: float, max_price: float, step: int) -> str:
    """Build aggregation SQL for (price_range, agg_room_nights)."""
    min_sql = _format_number_for_sql(min_price)
    max_sql = _format_number_for_sql(max_price)
    step_sql = int(step)
    half_step_sql = int(step // 2)

    return f"""
SELECT
  ({min_sql} + bucket_id * {step_sql} + {half_step_sql}) AS price_range,
  SUM(room_nights) AS agg_room_nights
FROM (
  SELECT
    price,
    room_nights,
    CAST(FLOOR((price - {min_sql}) / {step_sql}) AS BIGINT) AS bucket_id
  FROM (
{base_sql}
  ) t
  WHERE price IS NOT NULL
    AND room_nights IS NOT NULL
    AND price >= {min_sql}
    AND price <= {max_sql}
) b
GROUP BY bucket_id
ORDER BY price_range
""".strip()


def _query_price_range_points(
    odps: ODPS,
    base_sql: str,
    min_price: float,
    max_price: float,
    step: int = 100,
) -> list[tuple[float, float]]:
    """Query aggregated (price_range, agg_room_nights) points."""
    sql = _build_agg_sql(base_sql=base_sql, min_price=min_price, max_price=max_price, step=step)
    instance = odps.run_sql(sql)
    instance.wait_for_success()

    points: list[tuple[float, float]] = []
    with instance.open_reader() as reader:
        column_names = [col.name for col in reader.schema.columns]
        try:
            x_idx = column_names.index("price_range")
            y_idx = column_names.index("agg_room_nights")
        except ValueError as e:
            raise RuntimeError(f"ODPS result missing required columns: {column_names}") from e

        for record in reader:
            values = getattr(record, "values", None)
            if values is None:
                values = list(record)
            x = to_float(values[x_idx])
            y = to_float(values[y_idx])
            if x is None or y is None:
                continue
            points.append((x, y))
    return points


def _save_line_plot(
    points: list[tuple[float, float]],
    output_path: Path,
    min_price: float,
    max_price: float,
) -> None:
    """Save a line plot for aggregated points."""
    try:
        import matplotlib.pyplot as plt
    except Exception as e:
        raise RuntimeError("matplotlib is required to plot charts") from e

    if not points:
        logger.warning("No aggregated points, skip plotting.")
        return

    xs = [p[0] for p in points]
    ys = [p[1] for p in points]

    fig, ax = plt.subplots(figsize=(12, 5))
    ax.plot(xs, ys, linewidth=1.8, marker="o", markersize=3.5)
    ax.set_xlabel("price_range")
    ax.set_ylabel("agg_room_nights")
    ax.set_xlim(min_price, max_price)
    ax.grid(True, axis="y", alpha=0.25)
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)


def main() -> None:
    """Entry point."""
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent

    sql_dir = project_root / "sql"
    data_dir = project_root / "data"

    config_path = sql_dir / "config.yaml"
    min_max_sql_path = sql_dir / "min_max_price.sql"
    base_sql_path = sql_dir / "get_room_nights.sql"

    output_dir = data_dir / "price_sales_plots"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "price_sales.png"

    odps_config = load_odps_config(config_path)
    odps = init_odps_client(odps_config)

    min_max_sql = read_sql_file(min_max_sql_path)
    min_price, max_price = _query_min_max_price(odps, min_max_sql)
    logger.info("min_price=%.6f, max_price=%.6f", min_price, max_price)

    base_sql = read_sql_file(base_sql_path)
    points = _query_price_range_points(odps, base_sql=base_sql, min_price=min_price, max_price=max_price, step=100)
    logger.info("Aggregated points: %s", len(points))

    _save_line_plot(points, output_path=output_path, min_price=min_price, max_price=max_price)
    if output_path.exists():
        logger.info("Saved: %s", output_path)


if __name__ == "__main__":
    main()
