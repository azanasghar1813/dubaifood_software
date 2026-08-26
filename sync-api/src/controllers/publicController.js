import { supabase } from '../config/supabaseClient.js';

export const getPublicMenu = async (req, res) => {
  try {
    // Fetch all categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('*');

    if (catError) throw catError;

    // Fetch all products
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('*');

    if (prodError) throw prodError;

    // Return combined menu data
    return res.status(200).json({
      categories,
      products
    });
  } catch (error) {
    console.error('[PublicController] getPublicMenu error:', error);
    return res.status(500).json({ error: 'Failed to fetch public menu' });
  }
};

export const submitOnlineOrder = async (req, res) => {
  try {
    const { orderDetails, customerInfo } = req.body;

    if (!orderDetails || !customerInfo) {
      return res.status(400).json({ error: 'Missing order details or customer info' });
    }

    // Generate a unique ID for the order
    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const orderPayload = {
      id: orderId,
      customer_id: customerInfo.id || null, // Optional if guest
      customer_name: customerInfo.name,
      customer_phone: customerInfo.phone,
      total_amount: orderDetails.total,
      payment_type: orderDetails.paymentType || 'CASH', // Online could be CARD, but default cash on delivery
      status: 'PENDING', // Very important: Local POS pulls 'PENDING' orders
      source: 'ONLINE',  // Mark as an online order
      items: orderDetails.items, // Array of items
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      payload_version: Date.now() // For optimistic concurrency
    };

    // Insert into Supabase
    const { error } = await supabase
      .from('orders')
      .insert([orderPayload]);

    if (error) throw error;

    return res.status(201).json({
      message: 'Order placed successfully',
      orderId: orderId,
      status: 'PENDING'
    });
  } catch (error) {
    console.error('[PublicController] submitOnlineOrder error:', error);
    return res.status(500).json({ error: 'Failed to submit order' });
  }
};
