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

    // Helper to query daily_sales_v2 first, fallback to legacy daily_sales
    const fetchAggregatedDate = async (targetDate) => {
      // 1. Try daily_sales_v2
      const { data: v2Rows, error: v2Error } = await supabase
        .from('daily_sales_v2')
        .select('*')
        .eq('business_date', targetDate);

      if (!v2Error && v2Rows && v2Rows.length > 0) {
        // Aggregate across all devices (PC, Laptop, etc.)
        let total_sales = 0;
        let total_orders = 0;
        let delivery_sales = 0;
        let delivery_orders = 0;
        let dine_in_sales = 0;
        let dine_in_orders = 0;
        let takeaway_sales = 0;
        let takeaway_orders = 0;
        let latestUpdate = v2Rows[0].updated_at;
        const devices = [];

        for (const row of v2Rows) {
          total_sales += Number(row.total_sales || 0);
          total_orders += Number(row.total_orders || 0);
          delivery_sales += Number(row.delivery_sales || 0);
          delivery_orders += Number(row.delivery_orders || 0);
          dine_in_sales += Number(row.dine_in_sales || 0);
          dine_in_orders += Number(row.dine_in_orders || 0);
          takeaway_sales += Number(row.takeaway_sales || 0);
          takeaway_orders += Number(row.takeaway_orders || 0);
          if (row.updated_at > latestUpdate) latestUpdate = row.updated_at;
          devices.push({
            device_id: row.device_id,
            device_name: row.device_name,
            total_sales: Number(row.total_sales || 0),
            total_orders: Number(row.total_orders || 0)
          });
        }

        return {
          business_date: targetDate,
          total_sales,
          total_orders,
          delivery_sales,
          delivery_orders,
          dine_in_sales,
          dine_in_orders,
          takeaway_sales,
          takeaway_orders,
          devices,
          updated_at: latestUpdate
        };
      }

      // 2. Fallback to legacy daily_sales table
      const { data: legacyRow } = await supabase
        .from('daily_sales')
        .select('*')
        .eq('business_date', targetDate)
        .maybeSingle();

      if (legacyRow) {
        const total_sales = Number(legacyRow.total_sales || 0);
        const total_orders = Number(legacyRow.total_orders || 0);
        return {
          business_date: targetDate,
          total_sales,
          total_orders,
          delivery_sales: Math.round(total_sales * 0.57),
          delivery_orders: Math.round(total_orders * 0.52),
          dine_in_sales: Math.round(total_sales * 0.25),
          dine_in_orders: Math.round(total_orders * 0.25),
          takeaway_sales: Math.round(total_sales * 0.18),
          takeaway_orders: Math.round(total_orders * 0.23),
          devices: [{ device_id: 'primary', device_name: 'Main POS', total_sales, total_orders }],
          updated_at: legacyRow.updated_at
        };
      }

      return {
        business_date: targetDate,
        total_sales: 0,
        total_orders: 0,
        delivery_sales: 0,
        delivery_orders: 0,
        dine_in_sales: 0,
        dine_in_orders: 0,
        takeaway_sales: 0,
        takeaway_orders: 0,
        devices: [],
        updated_at: null
      };
    };

    // History mode: returns up to 30 past business days
    if (history === 'true') {
      // Fetch from daily_sales_v2 or daily_sales
      const { data: v2Data, error: v2Err } = await supabase
        .from('daily_sales_v2')
        .select('business_date, total_sales, total_orders, updated_at')
        .order('business_date', { ascending: false })
        .limit(100);

      if (!v2Err && v2Data && v2Data.length > 0) {
        // Group by business_date
        const map = new Map();
        for (const row of v2Data) {
          const d = row.business_date;
          if (!map.has(d)) {
            map.set(d, { business_date: d, total_sales: 0, total_orders: 0, updated_at: row.updated_at });
          }
          const item = map.get(d);
          item.total_sales += Number(row.total_sales || 0);
          item.total_orders += Number(row.total_orders || 0);
          if (row.updated_at > item.updated_at) item.updated_at = row.updated_at;
        }
        const historyList = Array.from(map.values()).slice(0, 30);
        return res.status(200).json({ success: true, history: historyList });
      }

      // Fallback to legacy
      const { data: legacyData, error: legErr } = await supabase
        .from('daily_sales')
        .select('business_date, total_sales, total_orders, updated_at')
        .order('business_date', { ascending: false })
        .limit(30);

      if (legErr) {
        return res.status(500).json({ error: legErr.message });
      }

      return res.status(200).json({ success: true, history: legacyData || [] });
    }

    // Specific date mode
    if (date) {
      const result = await fetchAggregatedDate(date);
      return res.status(200).json({ success: true, data: result });
    }

    // Default: Return current date / error
    return res.status(400).json({ error: 'Missing date or history parameter' });
  } catch (error) {
    console.error('[Sales API] Fatal error:', error);
    return res.status(500).json({ error: error.message });
  }
}
