import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIN_CODE = process.env.APP_PIN || '1813';

const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-pin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const providedPin = req.headers['x-pin'] || req.query.pin;
    if (providedPin !== PIN_CODE) {
      return res.status(401).json({ error: 'Unauthorized: Invalid PIN code' });
    }

    const { date, history } = req.query;

    // History mode: returns up to 30 past business days
    if (history === 'true') {
      const { data, error } = await supabase
        .from('daily_sales')
        .select('business_date, total_sales, total_orders, updated_at')
        .order('business_date', { ascending: false })
        .limit(30);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, history: data || [] });
    }

    // Specific date mode
    if (date) {
      const { data, error } = await supabase
        .from('daily_sales')
        .select('*')
        .eq('business_date', date)
        .maybeSingle();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (!data) {
        return res.status(200).json({
          success: true,
          found: false,
          data: {
            business_date: date,
            total_sales: 0,
            total_orders: 0,
            updated_at: null
          }
        });
      }

      return res.status(200).json({ success: true, found: true, data });
    }

    // Default: fetch the most recent business date
    const { data, error } = await supabase
      .from('daily_sales')
      .select('*')
      .order('business_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      found: Boolean(data),
      data: data || {
        business_date: new Date().toISOString().split('T')[0],
        total_sales: 0,
        total_orders: 0,
        updated_at: null
      }
    });
  } catch (err) {
    console.error('[Sales API] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
