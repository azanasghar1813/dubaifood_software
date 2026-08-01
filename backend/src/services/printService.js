import { printQueueService, PrintJobType } from './printQueueService.js';
import { receiptGeneratorService } from './receiptGeneratorService.js';
import { kitchenTicketGeneratorService } from './kitchenTicketGeneratorService.js';
import { printerManagerService } from './printerManagerService.js';
import { printerDriverService } from './printerDriverService.js';
import { printEngineService } from './printEngineService.js';
import { activityLogService } from './activityLogService.js';
import { syncService } from './syncService.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { orderItemRepository } from '../repositories/orderItemRepository.js';
import { orderPaymentRepository } from '../repositories/orderPaymentRepository.js';
import { paymentReceiptRepository } from '../repositories/paymentReceiptRepository.js';
import { configService } from './configService.js';

/**
 * PrintService — the public API for all print operations.
 *
 * This is the single entry point callers use. It:
 *   1. Resolves order/receipt data
 *   2. Generates the appropriate payload
 *   3. Enqueues a job via PrintQueueService
 *   4. Kicks the print engine to process immediately
 *
 * The caller (controller/payment service) NEVER waits for the physical
 * printer to respond. All printing is fire-and-forget from the API layer.
 */
class PrintService {
  // ──────────────────────────────────────────────────────────────────────────
  // Triggered by Payment Engine (the only coupling point)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Called after a successful payment. Enqueues all required print jobs.
   * This is the ONLY method PaymentService should call.
   *
   * Wrapped in try/catch — NEVER throws into the payment flow.
   *
   * @param {Object} order     - Hydrated order
   * @param {Object} payment   - Payment record
   * @param {Object} options   - { cashierUserId, branchId }
   */
  async onPaymentCompleted(order, payment, options = {}) {
    try {
      await this._enqueueReceiptJobs(order, payment, options);
      await this._enqueueKitchenTicketJobs(order, options);

      // Kick the engine immediately — don't wait for the 2s interval
      setImmediate(() => {
        printEngineService.processPendingJobs().catch(err =>
          console.error('[PrintService] Engine kick failed:', err.message)
        );
      });
    } catch (error) {
      // Log but NEVER propagate — order is already saved
      console.error('[PrintService] onPaymentCompleted failed (non-fatal):', error.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Manual / On-Demand Print Operations
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Manually trigger a customer receipt for an order.
   * Used by the print button in the POS/history UI.
   */
  async printReceipt(orderId, cashierUserId, options = {}) {
    const order = this._loadOrder(orderId);
    const receipts = paymentReceiptRepository.findByOrderId(orderId);

    if (receipts.length === 0) {
      throw new Error('No receipt found for this order. Payment may not be complete.');
    }

    const receipt = receipts[receipts.length - 1]; // most recent
    const printerConfig = configService.getReceiptConfig() || {};

    const printer = printerManagerService.getDefaultPrinterForJobType(PrintJobType.CUSTOMER_RECEIPT);
    const payload  = receiptGeneratorService.buildPrintPayload(receipt, {
      printerWidth: printer?.paper_width || 80,
      copies:       printerConfig.copies || 1,
      cashDrawer:   false,
    });

    const jobId = printQueueService.enqueue(
      PrintJobType.CUSTOMER_RECEIPT,
      printer?.id || null,
      payload,
      {
        orderId,
        orderNumber:    order.order_number,
        cashierUserId,
        shiftId:        order.shift_id,
        branchId:       order.branch_id,
        priority:       3,
      }
    );

    setImmediate(() => {
      printEngineService.processPendingJobs().catch(() => {});
    });

    return { job_id: jobId, status: 'ENQUEUED' };
  }

  /**
   * Reprint a receipt by job ID (permission-controlled by caller).
   */
  async reprintReceipt(originalJobId, cashierUserId, reason, options = {}) {
    const originalJob = printQueueService.findById(originalJobId);
    if (!originalJob) throw new Error('Original print job not found.');

    const orderId = originalJob.order_id;
    if (!orderId) throw new Error('Cannot reprint a non-order job.');

    const order = this._loadOrder(orderId);
    const receipts = paymentReceiptRepository.findByOrderId(orderId);
    if (receipts.length === 0) throw new Error('No receipt found for this order.');

    const receipt = receipts[receipts.length - 1];
    const printer = printerManagerService.getDefaultPrinterForJobType(PrintJobType.REPRINT_RECEIPT);
    const payload  = receiptGeneratorService.buildPrintPayload(receipt, {
      printerWidth: printer?.paper_width || 80,
    });

    // Mark it as a reprint
    if (payload.footer) payload.footer.show_reprint_label = true;

    const jobId = printQueueService.enqueue(
      PrintJobType.REPRINT_RECEIPT,
      printer?.id || null,
      payload,
      {
        orderId,
        orderNumber:  order.order_number,
        cashierUserId,
        shiftId:      order.shift_id,
        branchId:     order.branch_id,
        priority:     2,
      }
    );

    // Log reprint in audit trail
    const reprintCount = printQueueService.logReprint(
      jobId, originalJobId, orderId, cashierUserId, reason, order.branch_id
    );

    // Activity log
    activityLogService.logActivity(cashierUserId, 'RECEIPT_REPRINTED', 'PRINT', jobId, {
      order_id:       orderId,
      order_number:   order.order_number,
      reprint_count:  reprintCount,
      reason,
    });

    // Sync event
    syncService.queueSyncEvent('PRINT', jobId, 'REPRINT_EVENT', {
      order_id:       orderId,
      order_number:   order.order_number,
      reprint_count:  reprintCount,
      reason,
    });

    setImmediate(() => {
      printEngineService.processPendingJobs().catch(() => {});
    });

    return { job_id: jobId, reprint_count: reprintCount, status: 'ENQUEUED' };
  }

  /**
   * Print kitchen tickets for an order.
   */
  async printKitchenTickets(orderId, cashierUserId, options = {}) {
    const order = this._loadOrder(orderId);
    const tickets = kitchenTicketGeneratorService.generateTickets(order);

    if (tickets.length === 0) {
      return { job_ids: [], count: 0, message: 'No kitchen items to print.' };
    }

    const jobIds = [];

    for (const ticket of tickets) {
      const stationType = ticket.station?.station_type || 'GENERAL';
      const printer = this._resolveKitchenPrinter(stationType);

      const jobId = printQueueService.enqueue(
        PrintJobType.KITCHEN_TICKET,
        printer?.id || null,
        ticket,
        {
          orderId,
          orderNumber:  order.order_number,
          cashierUserId,
          shiftId:      order.shift_id,
          branchId:     order.branch_id,
          priority:     1, // Kitchen tickets are highest priority
        }
      );
      jobIds.push(jobId);
    }

    setImmediate(() => {
      printEngineService.processPendingJobs().catch(() => {});
    });

    return { job_ids: jobIds, count: jobIds.length, status: 'ENQUEUED' };
  }

  /**
   * Open the cash drawer via the receipt printer.
   */
  async openCashDrawer(cashierUserId, options = {}) {
    const printer = printerManagerService.getDefaultPrinterForJobType(PrintJobType.CASH_DRAWER);

    if (!printer) {
      throw new Error('No cash drawer printer configured.');
    }

    if (!printer.cash_drawer_enabled) {
      throw new Error('Cash drawer is not enabled on the configured printer.');
    }

    const result = await printerDriverService.openCashDrawer(printer);

    activityLogService.logActivity(cashierUserId, 'CASH_DRAWER_OPENED', 'PRINT', printer.id, {
      printer_name: printer.name,
      success:      result.success,
    });

    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Queue Queries
  // ──────────────────────────────────────────────────────────────────────────

  getQueue(filters, page, limit) {
    return printQueueService.list(filters, page, limit);
  }

  getJobById(jobId) {
    return printQueueService.findById(jobId);
  }

  getJobsByOrder(orderId) {
    return printQueueService.findByOrderId(orderId);
  }

  getQueueStats(branchId) {
    return printQueueService.getStats(branchId);
  }

  getReprintLog(orderId) {
    return printQueueService.getReprintLog(orderId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal helpers — fired by onPaymentCompleted
  // ──────────────────────────────────────────────────────────────────────────

  async _enqueueReceiptJobs(order, payment, options) {
    const printerConfig = configService.getReceiptConfig() || {};
    const printer = printerManagerService.getDefaultPrinterForJobType(PrintJobType.CUSTOMER_RECEIPT);

    const payload = receiptGeneratorService.buildFromOrder(order, payment, {
      printerWidth: printer?.paper_width || 80,
      copies:       printerConfig.copies || 1,
      cashDrawer:   printer?.cash_drawer_enabled === 1 || printerConfig.open_cash_drawer === true,
      showQr:       true,
      showBarcode:  true,
    });

    printQueueService.enqueue(
      PrintJobType.CUSTOMER_RECEIPT,
      printer?.id || null,
      payload,
      {
        orderId:      order.id,
        orderNumber:  order.order_number,
        cashierUserId: options.cashierUserId || order.cashier_user_id,
        shiftId:      order.shift_id,
        branchId:     order.branch_id,
        priority:     2,
      }
    );
  }

  async _enqueueKitchenTicketJobs(order, options) {
    const tickets = kitchenTicketGeneratorService.generateTickets(order);
    if (!tickets.length) return;

    for (const ticket of tickets) {
      const stationType = ticket.station?.station_type || 'GENERAL';
      const printer = this._resolveKitchenPrinter(stationType);

      printQueueService.enqueue(
        PrintJobType.KITCHEN_TICKET,
        printer?.id || null,
        ticket,
        {
          orderId:      order.id,
          orderNumber:  order.order_number,
          cashierUserId: options.cashierUserId || order.cashier_user_id,
          shiftId:      order.shift_id,
          branchId:     order.branch_id,
          priority:     1,
        }
      );
    }
  }

  _resolveKitchenPrinter(stationType) {
    // Try to find a printer whose station_type matches
    const printer = printerManagerService.getDefaultPrinterForJobType('KITCHEN_TICKET');
    return printer;
  }

  _loadOrder(orderId) {
    const order = orderRepository.findById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);
    order.items = orderItemRepository.findItemsByOrderId(orderId);
    order.payments = orderPaymentRepository.findByOrderId(orderId);
    return order;
  }
}

export const printService = new PrintService();
