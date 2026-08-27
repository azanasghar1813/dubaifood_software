import { dbEngine } from '../database/sqlite.js';
import { configService } from './configService.js';
import crypto from 'crypto';

class OrderNumberService {
  /**
   * Generates an atomic, guaranteed-unique business order number.
   * 
   * @param {string} branchId 
   * @param {string} businessDate YYYY-MM-DD
   * @returns {string} Formatted order number e.g. "POS-20260731-000001"
   */
  generateNextNumber(branchId = 'DEFAULT_BRANCH', businessDate = null) {
    if (!businessDate) {
      businessDate = new Date().toISOString().split('T')[0];
    }

    const orderConfig = configService.getOrderConfig() || {};
    const syncConfig = configService.getSyncConfig() || {};
    
    // Prioritize the device-specific order_prefix, fallback to global prefix or 'POS'
    const prefix = syncConfig.order_prefix || orderConfig.order_number_prefix || 'POS';
    const padLength = orderConfig.order_number_pad_length || 1;
    
    let resetDaily = true;
    if (orderConfig.order_number_reset_daily !== undefined) {
      const val = String(orderConfig.order_number_reset_daily).toLowerCase();
      resetDaily = val === 'true' || val === '1';
    }
    
    const template = orderConfig.order_number_template || '{PREFIX}-{SEQ}';

    const dateKey = resetDaily ? businessDate : 'GLOBAL';

    return dbEngine.transaction(() => {
      // Fetch or insert counter sequence
      let seqRow = dbEngine.prepare(`
        SELECT last_sequence FROM order_number_sequences 
        WHERE branch_id = ? AND business_date = ? AND prefix = ?
      `).get(branchId, dateKey, prefix);

      let nextSeq = 1;
      if (seqRow) {
        nextSeq = seqRow.last_sequence + 1;
        dbEngine.prepare(`
          UPDATE order_number_sequences 
          SET last_sequence = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE branch_id = ? AND business_date = ? AND prefix = ?
        `).run(nextSeq, branchId, dateKey, prefix);
      } else {
        dbEngine.prepare(`
          INSERT INTO order_number_sequences (id, branch_id, business_date, prefix, last_sequence)
          VALUES (?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(), branchId, dateKey, prefix, nextSeq);
      }

      const seqPadded = String(nextSeq).padStart(padLength, '0');
      const dateFormatted = businessDate.replace(/-/g, '');

      let orderNumber = template
        .replace('{PREFIX}', prefix)
        .replace('{YYYYMMDD}', dateFormatted)
        .replace('{BRANCH}', branchId)
        .replace('{SEQ}', seqPadded);

      // Verify uniqueness guard (in case of override)
      const existing = dbEngine.prepare('SELECT id FROM orders WHERE order_number = ?').get(orderNumber);
      if (existing) {
        // Fallback suffix if collision
        orderNumber = `${orderNumber}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      }

      return orderNumber;
    });
  }
}

export const orderNumberService = new OrderNumberService();
