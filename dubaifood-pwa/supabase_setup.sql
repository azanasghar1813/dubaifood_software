-- ==============================================================
-- Dubai Food POS: Daily Sales Sync Table
-- ==============================================================

CREATE TABLE IF NOT EXISTS daily_sales (
  business_date DATE PRIMARY KEY,
  total_sales NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  total_orders INTEGER NOT NULL DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index on business_date descending for instant history lookup
CREATE INDEX IF NOT EXISTS idx_daily_sales_date ON daily_sales (business_date DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;

-- Allow public read access (the PWA frontend reads this with PIN check)
CREATE POLICY "Allow public read on daily_sales" 
  ON daily_sales FOR SELECT 
  USING (true);

-- Allow service_role key to insert/update (Vercel API sync endpoint)
CREATE POLICY "Allow service role upsert on daily_sales" 
  ON daily_sales FOR ALL 
  USING (true);
