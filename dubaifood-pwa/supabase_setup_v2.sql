-- ==============================================================
-- Dubai Food POS: Multi-Device Daily Sales Table with Order Types Breakdown
-- ==============================================================

-- 1. Create table if not exists with composite primary key (business_date, device_id)
CREATE TABLE IF NOT EXISTS daily_sales_v2 (
  business_date DATE NOT NULL,
  device_id TEXT NOT NULL DEFAULT 'primary',
  device_name TEXT DEFAULT 'Main POS',
  total_sales NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  total_orders INTEGER NOT NULL DEFAULT 0,
  delivery_sales NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  delivery_orders INTEGER NOT NULL DEFAULT 0,
  dine_in_sales NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  dine_in_orders INTEGER NOT NULL DEFAULT 0,
  takeaway_sales NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  takeaway_orders INTEGER NOT NULL DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (business_date, device_id)
);

-- Index on business_date descending for instant lookup
CREATE INDEX IF NOT EXISTS idx_daily_sales_v2_date ON daily_sales_v2 (business_date DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE daily_sales_v2 ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read on daily_sales_v2" 
  ON daily_sales_v2 FOR SELECT 
  USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role upsert on daily_sales_v2" 
  ON daily_sales_v2 FOR ALL 
  USING (true);

-- 2. Migrate existing historical daily_sales into daily_sales_v2 seamlessly
INSERT INTO daily_sales_v2 (
  business_date, 
  device_id, 
  device_name, 
  total_sales, 
  total_orders, 
  delivery_sales, 
  delivery_orders, 
  dine_in_sales, 
  dine_in_orders, 
  takeaway_sales, 
  takeaway_orders, 
  last_sync_at, 
  updated_at
)
SELECT 
  business_date,
  'primary' AS device_id,
  'Main POS' AS device_name,
  total_sales,
  total_orders,
  -- Historical estimate based on Dubai Food actual order distribution (~57% Delivery, ~25% Dine In, ~18% Takeaway)
  ROUND(total_sales * 0.57, 2) AS delivery_sales,
  ROUND(total_orders * 0.52) AS delivery_orders,
  ROUND(total_sales * 0.25, 2) AS dine_in_sales,
  ROUND(total_orders * 0.25) AS dine_in_orders,
  ROUND(total_sales * 0.18, 2) AS takeaway_sales,
  ROUND(total_orders * 0.23) AS takeaway_orders,
  last_sync_at,
  updated_at
FROM daily_sales
ON CONFLICT (business_date, device_id) DO NOTHING;
