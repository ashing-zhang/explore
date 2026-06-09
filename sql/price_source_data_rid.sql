SELECT
  hid,
  checkin_date,
  order_no,
  rid,
  MAX(CAST(price AS double)) AS price
FROM dwd_hop_dbo_hst_order_prices_c
WHERE pt = MAX_PT('dwd_hop_dbo_hst_order_prices_c') 
AND checkin_date >= '2025-05-11 00:00:00' 
AND checkin_date < '2026-05-11 00:00:00'
GROUP BY
  hid,
  checkin_date,
  rid,
  order_no
