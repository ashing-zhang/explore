"""
运行指南：
    请在项目根目录下以模块方式运行：
    python -m scripts.plot_price_scatter

输出说明：
    - 读取 data/top_10_sales_hotels.csv 中的 hid 列（共 10 个）
    - 通过 sql/price_source_data_rid.sql 从 ODPS 拉取 (checkin_date, rid, price) 数据
    - 为每个 hid 绘制按 rid 区分颜色的 price 散点图，输出到 data/price_scatter_rid_plots/{hid}.png
"""

import csv
import logging
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

from odps import ODPS

from scripts.utils import init_odps_client, load_odps_config, read_sql_file, to_float


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def _read_hids(csv_path: Path) -> List[str]:
    hids: List[str] = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or "hid" not in reader.fieldnames:
            raise ValueError(f"CSV missing 'hid' header: {csv_path}")
        for row in reader:
            hid = (row.get("hid") or "").strip().strip('"').strip("'")
            if hid:
                hids.append(hid)
    if not hids:
        raise ValueError(f"No hid values found in {csv_path}")
    return hids


def _normalize_checkin_date(value) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()

    s = str(value).strip().strip('"').strip("'")
    if not s:
        return None

    s = s.replace("/", "-")
    if len(s) >= 10:
        s = s[:10]

    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        pass
    try:
        return datetime.fromisoformat(s).date()
    except ValueError:
        return None


def _query_checkin_price_for_hid(odps: ODPS, base_sql: str, hid: str) -> List[Tuple[date, float]]:
    sql = f"""
SELECT
  checkin_date,
  price
FROM (
{base_sql}
) t
WHERE CAST(hid AS STRING) = '{hid}'
"""
    instance = odps.run_sql(sql)
    instance.wait_for_success()

    points: List[Tuple[date, float]] = []
    with instance.open_reader() as reader:
        column_names = [col.name for col in reader.schema.columns]
        try:
            checkin_idx = column_names.index("checkin_date")
            price_idx = column_names.index("price")
        except ValueError as e:
            raise RuntimeError(f"ODPS result missing required columns: {column_names}") from e

        for record in reader:
            values = getattr(record, "values", None)
            if values is None:
                values = list(record)
            d = _normalize_checkin_date(values[checkin_idx])
            p = to_float(values[price_idx])
            if d is None or p is None:
                continue
            points.append((d, p))
    return points


def _save_scatter_plot(points: Sequence[Tuple[date, float]], output_path: Path, hid: str) -> None:
    try:
        import matplotlib.dates as mdates
        import matplotlib.pyplot as plt
    except Exception as e:
        raise RuntimeError("matplotlib is required to plot scatter charts") from e

    if not points:
        logger.warning("No data points for hid=%s, skip plotting.", hid)
        return

    xs = [p[0] for p in points]
    ys = [p[1] for p in points]

    fig, ax = plt.subplots(figsize=(12, 5))
    ax.scatter(xs, ys, s=10, alpha=0.7)
    ax.set_title(f"Price Scatter (hid={hid})")
    ax.set_xlabel("checkin_date")
    ax.set_ylabel("price")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m-%d"))
    fig.autofmt_xdate(rotation=45)
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)


def _query_checkin_price_for_hid_rid(odps: ODPS, base_sql: str, hid: str) -> List[Tuple[date, str, float]]:
    sql = f"""
SELECT
  checkin_date,
  rid,
  price
FROM (
{base_sql}
) t
WHERE CAST(hid AS STRING) = '{hid}'
"""
    instance = odps.run_sql(sql)
    instance.wait_for_success()

    points: List[Tuple[date, str, float]] = []
    with instance.open_reader() as reader:
        column_names = [col.name for col in reader.schema.columns]
        try:
            checkin_idx = column_names.index("checkin_date")
            rid_idx = column_names.index("rid")
            price_idx = column_names.index("price")
        except ValueError as e:
            raise RuntimeError(f"ODPS result missing required columns: {column_names}") from e

        for record in reader:
            values = getattr(record, "values", None)
            if values is None:
                values = list(record)
            d = _normalize_checkin_date(values[checkin_idx])
            r = str(values[rid_idx]) if values[rid_idx] is not None else ""
            p = to_float(values[price_idx])
            if d is None or p is None:
                continue
            points.append((d, r, p))
    return points


def _save_scatter_rid_plot(points: Sequence[Tuple[date, str, float]], output_path: Path, hid: str) -> None:
    try:
        import matplotlib.dates as mdates
        import matplotlib.pyplot as plt
        import matplotlib.ticker as mticker
    except Exception as e:
        raise RuntimeError("matplotlib is required to plot scatter charts") from e

    if not points:
        logger.warning("No data points for hid=%s, skip plotting.", hid)
        return

    rid_to_points = {}
    for d, r, p in points:
        rid_to_points.setdefault(r, ([], []))
        rid_to_points[r][0].append(d)
        rid_to_points[r][1].append(p)

    fig, ax = plt.subplots(figsize=(12, 5))
    for r, (xs, ys) in rid_to_points.items():
        ax.scatter(xs, ys, s=10, alpha=0.7)

    ax.set_title(f"Price Scatter (hid={hid})")
    ax.set_xlabel("checkin_date")
    ax.set_ylabel("price")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m-%d"))
    ax.yaxis.set_major_locator(mticker.MaxNLocator(nbins=12))
    ax.yaxis.set_minor_locator(mticker.AutoMinorLocator(2))
    ax.grid(True, axis="y", which="major", alpha=0.25)
    ax.grid(True, axis="y", which="minor", alpha=0.15, linewidth=0.5)
    fig.autofmt_xdate(rotation=45)
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)


def main():
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent

    data_dir = project_root / "data"
    sql_dir = project_root / "sql"

    hids_csv_path = data_dir / "top_10_sales_hotels.csv"
    output_dir = data_dir / "price_scatter_rid_plots"
    output_dir.mkdir(parents=True, exist_ok=True)

    config_path = sql_dir / "config.yaml"
    sql_path = sql_dir / "price_source_data_rid.sql"

    odps_config = load_odps_config(config_path)
    odps = init_odps_client(odps_config)

    base_sql = read_sql_file(sql_path)
    hids = _read_hids(hids_csv_path)

    logger.info("Start plotting scatter charts for %s hids...", len(hids))
    for hid in hids:
        logger.info("Querying ODPS for hid=%s ...", hid)
        points = _query_checkin_price_for_hid_rid(odps, base_sql, hid)
        output_path = output_dir / f"{hid}.png"
        _save_scatter_rid_plot(points, output_path, hid)
        if output_path.exists():
            logger.info("Saved: %s", output_path)
    logger.info("Done.")


if __name__ == "__main__":
    main()
