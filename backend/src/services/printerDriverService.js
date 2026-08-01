/**
 * PrinterStatus — all possible physical printer states.
 */
export const PrinterStatus = Object.freeze({
  ONLINE:       'ONLINE',
  OFFLINE:      'OFFLINE',
  PRINTING:     'PRINTING',
  BUSY:         'BUSY',
  ERROR:        'ERROR',
  PAPER_OUT:    'PAPER_OUT',
  DISCONNECTED: 'DISCONNECTED',
});

/**
 * PrinterDriverType — supported printer driver backends.
 * VIRTUAL: logs to console — no hardware required.
 * ESCPOS_USB: ESC/POS over USB (requires native binding — future).
 * ESCPOS_LAN: ESC/POS over TCP/IP LAN (requires net socket — future).
 */
export const PrinterDriverType = Object.freeze({
  VIRTUAL:    'VIRTUAL',
  ESCPOS_USB: 'ESCPOS_USB',
  ESCPOS_LAN: 'ESCPOS_LAN',
});

/**
 * PrinterDriverService
 *
 * Abstract interface for all physical print execution.
 * The Print Engine calls `executePrintJob(job, printer)` and this
 * service dispatches to the correct driver backend.
 *
 * Architecture principle:
 *   - VIRTUAL driver is fully functional for dev/staging
 *   - Real drivers (USB, LAN) are registered identically
 *   - Adding a new printer type never changes the engine
 */
class PrinterDriverService {
  /**
   * Execute a print job on a physical printer.
   *
   * @param {Object} job     - Parsed print job (payload already as Object)
   * @param {Object} printer - Printer config row from DB
   * @returns {Object}       - { success, duration_ms, error? }
   */
  async executePrintJob(job, printer) {
    const startTime = Date.now();
    const driverType = printer?.driver_type || PrinterDriverType.VIRTUAL;

    try {
      switch (driverType) {
        case PrinterDriverType.VIRTUAL:
          await this._executeVirtual(job, printer);
          break;

        case PrinterDriverType.ESCPOS_USB:
          await this._executeEscPosUsb(job, printer);
          break;

        case PrinterDriverType.ESCPOS_LAN:
          await this._executeEscPosLan(job, printer);
          break;

        default:
          // Fallback to virtual — never block printing
          await this._executeVirtual(job, printer);
          break;
      }

      return {
        success:     true,
        duration_ms: Date.now() - startTime,
        driver:      driverType,
      };
    } catch (error) {
      return {
        success:     false,
        duration_ms: Date.now() - startTime,
        driver:      driverType,
        error:       error.message || 'Print execution failed',
      };
    }
  }

  /**
   * Open the cash drawer via ESC/POS pulse command.
   * Triggered independently from receipt printing.
   */
  async openCashDrawer(printer) {
    const startTime = Date.now();
    const driverType = printer?.driver_type || PrinterDriverType.VIRTUAL;

    try {
      switch (driverType) {
        case PrinterDriverType.VIRTUAL:
          console.log(`[PrinterDriver][VIRTUAL] 💰 CASH DRAWER OPENED via printer: ${printer?.name || 'Unknown'}`);
          console.log(`[PrinterDriver][VIRTUAL] ESC/POS: ESC p m t1 t2 (pin ${printer?.cash_drawer_pin || 2})`);
          await this._simulateDelay(50);
          break;

        case PrinterDriverType.ESCPOS_LAN:
        case PrinterDriverType.ESCPOS_USB:
          // Future: send ESC p command bytes
          // Buffer: [0x1B, 0x70, pin, 0x19, 0xFA]
          console.warn(`[PrinterDriver] Cash drawer for ${driverType} not yet implemented — using VIRTUAL`);
          await this._simulateDelay(50);
          break;
      }

      return { success: true, duration_ms: Date.now() - startTime };
    } catch (error) {
      return { success: false, duration_ms: Date.now() - startTime, error: error.message };
    }
  }

  /**
   * Test if a printer is reachable.
   * Returns { reachable, latency_ms, error? }
   */
  async testConnection(printer) {
    const startTime = Date.now();
    const driverType = printer?.driver_type || PrinterDriverType.VIRTUAL;

    if (driverType === PrinterDriverType.VIRTUAL) {
      await this._simulateDelay(20);
      return { reachable: true, latency_ms: Date.now() - startTime };
    }

    if (driverType === PrinterDriverType.ESCPOS_LAN) {
      return await this._pingLan(printer, startTime);
    }

    // USB: always report online in virtual mode
    return { reachable: true, latency_ms: Date.now() - startTime };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Virtual Driver — console output for development
  // ──────────────────────────────────────────────────────────────────────────

  async _executeVirtual(job, printer) {
    const printerName = printer?.name || 'VIRTUAL';
    const charWidth   = printer?.char_width || 48;
    const separator   = '─'.repeat(charWidth);

    console.log(`\n[PrinterDriver][VIRTUAL] ═══ PRINT JOB: ${job.job_type} ═══`);
    console.log(`[PrinterDriver][VIRTUAL] Printer  : ${printerName}`);
    console.log(`[PrinterDriver][VIRTUAL] Job ID   : ${job.id}`);
    console.log(`[PrinterDriver][VIRTUAL] Order    : ${job.order_number || 'N/A'}`);
    console.log(`[PrinterDriver][VIRTUAL] ${separator}`);

    const payload = job.payload;

    if (payload?.business) {
      console.log(`[PrinterDriver][VIRTUAL] ${this._center(payload.business.name || 'RESTAURANT', charWidth)}`);
      if (payload.business.address) console.log(`[PrinterDriver][VIRTUAL] ${this._center(payload.business.address, charWidth)}`);
      if (payload.business.phone)   console.log(`[PrinterDriver][VIRTUAL] ${this._center('Tel: ' + payload.business.phone, charWidth)}`);
      if (payload.business.tax_id)  console.log(`[PrinterDriver][VIRTUAL] ${this._center('TRN: ' + payload.business.tax_id, charWidth)}`);
      console.log(`[PrinterDriver][VIRTUAL] ${separator}`);
    }

    if (payload?.order) {
      const o = payload.order;
      console.log(`[PrinterDriver][VIRTUAL] Order: ${o.order_number}  Date: ${o.business_date}`);
      console.log(`[PrinterDriver][VIRTUAL] Type : ${o.order_type}    Cashier: ${o.cashier_user_id}`);
      if (o.notes) console.log(`[PrinterDriver][VIRTUAL] Notes: ${o.notes}`);
      console.log(`[PrinterDriver][VIRTUAL] ${separator}`);
    }

    if (payload?.items?.length) {
      for (const item of payload.items) {
        const lineTotal = (item.total_amount || item.subtotal || 0).toFixed(2);
        console.log(`[PrinterDriver][VIRTUAL] ${item.quantity}x ${item.product_name} ${this._padLeft(lineTotal, charWidth - item.product_name.length - 4)}`);
        if (item.variant?.variant_name) {
          console.log(`[PrinterDriver][VIRTUAL]    • ${item.variant.variant_name}`);
        }
        for (const m of item.modifiers || []) {
          console.log(`[PrinterDriver][VIRTUAL]    + ${m.modifier_name}`);
        }
        if (item.notes) {
          console.log(`[PrinterDriver][VIRTUAL]    *** ${item.notes} ***`);
        }
      }
      console.log(`[PrinterDriver][VIRTUAL] ${separator}`);
    }

    if (payload?.financials) {
      const f = payload.financials;
      const sym = f.currency_symbol || 'AED';
      if (f.discount_total > 0) console.log(`[PrinterDriver][VIRTUAL] ${this._padBoth('Discount:', `-${sym} ${f.discount_total.toFixed(2)}`, charWidth)}`);
      console.log(`[PrinterDriver][VIRTUAL] ${this._padBoth('Subtotal:', `${sym} ${(f.subtotal || 0).toFixed(2)}`, charWidth)}`);
      console.log(`[PrinterDriver][VIRTUAL] ${this._padBoth(`Tax (${((f.tax_rate || 0) * 100).toFixed(0)}%):`, `${sym} ${(f.tax_total || 0).toFixed(2)}`, charWidth)}`);
      console.log(`[PrinterDriver][VIRTUAL] ${separator}`);
      console.log(`[PrinterDriver][VIRTUAL] ${this._padBoth('TOTAL:', `${sym} ${(f.grand_total || 0).toFixed(2)}`, charWidth)}`);
    }

    if (payload?.payment) {
      const p = payload.payment;
      const sym = payload.financials?.currency_symbol || 'AED';
      console.log(`[PrinterDriver][VIRTUAL] ${separator}`);
      console.log(`[PrinterDriver][VIRTUAL] ${this._padBoth('Payment:', p.payment_method_label || p.payment_method, charWidth)}`);
      if (p.amount_received > 0) {
        console.log(`[PrinterDriver][VIRTUAL] ${this._padBoth('Received:', `${sym} ${(p.amount_received || 0).toFixed(2)}`, charWidth)}`);
        console.log(`[PrinterDriver][VIRTUAL] ${this._padBoth('Change:', `${sym} ${(p.change_returned || 0).toFixed(2)}`, charWidth)}`);
      }
      if (p.transaction_reference) {
        console.log(`[PrinterDriver][VIRTUAL] Ref: ${p.transaction_reference}`);
      }
    }

    if (payload?.footer) {
      console.log(`[PrinterDriver][VIRTUAL] ${separator}`);
      if (payload.footer.text)  console.log(`[PrinterDriver][VIRTUAL] ${this._center(payload.footer.text, charWidth)}`);
      if (payload.footer.show_reprint_label) console.log(`[PrinterDriver][VIRTUAL] ${this._center('*** REPRINT ***', charWidth)}`);
      if (payload.footer.qr?.value)   console.log(`[PrinterDriver][VIRTUAL] [QR: ${payload.footer.qr.value}]`);
      if (payload.footer.barcode?.value) console.log(`[PrinterDriver][VIRTUAL] [BARCODE: ${payload.footer.barcode.value}]`);
    }

    console.log(`[PrinterDriver][VIRTUAL] ═══ END PRINT JOB ═══\n`);

    // Simulate thermal printer processing time
    await this._simulateDelay(200);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ESC/POS USB Driver — stub (requires native binding)
  // ──────────────────────────────────────────────────────────────────────────

  async _executeEscPosUsb(job, printer) {
    // Future implementation:
    // 1. Require node-escpos or escpos-usb package
    // 2. Open USB device by VID/PID
    // 3. Build ESC/POS command buffer from job.payload
    // 4. Send to device
    // 5. Close connection
    console.warn(`[PrinterDriver] ESC/POS USB driver not yet implemented for printer "${printer?.name}". Falling back to VIRTUAL.`);
    await this._executeVirtual(job, printer);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ESC/POS LAN Driver — stub (requires TCP socket)
  // ──────────────────────────────────────────────────────────────────────────

  async _executeEscPosLan(job, printer) {
    // Future implementation:
    // 1. Open TCP socket to printer.ip_address:printer.port
    // 2. Build ESC/POS command buffer
    // 3. Send over socket
    // 4. Wait for acknowledgment / timeout
    // 5. Close socket
    console.warn(`[PrinterDriver] ESC/POS LAN driver not yet implemented for ${printer?.ip_address}:${printer?.port}. Falling back to VIRTUAL.`);
    await this._executeVirtual(job, printer);
  }

  async _pingLan(printer, startTime) {
    // Future: TCP connect test
    return { reachable: true, latency_ms: Date.now() - startTime };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Text formatting helpers for VIRTUAL output
  // ──────────────────────────────────────────────────────────────────────────

  _center(text, width) {
    const str = String(text || '').slice(0, width);
    const pad = Math.max(0, Math.floor((width - str.length) / 2));
    return ' '.repeat(pad) + str;
  }

  _padLeft(text, totalWidth) {
    const str = String(text || '');
    return str.padStart(totalWidth, ' ');
  }

  _padBoth(left, right, width) {
    const l = String(left  || '');
    const r = String(right || '');
    const gap = Math.max(1, width - l.length - r.length);
    return l + ' '.repeat(gap) + r;
  }

  _simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const printerDriverService = new PrinterDriverService();
