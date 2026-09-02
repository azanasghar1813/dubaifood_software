import { dbEngine } from '../database/sqlite.js';
import { configService } from './configService.js';
import crypto from 'crypto';
import { buildReceiptOrderNumber } from '../utils/receiptOrderNumber.js';
import { dateUtils } from '../utils/dateUtils.js';

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
      businessDate = dateUtils.getBusinessDate();
    }

    const orderConfig = configService.getOrderConfig() || {};
    const syncConfig = configService.getSyncConfig() || {};
    
    // Keep the stored prefix as-is (PC-A, PCA, …) so existing tills are not remapped.
    let prefix = syncConfig.order_prefix || orderConfig.order_number_prefix || 'POS';
    if (/^T[0-9A-F]{2}$/i.test(String(prefix))) prefix = 'POS';

    let resetDaily = true;
    if (orderConfig.order_number_reset_daily !== undefined) {
      const val = String(orderConfig.order_number_reset_daily).toLowerCase();
      resetDaily = val === 'true' || val === '1';
    }

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

      let orderNumber = buildReceiptOrderNumber(prefix, nextSeq, resetDaily ? businessDate : null);

      while (dbEngine.prepare('SELECT id FROM orders WHERE order_number = ?').get(orderNumber)) {
        nextSeq += 1;
        dbEngine.prepare(`
          UPDATE order_number_sequences
          SET last_sequence = ?, updated_at = CURRENT_TIMESTAMP
          WHERE branch_id = ? AND business_date = ? AND prefix = ?
        `).run(nextSeq, branchId, dateKey, prefix);
        orderNumber = buildReceiptOrderNumber(prefix, nextSeq, resetDaily ? businessDate : null);
      }

      return orderNumber;
    });
  }

  peekNextNumber(branchId = 'DEFAULT_BRANCH', businessDate = null) {
    if (!businessDate) {
      businessDate = dateUtils.getBusinessDate();
    }
    const orderConfig = configService.getOrderConfig() || {};
    const syncConfig = configService.getSyncConfig() || {};
    let prefix = syncConfig.order_prefix || orderConfig.order_number_prefix || 'POS';
    if (/^T[0-9A-F]{2}$/i.test(String(prefix))) prefix = 'POS';
    let resetDaily = true;
    if (orderConfig.order_number_reset_daily !== undefined) {
      const val = String(orderConfig.order_number_reset_daily).toLowerCase();
      resetDaily = val === 'true' || val === '1';
    }
    const dateKey = resetDaily ? businessDate : 'GLOBAL';
    const seqRow = dbEngine.prepare(`
      SELECT last_sequence FROM order_number_sequences
      WHERE branch_id = ? AND business_date = ? AND prefix = ?
    `).get(branchId, dateKey, prefix);
    const nextSeq = seqRow ? seqRow.last_sequence + 1 : 1;
    return buildReceiptOrderNumber(prefix, nextSeq, resetDaily ? businessDate : null);
  }
}

export const orderNumberService = new OrderNumberService();
