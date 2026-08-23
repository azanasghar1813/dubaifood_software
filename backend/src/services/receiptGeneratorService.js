import { configService } from './configService.js';

/**
 * ReceiptGeneratorService
 *
 * Generates the complete, immutable receipt payload from a hydrated order
 * and its payment record. This is the canonical receipt document.
 *
 * The payload is used for:
 *   - Thermal printing (via PrintEngineService)
 *   - On-screen preview (ReceiptPreview component)
 *   - Future: Email, WhatsApp, PDF — all consume the same payload
 *
 * IMPORTANT: This service MUST NOT be called inside a payment transaction.
 * The payment transaction calls receiptService.generateReceiptPayload() directly.
 * This service generates an ENHANCED version from a saved receipt record for
 * printing purposes.
 */
class ReceiptGeneratorService {
  /**
   * Builds a full print-ready receipt payload from a stored receipt document.
   * Called by the Print Engine when processing a CUSTOMER_RECEIPT job.
   *
   * @param {Object} receiptRecord - Row from payment_receipts table (payload already parsed)
   * @param {Object} options       - { copies, printerWidth, showBarcode, showQr }
   * @returns {Object}             - Print-ready receipt payload
   */
  buildPrintPayload(receiptRecord, options = {}) {
    const payload = typeof receiptRecord.payload === 'string'
      ? JSON.parse(receiptRecord.payload)
      : receiptRecord.payload;

    const printerWidth = options.printerWidth || 80; // mm
    const copies = options.copies || 1;
    const charWidth = printerWidth === 58 ? 32 : 48; // characters per line

    return {
      schema_version: payload.schema_version || '1.0',
      receipt_id: receiptRecord.id,
      receipt_number: receiptRecord.receipt_number,
      generated_at: receiptRecord.generated_at,
      print_count: (receiptRecord.print_count || 0) + 1,
      is_reprint: (receiptRecord.print_count || 0) > 0,

      // Printer directives
      printer: {
        width_mm: printerWidth,
        char_width: charWidth,
        copies,
        auto_cut: options.autoCut !== false,
        cash_drawer: options.cashDrawer === true,
      },

      // Business header
      business: payload.business || {},

      // Order info
      order: payload.order || {},

      // Line items with all modifiers/addons
      items: this._formatLineItems(payload.items || []),

      // Financial summary
      financials: payload.financials || {},

      // Payment details
      payment: payload.payment || {},

      // Footer elements
      footer: {
        text: payload.business?.receipt_footer || 'Thank you for your visit!',
        qr: options.showQr !== false ? (payload.qr || null) : null,
        barcode: options.showBarcode !== false ? this._buildBarcode(payload.order) : null,
        show_reprint_label: (receiptRecord.print_count || 0) > 0,
      },

      // Raw notes
      notes: payload.notes || null,
    };
  }

  /**
   * Builds a receipt payload directly from an order + payment for immediate printing.
   * Used when generating a fresh receipt (not from a stored record).
   *
   * @param {Object} order   - Hydrated order
   * @param {Object} payment - Payment record
   * @param {Object} options - Printer options
   */
  buildFromOrder(order, payment, options = {}) {
    const businessProfile = configService.getBusinessProfile() || {};
    const financeConfig = configService.getFinanceConfig() || {};
    const receiptConfig = configService.getReceiptConfig() || {};

    const printerWidth = options.printerWidth || 80;
    const charWidth = printerWidth === 58 ? 32 : 48;

    return {
      schema_version: '1.0',
      receipt_number: order.order_number,
      generated_at: new Date().toISOString(),
      print_count: 1,
      is_reprint: false,

      printer: {
        width_mm: printerWidth,
        char_width: charWidth,
        copies: options.copies || 1,
        auto_cut: options.autoCut !== false,
        cash_drawer: options.cashDrawer === true,
      },

      business: {
        name: businessProfile.business_name || 'Restaurant',
        branch: businessProfile.branch_name || '',
        address: businessProfile.address || '',
        phone: businessProfile.phone || '',
        email: businessProfile.email || '',
        tax_id: businessProfile.tax_id || '',
        logo_url: businessProfile.logo_url || null,
        receipt_header: receiptConfig.header_text || '',
        receipt_footer: receiptConfig.footer_text || 'Thank you for your visit!',
      },

      order: {
        order_id: order.id,
        order_number: order.order_number,
        order_type: order.order_type,
        table_id: order.table_id || null,
        customer_id: order.customer_id || null,
        is_vip: order.customer?.is_vip || order.is_vip || (order.metadata && String(order.metadata.is_vip) === 'true') || false,
        business_date: order.business_date,
        created_at: order.created_at,
        cashier_user_id: order.cashier_user_id,
        shift_id: order.shift_id,
        branch_id: order.branch_id,
        notes: order.notes || null,
      },

      items: this._formatLineItems(order.items || []),

      financials: {
        subtotal: order.subtotal,
        tax_total: order.tax_total,
        discount_total: order.discount_total,
        tip_total: order.tip_total || 0,
        delivery_fee: order.delivery_fee || 0,
        service_charge: order.service_charge || 0,
        grand_total: order.grand_total,
        paid_total: order.grand_total,
        tax_name: financeConfig.tax_name || 'VAT',
        tax_rate: financeConfig.tax_rate || 0.07,
        is_tax_inclusive: !!(financeConfig.tax_inclusive),
        currency_symbol: financeConfig.currency_symbol || 'AED',
      },

      payment: {
        payment_id: payment.id,
        payment_method: payment.payment_method,
        payment_method_label: payment.payment_method_label || payment.payment_method,
        amount: payment.amount,
        amount_received: payment.amount_received,
        change_returned: payment.change_returned,
        transaction_reference: payment.transaction_reference || null,
        approval_code: payment.approval_code || null,
        cashier_user_id: payment.cashier_user_id,
        paid_at: payment.created_at,
      },

      footer: {
        text: receiptConfig.footer_text || 'Thank you for your visit!',
        qr: { type: 'ORDER_LOOKUP', value: order.order_number, url: null },
        barcode: this._buildBarcode(order),
        show_reprint_label: false,
      },

      notes: order.notes || null,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ──────────────────────────────────────────────────────────────────────────

  _formatLineItems(items) {
    return (items || []).map(item => ({
      item_id: item.id || item.item_id,
      product_id: item.product_id,
      product_name: item.product_name || item.product_name_snapshot,
      product_code: item.product_code || item.product_code_snapshot,
      quantity: item.quantity,
      base_unit_price: item.base_unit_price,
      final_unit_price: item.final_unit_price,
      subtotal: item.subtotal,
      discount_amount: item.discount_amount || 0,
      tax_amount: item.tax_amount || 0,
      tax_rate: item.tax_rate || 0,
      tax_name: item.tax_name || 'VAT',
      is_tax_inclusive: !!item.is_tax_inclusive,
      total_amount: item.total_amount,
      notes: item.notes || null,

      // Nested components
      variant: item.variant || (item.variant_name_snapshot ? {
        variant_name: item.variant_name_snapshot,
        price_adj: item.price_adjustment || 0,
      } : null),

      modifiers: (item.modifiers || []).map(m => ({
        group_name: m.group_name_snapshot || m.group_name,
        modifier_name: m.modifier_name_snapshot || m.modifier_name,
        price_adj: m.price_adjustment || 0,
        quantity: m.quantity || 1,
      })),

      addons: (item.addons || []).map(a => ({
        addon_name: a.addon_name_snapshot || a.addon_name,
        unit_price: a.unit_price,
        quantity: a.quantity,
        subtotal: a.subtotal,
      })),

      combo_components: (item.combo_components || item.comboComponents || []).map(c => ({
        product_name: c.product_name_snapshot || c.product_name,
        variant_name: c.variant_snapshot || c.variant_name,
        price_adj: c.price_adjustment || 0,
        quantity: c.quantity || 1,
      })),
    }));
  }

  _buildBarcode(order) {
    if (!order?.order_number) return null;
    return {
      type: 'CODE128',
      value: order.order_number,
      height: 40,
    };
  }
}

export const receiptGeneratorService = new ReceiptGeneratorService();
