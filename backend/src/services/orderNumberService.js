import { dbEngine } from '../database/sqlite.js';
import { configService } from './configService.js';
import crypto from 'crypto';
import { buildReceiptOrderNumber, parseTicketSeq, normalizeOrderTypePrefix, SHARED_TICKET_PREFIX } from '../utils/receiptOrderNumber.js';
import { dateUtils } from '../utils/dateUtils.js';
import { LAN_SHARED_SECRET } from '../config/lanSecret.js';

class OrderNumberService {
  _dateKey(resetDaily, businessDate) {
    return resetDaily ? businessDate : 'GLOBAL';
  }

  resolveDateKey(businessDate) {
    return this._dateKey(this._resetDaily(), businessDate || dateUtils.getBusinessDate());
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
        WHERE branch_id = ? AND date_key = ?
      `).all(branchId, dateKey);
      for (const row of rows) max = Math.max(max, Number(row.last_sequence) || 0);
    } catch { /* table may not exist */ }
    try {
      const orders = dbEngine.prepare(`
        SELECT order_number FROM orders 
        WHERE business_date = ?
      `).all(businessDate);
      for (const order of orders) max = Math.max(max, parseTicketSeq(order.order_number));
      max = Math.max(max, orders.length);
    } catch { /* ignore */ }
    return max;
  }

  _setLocalSeq(branchId, dateKey, seq) {
    const row = dbEngine.prepare(`
      SELECT last_sequence FROM order_number_sequences
      WHERE branch_id = ? AND date_key = ? AND prefix = ?
    `).get(branchId, dateKey, SHARED_TICKET_PREFIX);
    if (!row) {
      dbEngine.prepare(`
        INSERT INTO order_number_sequences (branch_id, date_key, prefix, last_sequence)
        VALUES (?, ?, ?, ?)
      `).run(branchId, dateKey, SHARED_TICKET_PREFIX, seq);
      return;
    }
    if (Number(row.last_sequence) >= seq) return;
    dbEngine.prepare(`
      UPDATE order_number_sequences
      SET last_sequence = ?, updated_at = CURRENT_TIMESTAMP
      WHERE branch_id = ? AND date_key = ? AND prefix = ?
    `).run(seq, branchId, dateKey, SHARED_TICKET_PREFIX);
  }

  _localNextSeq(branchId, businessDate) {
    const resetDaily = this._resetDaily();
    const dateKey = this._dateKey(resetDaily, businessDate);
    const minKnown = this.maxKnownSeq(branchId, businessDate);
    return dbEngine.transaction(() => {
      let seqRow = dbEngine.prepare(`
        SELECT last_sequence FROM order_number_sequences
        WHERE branch_id = ? AND date_key = ? AND prefix = ?
      `).get(branchId, dateKey, SHARED_TICKET_PREFIX);
      let nextSeq = Math.max(minKnown, seqRow ? Number(seqRow.last_sequence) : 0) + 1;
      if (seqRow) {
        dbEngine.prepare(`
          UPDATE order_number_sequences
          SET last_sequence = ?, updated_at = CURRENT_TIMESTAMP
          WHERE branch_id = ? AND date_key = ? AND prefix = ?
        `).run(nextSeq, branchId, dateKey, SHARED_TICKET_PREFIX);
      } else {
        dbEngine.prepare(`
          INSERT INTO order_number_sequences (branch_id, date_key, prefix, last_sequence)
          VALUES (?, ?, ?, ?)
        `).run(branchId, dateKey, SHARED_TICKET_PREFIX, nextSeq);
      }
      return nextSeq;
    });
  }

  _tempNextSeq(deviceId, businessDate) {
    const dateKey = this._dateKey(this._resetDaily(), businessDate || dateUtils.getBusinessDate());
    const pfx = `TEMP_${SHARED_TICKET_PREFIX}`;
    return dbEngine.transaction(() => {
      const branchId = deviceId;
      let seqRow = dbEngine.prepare(`
        SELECT last_sequence FROM order_number_sequences
        WHERE branch_id = ? AND date_key = ? AND prefix = ?
      `).get(branchId, dateKey, pfx);
      let nextSeq = seqRow ? Math.max(2000, Number(seqRow.last_sequence) + 1) : 2000;
      if (seqRow) {
        dbEngine.prepare(`
          UPDATE order_number_sequences
          SET last_sequence = ?, updated_at = CURRENT_TIMESTAMP
          WHERE branch_id = ? AND date_key = ? AND prefix = ?
        `).run(nextSeq, branchId, dateKey, pfx);
      } else {
        dbEngine.prepare(`
          INSERT INTO order_number_sequences (branch_id, date_key, prefix, last_sequence)
          VALUES (?, ?, ?, ?)
        `).run(branchId, dateKey, pfx, nextSeq);
      }
      return nextSeq;
    });
  }

  _allocateBlock(branchId, businessDate, count) {
    const dateKey = this._dateKey(this._resetDaily(), businessDate);
    const minKnown = this.maxKnownSeq(branchId, businessDate);
    return dbEngine.transaction(() => {
      let seqRow = dbEngine.prepare(`
        SELECT last_sequence FROM order_number_sequences
        WHERE branch_id = ? AND date_key = ? AND prefix = ?
      `).get(branchId, dateKey, SHARED_TICKET_PREFIX);
      let currentMax = Math.max(minKnown, seqRow ? Number(seqRow.last_sequence) : 0);
      let rangeStart = currentMax + 1;
      let rangeEnd = currentMax + count;
      if (seqRow) {
        dbEngine.prepare(`
          UPDATE order_number_sequences
          SET last_sequence = ?, updated_at = CURRENT_TIMESTAMP
          WHERE branch_id = ? AND date_key = ? AND prefix = ?
        `).run(rangeEnd, branchId, dateKey, SHARED_TICKET_PREFIX);
      } else {
        dbEngine.prepare(`
          INSERT INTO order_number_sequences (branch_id, date_key, prefix, last_sequence)
          VALUES (?, ?, ?, ?)
        `).run(branchId, dateKey, SHARED_TICKET_PREFIX, rangeEnd);
      }
      return { rangeStart, rangeEnd };
    });
  }

  _getHubBaseUrl() {
    const config = configService.getSyncConfig();
    return `http://${config.hub_ip}:${config.hub_port || 5000}/api/lan-hub`;
  }

  _hubHeaders(config) {
    return {
      'Content-Type': 'application/json',
      'x-terminal-id': config.device_id || 'TERMINAL',
      'x-lan-secret': LAN_SHARED_SECRET
    };
  }

  async _hubAllocate(branchId, businessDate, minKnown, prefix = 'DINE_IN') {
    const config = configService.getSyncConfig();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.hub_timeout_ms || 400);
      const res = await fetch(`${this._getHubBaseUrl()}/allocate-number`, {
        method: 'POST',
        headers: this._hubHeaders(config),
        body: JSON.stringify({ branch_id: branchId, business_date: businessDate, min_sequence: minKnown, order_type: prefix }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const json = await res.json();
      return json.success && json.order_number ? json.order_number : null;
    } catch {
      return null;
    }
  }

  _format(seq, businessDate, prefix = 'DINE_IN') {
    const resetDaily = this._resetDaily();
    const pfx = normalizeOrderTypePrefix(prefix);
    return buildReceiptOrderNumber(pfx, seq, resetDaily ? businessDate : null);
  }

  _takeUnused(branchId, businessDate, seq, prefix = 'DINE_IN') {
    let nextSeq = seq;
    const pfx = normalizeOrderTypePrefix(prefix);
    let orderNumber = this._format(nextSeq, businessDate, pfx);
    const dateKey = this._dateKey(this._resetDaily(), businessDate);
    while (dbEngine.prepare('SELECT id FROM orders WHERE order_number = ?').get(orderNumber)) {
      nextSeq += 1;
      this._setLocalSeq(branchId, dateKey, nextSeq);
      orderNumber = this._format(nextSeq, businessDate, pfx);
    }
    return orderNumber;
  }

  async allocateNextNumber(branchId = 'DEFAULT_BRANCH', businessDate = null, orderType = 'DINE_IN') {
    if (!businessDate) businessDate = dateUtils.getBusinessDate();
    const config = configService.getSyncConfig();
    const pfx = normalizeOrderTypePrefix(orderType);

    if (config.device_role === 'HUB') {
      const seq = this._localNextSeq(branchId, businessDate);
      return this._takeUnused(branchId, businessDate, seq, pfx);
    }

    // TERMINAL: ask the Hub live over LAN first
    const minKnown = this.maxKnownSeq(branchId, businessDate);
    const hubOrderNumber = await this._hubAllocate(branchId, businessDate, minKnown, pfx);
    if (hubOrderNumber) return hubOrderNumber;

    // Hub unreachable: local TEMP number, will be reassigned by Hub on sync
    const seq = this._tempNextSeq(config.device_id || 'POS', businessDate);
    return this._format(seq, businessDate, pfx);
  }

  generateNextNumber(branchId = 'DEFAULT_BRANCH', businessDate = null, orderType = 'DINE_IN') {
    if (!businessDate) businessDate = dateUtils.getBusinessDate();
    const pfx = normalizeOrderTypePrefix(orderType);
    const seq = this._localNextSeq(branchId, businessDate);
    return this._takeUnused(branchId, businessDate, seq, pfx);
  }

  async peekNextNumber(branchId = 'DEFAULT_BRANCH', businessDate = null, orderType = 'DINE_IN') {
    if (!businessDate) businessDate = dateUtils.getBusinessDate();
    const config = configService.getSyncConfig();
    const pfx = normalizeOrderTypePrefix(orderType);
    if (config.device_role === 'HUB') {
      return this._format(this.maxKnownSeq(branchId, businessDate) + 1, businessDate, pfx);
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.hub_timeout_ms || 400);
      const res = await fetch(`${this._getHubBaseUrl()}/allocate-number`, {
        method: 'POST',
        headers: this._hubHeaders(config),
        body: JSON.stringify({ branch_id: branchId, business_date: businessDate, order_type: pfx, peek: true }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (json.success && json.order_number) return json.order_number;
    } catch { /* fall through */ }
    return this._format(this.maxKnownSeq(branchId, businessDate) + 1, businessDate, pfx);
  }

  peekNextNumberSync(branchId = 'DEFAULT_BRANCH', businessDate = null, orderType = 'DINE_IN') {
    if (!businessDate) businessDate = dateUtils.getBusinessDate();
    const pfx = normalizeOrderTypePrefix(orderType);
    return this._format(this.maxKnownSeq(branchId, businessDate) + 1, businessDate, pfx);
  }
}

export const orderNumberService = new OrderNumberService();
