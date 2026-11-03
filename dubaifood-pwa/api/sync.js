import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SYNC_SECRET = process.env.SYNC_SECRET || 'Azan@181314Sync2026';

const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-sync-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const incomingSecret = req.headers['x-sync-secret'] || req.body?.secret;
    if (incomingSecret !== SYNC_SECRET) {
      return res.status(401).json({ error: 'Unauthorized: Invalid sync secret' });
    }

    const { business_date, total_sales, total_orders } = req.body;

    if (!business_date) {
      return res.status(400).json({ error: 'business_date is required (YYYY-MM-DD)' });
    }

    const numericSales = Math.max(0, Number(total_sales) || 0);
    const numericOrders = Math.max(0, parseInt(total_orders, 10) || 0);

    const { data, error } = await supabase
      .from('daily_sales')
      .upsert(
        {
          business_date,
          total_sales: numericSales,
          total_orders: numericOrders,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'business_date' }
      )
      .select()
      .single();

    if (error) {
      console.error('[Sync API] Supabase upsert error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Daily sales updated successfully',
      data
    });
  } catch (err) {
    console.error('[Sync API] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
