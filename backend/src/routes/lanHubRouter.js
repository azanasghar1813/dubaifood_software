import { Router } from 'express';
import { orderNumberService } from '../services/orderNumberService.js';
import { orderUpsertService } from '../services/orderUpsertService.js';
import { printService } from '../services/printService.js';
import { dateUtils } from '../utils/dateUtils.js';
import { configService } from '../services/configService.js';
import { socketService } from '../services/socketService.js';
import { dbEngine } from '../database/sqlite.js';
import { LAN_SHARED_SECRET } from '../config/lanSecret.js';
import { lanSyncService } from '../services/lanSyncService.js';
import crypto from 'crypto';

const router = Router();

// Middleware to verify internal requests
const verifyInternal = (req, res, next) => {
  const secret = req.headers['x-device-secret'];
  const terminalId = req.headers['x-terminal-id'];
  
  // 1. Centralized LAN shared secret
  const expectedSecret = LAN_SHARED_SECRET;
  
  if (!secret || !terminalId) {
    lanSyncService._log(`[LanSync] 401 Unauthorized: Missing credentials from Terminal ${terminalId || 'unknown'}`, 'error');
    return res.status(401).json({ success: false, message: 'Invalid device credentials' });
  }

  const bufSecret = Buffer.from(secret);
  const bufExpected = Buffer.from(expectedSecret);
  
  if (bufSecret.length !== bufExpected.length || !crypto.timingSafeEqual(bufSecret, bufExpected)) {
    lanSyncService._log(`[LanSync] 401 Unauthorized: Hub rejected credentials from Terminal ${terminalId} — check device secret`, 'error');
    return res.status(401).json({ success: false, message: 'Invalid device credentials' });
  }
  
  req.terminalId = terminalId;
  next();
};

router.use(verifyInternal);

router.post('/allocate-number', async (req, res) => {
  try {
    const { branch_id, business_date, min_sequence, peek } = req.body;
    // 3. Set floor sequence to avoid issuing used numbers after Hub restore
    if (min_sequence) {
      const dateKey = orderNumberService.resolveDateKey(business_date);
      orderNumberService._setLocalSeq(branch_id, dateKey, Number(min_sequence));
    }
    if (peek) {
      const orderNumber = orderNumberService.peekNextNumberSync(branch_id, business_date);
      return res.json({ success: true, order_number: orderNumber });
    }
    // The HUB allocates the next number from its live sequence
    const orderNumber = await orderNumberService.allocateNextNumber(branch_id, business_date);
    res.json({ success: true, order_number: orderNumber });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/lease-numbers', async (req, res) => {
  try {
    const { branch_id, business_date, count } = req.body;
    const bDate = business_date || dateUtils.getBusinessDate();
    // 14. Clamp count to max 2000
    const c = Math.min(Number(count) || 500, 2000);
    
    // HUB reserves a block of sequence numbers and returns the range
    const block = orderNumberService._allocateBlock(branch_id, bDate, c);
    
    // 17. Audit trail
    lanSyncService._log(`[LAN-Hub] Issued lease block ${block.range_start}-${block.range_end} to Terminal ${req.terminalId}`);
    
    res.json({ success: true, data: block });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/ticket-state', (req, res) => {
  const bDate = req.query.business_date || dateUtils.getBusinessDate();
  const max = orderNumberService.maxKnownSeq('DEFAULT_BRANCH', bDate);
  res.json({ success: true, max_sequence: max });
});

router.post('/lan-sync-order', async (req, res) => {
  try {
    const orderPayload = req.body;
    
    // Check if the order is completely new to the Hub
    const existingOrder = dbEngine.prepare(`SELECT order_number FROM orders WHERE id = ?`).get(orderPayload.id);
    
    let finalOrderNumber = orderPayload.order_number;
    if (!existingOrder) {
      // It's a new order syncing from a Terminal! The terminal assigned it a TEMP number (e.g. 2000+)
      // The Hub must assign the TRUE sequential number.
      finalOrderNumber = orderNumberService.generateNextNumber(orderPayload.branch_id, orderPayload.business_date);
      orderPayload.order_number = finalOrderNumber;
      lanSyncService._log(`[LAN-Hub] Reassigned TEMP order ${req.body.order_number} to Final Order Number ${finalOrderNumber}`);
    } else {
      // It's an update to an existing order, keep the correct number
      orderPayload.order_number = existingOrder.order_number;
      finalOrderNumber = existingOrder.order_number;
    }

    // Hub only handles upserts via this endpoint
    const result = orderUpsertService.upsertHydratedOrder(orderPayload);
    if (!result || result.success === false) {
      return res.status(422).json({ success: false, message: result?.message || 'Upsert failed' });
    }
    
    socketService.emitOrderUpserted(orderPayload);
    
    // Include the final_order_number in the response so the Terminal can update its own DB
    res.json({ success: true, result, final_order_number: finalOrderNumber });
  } catch (error) {
    lanSyncService._log(`[LanSync] Error upserting LAN order: ${error.message}`, 'error');
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/print/kitchen/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { cashierUserId, options } = req.body;
    
    // The Hub executes the actual kitchen ticket generation and enqueueing
    const result = await printService.printKitchenTickets(orderId, cashierUserId, options || {});
    res.json({ success: true, ...result });
  } catch (error) {
    lanSyncService._log(`[LanSync] Error routing kitchen print on Hub: ${error.message}`, 'error');
    res.status(500).json({ success: false, message: error.message });
  }
});

import { lanMasterDataService } from '../services/lanMasterDataService.js';

router.post('/lan-sync-master-data', async (req, res) => {
  try {
    const { payload } = req.body;
    lanMasterDataService.applyIncomingData(payload);
    // Hub rebounds the broadcast to all other terminals
    socketService.emitToAll('sync:master_data', payload);
    lanSyncService._log(`[LanSync] Hub applied & rebounded Master Data from Terminal ${req.terminalId}`);
    res.json({ success: true });
  } catch (error) {
    lanSyncService._log(`[LanSync] Error upserting Master Data: ${error.message}`, 'error');
    res.status(500).json({ success: false, message: error.message });
  }
});

import { TYPE_TO_TABLE_MAP } from '../services/lanMasterDataService.js';

router.post('/lan-sync-catchup', async (req, res) => {
  try {
    const { since } = req.body;
    if (!since) return res.status(400).json({ success: false, message: 'Missing since timestamp' });

    // Fetch changes from sync_queue that happened after `since`
    const items = dbEngine.prepare(`
      SELECT id, entity_type, entity_id, action, created_at 
      FROM sync_queue 
      WHERE created_at > ? 
      ORDER BY created_at ASC 
      LIMIT 500
    `).all(since);

    const orders = [];
    const masterData = {};
    let maxTimestamp = since;

    for (const item of items) {
      if (item.created_at > maxTimestamp) maxTimestamp = item.created_at;

      const tableName = TYPE_TO_TABLE_MAP[item.entity_type];
      if (!tableName) continue;

      if (tableName.startsWith('order') && tableName !== 'orders') {
        // Skip sub-order tables, we will just fetch the full hydrated order if the parent order is modified.
        // Wait, what if ONLY a timeline event was inserted while offline? We DO need to fetch the parent order!
        // For simplicity, we can fetch the parent order.
        let orderId = item.entity_id;
        if (tableName === 'order_items') {
           const row = dbEngine.prepare(`SELECT order_id FROM order_items WHERE id = ?`).get(item.entity_id);
           if (row) orderId = row.order_id;
        } else if (tableName === 'order_payments') {
           const row = dbEngine.prepare(`SELECT order_id FROM order_payments WHERE id = ?`).get(item.entity_id);
           if (row) orderId = row.order_id;
        } else if (tableName === 'order_timeline') {
           const row = dbEngine.prepare(`SELECT order_id FROM order_timeline WHERE id = ?`).get(item.entity_id);
           if (row) orderId = row.order_id;
        } else if (tableName === 'order_audit_trail') {
           const row = dbEngine.prepare(`SELECT order_id FROM order_audit_trail WHERE id = ?`).get(item.entity_id);
           if (row) orderId = row.order_id;
        }

        if (orderId && !orders.some(o => o.id === orderId)) {
          const hydrated = orderService.getOrderById(orderId);
          if (hydrated) orders.push(hydrated);
        }
      } else if (tableName === 'orders') {
        if (item.action === 'DELETE') {
          // Send a minimal tombstone for orders
          if (!orders.some(o => o.id === item.entity_id)) {
            orders.push({ id: item.entity_id, _deleted: true });
          }
        } else {
          if (!orders.some(o => o.id === item.entity_id)) {
            const hydrated = orderService.getOrderById(item.entity_id);
            if (hydrated) orders.push(hydrated);
          }
        }
      } else if (tableName !== 'dining_tables' && tableName !== 'tables') {
        // Master Data
        if (!masterData[tableName]) masterData[tableName] = [];
        if (item.action === 'DELETE') {
          masterData[tableName].push({ id: item.entity_id, _deleted: true });
        } else {
          try {
            const row = dbEngine.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(item.entity_id);
            if (row) masterData[tableName].push(row);
            else masterData[tableName].push({ id: item.entity_id, _deleted: true });
          } catch (e) {
            console.error(`[LanSync] Catchup failed to fetch from ${tableName}`, e.message);
          }
        }
      }
    }

    res.json({
      success: true,
      orders,
      masterData,
      hub_time: maxTimestamp,
      hasMore: items.length === 500
    });
  } catch (error) {
    lanSyncService._log(`[LanSync] Error processing Catch-Up Sync: ${error.message}`, 'error');
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
