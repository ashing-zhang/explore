SELECT
  MIN(CAST(price AS double)) AS min_price,
  MAX(CAST(price AS double)) AS max_price
FROM dwd_hop_dbo_hst_order_prices_c
WHERE pt = MAX_PT('dwd_hop_dbo_hst_order_prices_c')
  AND hid = 2732704
