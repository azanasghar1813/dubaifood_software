import crypto from 'crypto';
import { dbEngine } from '../database/sqlite.js';
import { activityLogService } from './activityLogService.js';
import { cashierSessionRepository } from '../repositories/cashierSessionRepository.js';

class ShiftService {
  startShift(userId, openingFloat, terminalId = 'Main Till #1') {
    const activeSession = cashierSessionRepository.findOpenSessionForUser(userId);

    if (activeSession) {
      throw new Error('User already has an open shift.');
    }

    const sessionId = `SH-${Date.now().toString().slice(-6)}`;
    
    dbEngine.prepare(`
      INSERT INTO cashier_sessions (id, user_id, terminal_id, opening_float, status)
      VALUES (?, ?, ?, ?, 'OPEN')
    `).run(sessionId, userId, terminalId, openingFloat);

    activityLogService.logActivity(userId, 'SHIFT_STARTED', 'SESSION', sessionId, { openingFloat, terminalId });

    return this.getActiveShift(userId);
  }

  getActiveShift(userId) {
    const session = cashierSessionRepository.findOpenSessionForUser(userId);
    if (!session) return null;

    return this.enrichShiftData(session);
  }

  addCashDrop(sessionId, userId, amount, reason, destination) {
    const dropId = `CD-${Date.now().toString().slice(-6)}`;
    dbEngine.prepare(`
      INSERT INTO cash_drops (id, session_id, amount, reason, destination)
      VALUES (?, ?, ?, ?, ?)
    `).run(dropId, sessionId, amount, reason, destination);

    activityLogService.logActivity(userId, 'CASH_DROP', 'SESSION', sessionId, { amount, reason, destination });

    return dropId;
  }

  addPaidOut(sessionId, userId, amount, purpose, approvedBy) {
    const poId = `PO-${Date.now().toString().slice(-6)}`;
    dbEngine.prepare(`
      INSERT INTO paid_outs (id, session_id, amount, purpose, approved_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(poId, sessionId, amount, purpose, approvedBy);

    activityLogService.logActivity(userId, 'PAID_OUT', 'SESSION', sessionId, { amount, purpose, approvedBy });

    return poId;
  }

  closeShift(sessionId, userId, countedCash, discrepancyNotes) {
    const session = cashierSessionRepository.findById(sessionId);
    if (!session || session.status === 'CLOSED') {
      throw new Error('Shift not found or already closed.');
    }

    const enriched = this.enrichShiftData(session);
    const expectedCash = enriched.expectedCash;
    const difference = countedCash - expectedCash;

    dbEngine.prepare(`
      UPDATE cashier_sessions 
      SET closed_at = CURRENT_TIMESTAMP, 
          status = 'CLOSED',
          actual_cash = ?,
          expected_cash = ?,
          difference = ?,
          notes = ?
      WHERE id = ?
    `).run(countedCash, expectedCash, difference, discrepancyNotes, sessionId);

    activityLogService.logActivity(userId, 'SHIFT_CLOSED', 'SESSION', sessionId, { countedCash, expectedCash, difference });

    return this.getShiftHistory();
  }

  getShiftHistory(sessionId = null) {
    let query = `
      SELECT cs.*, u.first_name, u.last_name, u.username
      FROM cashier_sessions cs
      LEFT JOIN users u ON cs.user_id = u.id
      WHERE cs.status = 'CLOSED'
    `;
    const params = [];

    if (sessionId) {
      query += ` AND cs.id = ?`;
      params.push(sessionId);
    }

    query += ` ORDER BY cs.closed_at DESC LIMIT 50`;

    const history = dbEngine.prepare(query).all(...params);
    
    return history.map(h => {
      const name = `${h.first_name || ''} ${h.last_name || ''}`.trim() || h.username || h.user_id;
      return {
        id: h.id,
        date: h.opened_at,
        cashier: name,
        till: h.terminal_id || 'Main Till #1',
        openingFloat: h.opening_float,
        expectedCash: h.expected_cash || 0,
        actualCash: h.actual_cash || 0,
        difference: h.difference || 0,
        shiftTime: h.closed_at ? h.closed_at : 'Unknown',
        status: (h.difference || 0) === 0 ? 'Balanced' : 'Discrepancy'
      };
    });
  }

  enrichShiftData(session) {
    const cashDrops = dbEngine.prepare('SELECT * FROM cash_drops WHERE session_id = ? ORDER BY created_at DESC').all(session.id);
    const paidOuts = dbEngine.prepare('SELECT * FROM paid_outs WHERE session_id = ? ORDER BY created_at DESC').all(session.id);

    const orders = dbEngine.prepare(`
      SELECT * FROM orders 
      WHERE created_at >= ? 
      AND (created_at <= ? OR ? IS NULL)
      AND cashier_id = ?
    `).all(session.opened_at, session.closed_at, session.closed_at, session.user_id);

    let cashSales = 0;
    let onlineSales = 0;
    let refunds = 0;
    let discounts = 0;

    orders.forEach(order => {
      if (order.status === 'Refunded' || order.status === 'Cancelled') {
        refunds += order.total_amount || 0;
      } else {
        if (order.payment_method === 'Cash') {
          cashSales += order.total_amount || 0;
        } else {
          onlineSales += order.total_amount || 0;
        }
      }
      discounts += order.discount_total || 0;
    });

    const totalCashDrops = cashDrops.reduce((acc, cd) => acc + cd.amount, 0);
    const totalPaidOuts = paidOuts.reduce((acc, po) => acc + po.amount, 0);

    const expectedCash = session.opening_float + cashSales - refunds - totalCashDrops - totalPaidOuts;

    const shiftActivities = dbEngine.prepare(`
      SELECT * FROM activity_logs 
      WHERE entity_id = ? 
      ORDER BY created_at DESC
    `).all(session.id);

    return {
      id: session.id,
      userId: session.user_id,
      openedAt: session.opened_at,
      openingFloat: session.opening_float,
      terminalId: session.terminal_id,
      metrics: {
        cashSales,
        onlineSales,
        refunds,
        discounts,
        totalOrders: orders.length,
        totalCashDrops,
        totalPaidOuts
      },
      expectedCash,
      cashDrops: cashDrops.map(c => ({
        id: c.id,
        time: c.created_at,
        amount: c.amount,
        reason: c.reason,
        destination: c.destination,
        printed: true
      })),
      paidOuts: paidOuts.map(p => ({
        id: p.id,
        time: p.created_at,
        purpose: p.purpose,
        amount: p.amount,
        approvedBy: p.approved_by
      })),
      transactions: orders.slice(0, 50).map(o => ({
        time: o.created_at,
        orderNo: o.order_number,
        customer: o.customer_name || 'Guest',
        paymentMethod: o.payment_method,
        amount: o.total_amount,
        cashier: session.user_id,
        status: o.status
      })),
      shiftActivities: shiftActivities.map(act => ({
        id: act.id,
        time: act.created_at,
        type: act.action,
        description: (() => {
           let details = {};
           try { details = JSON.parse(act.details); } catch(e) {}
           if (act.action === 'SHIFT_STARTED') return `Shift opened with float Rs. ${details.openingFloat}`;
           if (act.action === 'CASH_DROP') return `Dropped Rs. ${details.amount} to ${details.destination}`;
           if (act.action === 'PAID_OUT') return `Paid Rs. ${details.amount} for ${details.purpose}`;
           if (act.action === 'SHIFT_CLOSED') return `Shift closed. Expected: ${details.expectedCash}, Counted: ${details.countedCash}`;
           return act.action;
        })(),
        severity: 'info'
      }))
    };
  }
}

export const shiftService = new ShiftService();
