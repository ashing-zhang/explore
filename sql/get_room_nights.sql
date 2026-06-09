/*
运行指南：
- 在数据平台/SQL 客户端直接执行本文件
- 依赖表：dwd_hop_dbo_hst_order_prices_c（建议使用最新分区：pt = MAX_PT(...)）
输出字段：
- price：价格（double）
- room_nights：(checkout_date - checkin_date) * num
*/

WITH base AS (
  SELECT
    CAST(price AS double) AS price,
    checkin_date,
    checkout_date,
    CAST(num AS bigint) AS num
  FROM dwd_hop_dbo_hst_order_prices_c
  WHERE pt = MAX_PT('dwd_hop_dbo_hst_order_prices_c')
)
SELECT
  price,
  CASE
    WHEN checkin_date IS NULL OR checkout_date IS NULL THEN NULL
    ELSE (
      CASE
        WHEN datediff(to_date(checkout_date), to_date(checkin_date)) < 0 THEN 0
        ELSE datediff(to_date(checkout_date), to_date(checkin_date))
      END
    ) * COALESCE(num, 0)
  END AS room_nights
FROM base
