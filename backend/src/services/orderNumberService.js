import { dbEngine } from '../database/sqlite.js';
import { configService } from './configService.js';
import crypto from 'crypto';
import { buildReceiptOrderNumber, parseTicketSeq, SHARED_TICKET_PREFIX } from '../utils/receiptOrderNumber.js';
import { dateUtils } from '../utils/dateUtils.js';
import config from '../config/index.js';

class OrderNumberService {
  _dateKey(resetDaily, businessDate) {
    return resetDaily ? businessDate : 'GLOBAL';
  }

  _resetDaily() {
    const orderConfig = configService.getOrderConfig() || {};
    if (orderConfig.order_number_reset_daily === undefined) return true;
    const val = String(orderConfig.order_number_reset_daily).toLowerCase();
    return val === 'true' || val === '1';
  }

  maxKnownSeq(branchId = 'DEFAULT_BRANCH', businessDate = null) {
    if (!businessDate) businessDate = dateUtils.getBusinessDate();
    const dateKey = this._dateKey(this._resetDaily(), businessDate);
    let max = 0;
    try {
      const rows = dbEngine.prepare(`
        SELECT last_sequence FROM order_number_sequences
        WHERE branch_id = ? AND business_date = ?
      `).all(branchId, dateKey);
      for (const row of rows) max = Math.max(max, Number(row.last_sequence) || 0);
    } catch { /* table may not exist */ }
    try {
      const orders = dbEngine.prepare('SELECT order_number FROM orders WHERE business_date = ?').all(businessDate);
      for (const order of orders) max = Math.max(max, parseTicketSeq(order.order_number));
    } catch { /* ignore */ }
    return max;
  }

  _setLocalSeq(branchId, dateKey, seq) {
    const prefix = SHARED_TICKET_PREFIX;
    const row = dbEngine.prepare(`
      SELECT last_sequence FROM order_number_sequences
      WHERE branch_id = ? AND business_date = ? AND prefix = ?
    `).get(branchId, dateKey, prefix);
    if (!row) {
      dbEngine.prepare(`
        INSERT INTO order_number_sequences (id, branch_id, business_date, prefix, last_sequence)
        VALUES (?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), branchId, dateKey, prefix, seq);
      return;
    }
    if (Number(row.last_sequence) >= seq) return;
    dbEngine.prepare(`
      UPDATE order_number_sequences
      SET last_sequence = ?, updated_at = CURRENT_TIMESTAMP
      WHERE branch_id = ? AND business_date = ? AND prefix = ?
    `).run(seq, branchId, dateKey, prefix);
  }

  absorbPulledNumbers(businessDate = null) {
    if (!businessDate) businessDate = dateUtils.getBusinessDate();
    const branchId = 'DEFAULT_BRANCH';
    const dateKey = this._dateKey(this._resetDaily(), businessDate);
    const max = this.maxKnownSeq(branchId, businessDate);
    if (max > 0) this._setLocalSeq(branchId, dateKey, max);
    return max;
  }

  _localNextSeq(branchId, businessDate) {
    const resetDaily = this._resetDaily();
    const dateKey = this._dateKey(resetDaily, businessDate);
    const minKnown = this.maxKnownSeq(branchId, businessDate);
    const prefix = SHARED_TICKET_PREFIX;
    return dbEngine.transaction(() => {
      let seqRow = dbEngine.prepare(`
        SELECT last_sequence FROM order_number_sequences
        WHERE branch_id = ? AND business_date = ? AND prefix = ?
      `).get(branchId, dateKey, prefix);
      let nextSeq = Math.max(minKnown, seqRow ? Number(seqRow.last_sequence) : 0) + 1;
      if (seqRow) {
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
      return nextSeq;
    });
  }

  _syncHeaders() {
    const terminalId = configService.getSyncConfig()?.device_id || 'POS';
    return {
      'Content-Type': 'application/json',
      'x-device-secret': config.sync.deviceSecret,
      'x-terminal-id': terminalId
    };
  }

  async _cloudAllocate(branchId, businessDate, minSequence) {
    if (process.env.NODE_ENV === 'test' || !config.sync?.apiUrl) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(`${config.sync.apiUrl}/sync/allocate-number`, {
        method: 'POST',
        headers: this._syncHeaders(),
        body: JSON.stringify({
          branch_id: branchId,
          business_date: businessDate,
          min_sequence: minSequence
        }),
        signal: controller.signal
      });
      if (!response.ok) return null;
      const body = await response.json();
      const seq = Number(body?.data?.sequence ?? body?.sequence);
      return Number.isFinite(seq) && seq > 0 ? seq : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async _cloudPeek(branchId, businessDate, minSequence) {
    if (process.env.NODE_ENV === 'test' || !config.sync?.apiUrl) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    try {
      const qs = new URLSearchParams({
        branch_id: branchId,
        business_date: businessDate,
        min_sequence: String(minSequence || 0)
      });
      const response = await fetch(`${config.sync.apiUrl}/sync/peek-number?${qs}`, {
        headers: this._syncHeaders(),
        signal: controller.signal
      });
      if (!response.ok) return null;
      const body = await response.json();
      const seq = Number(body?.data?.next_sequence ?? body?.next_sequence);
      return Number.isFinite(seq) && seq > 0 ? seq : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  _format(seq, businessDate) {
    const resetDaily = this._resetDaily();
    return buildReceiptOrderNumber(SHARED_TICKET_PREFIX, seq, resetDaily ? businessDate : null);
  }

  _takeUnused(branchId, businessDate, seq) {
    let nextSeq = seq;
    let orderNumber = this._format(nextSeq, businessDate);
    const dateKey = this._dateKey(this._resetDaily(), businessDate);
    while (dbEngine.prepare('SELECT id FROM orders WHERE order_number = ?').get(orderNumber)) {
      nextSeq += 1;
      this._setLocalSeq(branchId, dateKey, nextSeq);
      orderNumber = this._format(nextSeq, businessDate);
    }
    return orderNumber;
  }

  /**
   * Shared ticket number. Cloud counter when online; local fallback when offline.
   */
  async allocateNextNumber(branchId = 'DEFAULT_BRANCH', businessDate = null) {
    if (!businessDate) businessDate = dateUtils.getBusinessDate();
    const minKnown = this.maxKnownSeq(branchId, businessDate);
    const cloudSeq = await this._cloudAllocate(branchId, businessDate, minKnown);
    const dateKey = this._dateKey(this._resetDaily(), businessDate);
    let seq;
    if (cloudSeq) {
      seq = cloudSeq;
      this._setLocalSeq(branchId, dateKey, seq);
    } else {
      seq = this._localNextSeq(branchId, businessDate);
    }
    return this._takeUnused(branchId, businessDate, seq);
  }

  generateNextNumber(branchId = 'DEFAULT_BRANCH', businessDate = null) {
    if (!businessDate) businessDate = dateUtils.getBusinessDate();
    const seq = this._localNextSeq(branchId, businessDate);
    return this._takeUnused(branchId, businessDate, seq);
  }

  async peekNextNumber(branchId = 'DEFAULT_BRANCH', businessDate = null) {
    if (!businessDate) businessDate = dateUtils.getBusinessDate();
    const minKnown = this.maxKnownSeq(branchId, businessDate);
    const cloudNext = await this._cloudPeek(branchId, businessDate, minKnown);
    const nextSeq = Math.max(minKnown + 1, cloudNext || 0);
    return this._format(nextSeq, businessDate);
  }

  peekNextNumberSync(branchId = 'DEFAULT_BRANCH', businessDate = null) {
    if (!businessDate) businessDate = dateUtils.getBusinessDate();
    const nextSeq = this.maxKnownSeq(branchId, businessDate) + 1;
    return this._format(nextSeq, businessDate);
  }
}

export const orderNumberService = new OrderNumberService();
