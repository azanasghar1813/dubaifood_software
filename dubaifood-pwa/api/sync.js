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

    const { 
      business_date, 
      device_id = 'primary', 
      device_name = 'POS Terminal',
      total_sales, 
      total_orders,
      delivery_sales = 0,
      delivery_orders = 0,
      dine_in_sales = 0,
      dine_in_orders = 0,
      takeaway_sales = 0,
      takeaway_orders = 0
    } = req.body;

    if (!business_date) {
      return res.status(400).json({ error: 'business_date is required (YYYY-MM-DD)' });
    }

    const numericTotalSales = Math.max(0, Number(total_sales) || 0);
    const numericTotalOrders = Math.max(0, parseInt(total_orders, 10) || 0);
    const numericDeliverySales = Math.max(0, Number(delivery_sales) || 0);
    const numericDeliveryOrders = Math.max(0, parseInt(delivery_orders, 10) || 0);
    const numericDineInSales = Math.max(0, Number(dine_in_sales) || 0);
    const numericDineInOrders = Math.max(0, parseInt(dine_in_orders, 10) || 0);
    const numericTakeawaySales = Math.max(0, Number(takeaway_sales) || 0);
    const numericTakeawayOrders = Math.max(0, parseInt(takeaway_orders, 10) || 0);

    const nowIso = new Date().toISOString();

    // 1. Try Upserting into daily_sales_v2 (Supports multi-device & breakdowns)
    let v2Success = false;
    const { error: v2Error } = await supabase
      .from('daily_sales_v2')
      .upsert(
        {
          business_date,
          device_id: String(device_id).trim() || 'primary',
          device_name: String(device_name).trim() || 'POS Terminal',
          total_sales: numericTotalSales,
          total_orders: numericTotalOrders,
          delivery_sales: numericDeliverySales,
          delivery_orders: numericDeliveryOrders,
          dine_in_sales: numericDineInSales,
          dine_in_orders: numericDineInOrders,
          takeaway_sales: numericTakeawaySales,
          takeaway_orders: numericTakeawayOrders,
          last_sync_at: nowIso,
          updated_at: nowIso
        },
        { onConflict: 'business_date,device_id' }
      );

    if (!v2Error) {
      v2Success = true;
    } else {
      console.warn('[Sync API] daily_sales_v2 upsert error (falling back to legacy):', v2Error.message);
    }

    // 2. Also keep legacy daily_sales updated for backward compatibility
    await supabase
      .from('daily_sales')
      .upsert(
        {
          business_date,
          total_sales: numericTotalSales,
          total_orders: numericTotalOrders,
          last_sync_at: nowIso,
          updated_at: nowIso
        },
        { onConflict: 'business_date' }
      );

    return res.status(200).json({
      success: true,
      message: 'Daily sales updated successfully',
      data: {
        business_date,
        device_id,
        total_sales: numericTotalSales,
        total_orders: numericTotalOrders,
        delivery_sales: numericDeliverySales,
        dine_in_sales: numericDineInSales,
        takeaway_sales: numericTakeawaySales,
        v2_synced: v2Success
      }
    });
  } catch (error) {
    console.error('[Sync API] Fatal error:', error);
    return res.status(500).json({ error: error.message });
  }
}
