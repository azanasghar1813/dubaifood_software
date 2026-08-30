import { settingsRepository } from '../repositories/settingsRepository.js';
import { printerRepository } from '../repositories/printerRepository.js';
import { paymentMethodRepository } from '../repositories/paymentMethodRepository.js';
import { activityLogService } from './activityLogService.js';
import { dbEngine } from '../database/sqlite.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SerialPort } from 'serialport';
import crypto from 'crypto';
import os from 'os';

const isLegacyTillPrefix = (prefix) => /^T[0-9A-F]{2}$/i.test(String(prefix || '').trim());

const execAsync = promisify(exec);

class ConfigService {
  constructor() {
    this.businessSettings = {};
    this.applicationSettings = {};
    this.initialized = false;
  }

  // Load all settings into memory
  initialize() {
    if (this.initialized) return;
    this.refreshCache();
    
    // Prevent infinite recursion by setting initialized before using getters
    this.initialized = true;
    
    // Ensure Device Identity exists
    const syncConfig = this.getSyncConfig();
    if (!syncConfig.device_id) {
      const deviceId = crypto.randomUUID();
      this.updateApplicationCategory('SYSTEM', 'SYNC', { device_id: deviceId });
      console.log(`[ConfigService] Generated persistent device_id: ${deviceId}`);
    }
    
    // Txx prefixes (e.g. T93) were auto-generated — wipe so the till can pick PC1/PC2.
    try {
      const legacy = dbEngine.prepare(
        "SELECT value FROM application_settings WHERE key = 'order_prefix'"
      ).get();
      if (legacy && isLegacyTillPrefix(legacy.value)) {
        dbEngine.prepare("DELETE FROM application_settings WHERE key = 'order_prefix'").run();
        this.refreshCache();
        console.log(`[ConfigService] Removed legacy till prefix ${legacy.value}. Choose PC1 or PC2 on login.`);
      }
    } catch { /* settings table may not exist yet */ }

    console.log('[ConfigService] In-memory configuration cache loaded.');
  }

  refreshCache() {
    this.businessSettings = settingsRepository.getBusinessSettings();
    this.applicationSettings = settingsRepository.getApplicationSettings();
  }

  // Getters for entire categories
  getBusinessCategory(category) {
    if (!this.initialized) this.initialize();
    return this.businessSettings[category] || {};
  }

  getApplicationCategory(category) {
    if (!this.initialized) this.initialize();
    return this.applicationSettings[category] || {};
  }

  // Specific domain getters
  getBusinessProfile() {
    return this.getBusinessCategory('PROFILE');
  }

  getReceiptConfig() {
    return this.getBusinessCategory('RECEIPT');
  }

  getFinanceConfig() {
    return this.getBusinessCategory('FINANCIAL');
  }

  getOrderConfig() {
    return this.getBusinessCategory('ORDER');
  }

  getKitchenConfig() {
    return this.getBusinessCategory('KITCHEN');
  }

  getProductConfig() {
    return this.getBusinessCategory('PRODUCT');
  }

  getVariantCodeStrategy() {
    const config = this.getProductConfig();
    return config.variant_code_strategy || 'SUFFIX'; // 'SUFFIX', 'INDEPENDENT', 'MANUAL'
  }

  getBusinessDay() {
    // Defaults if not set
    const profile = this.getBusinessProfile();
    return {
      start_time: profile.business_day_start || '06:00',
      end_time: profile.business_day_end || '05:59'
    };
  }

  getShortcutConfig() {
    return this.getApplicationCategory('SHORTCUTS');
  }

  getBackupConfig() {
    return this.getApplicationCategory('BACKUP');
  }

  getSyncConfig() {
    return this.getApplicationCategory('SYNC');
  }

  claimOrderPrefix(prefix) {
    const current = this.getSyncConfig().order_prefix;
    if (current && !isLegacyTillPrefix(current)) {
      throw new Error('Device ID is already set and cannot be changed.');
    }
    const clean = String(prefix || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean !== 'PC1' && clean !== 'PC2') {
      throw new Error('Device ID must be PC1 or PC2.');
    }
    this.updateApplicationCategory('SYSTEM', 'SYNC', { order_prefix: clean });
    return clean;
  }

  getLanLoginUrls() {
    const port = process.env.PORT || 5000;
    const urls = [];
    const nets = os.networkInterfaces();
    for (const addrs of Object.values(nets || {})) {
      for (const addr of addrs || []) {
        const family = addr.family === 'IPv4' || addr.family === 4;
        if (family && !addr.internal) {
          urls.push(`http://${addr.address}:${port}/login`);
        }
      }
    }
    return urls;
  }

  // Setters
  updateBusinessCategory(actorId, category, kvPairs) {
    settingsRepository.updateBusinessSettings(category, kvPairs);
    this.refreshCache();
    activityLogService.logActivity(actorId, 'BUSINESS_CONFIG_UPDATED', 'SETTINGS', category, { keys: Object.keys(kvPairs) });
  }

  updateApplicationCategory(actorId, category, kvPairs) {
    settingsRepository.updateApplicationSettings(category, kvPairs);
    this.refreshCache();
    activityLogService.logActivity(actorId, 'APP_CONFIG_UPDATED', 'SETTINGS', category, { keys: Object.keys(kvPairs) });
  }

  // Hardware - Printers
  getAllPrinters() {
    return printerRepository.findAll();
  }

  getPrinterById(id) {
    return printerRepository.findById(id);
  }

  createPrinter(actorId, printerData) {
    const id = printerRepository.create(printerData);
    activityLogService.logActivity(actorId, 'PRINTER_CREATED', 'PRINTER', id, { name: printerData.name });
    return id;
  }

  updatePrinter(actorId, id, printerData) {
    const printer = printerRepository.findById(id);
    if (!printer) throw new Error('Printer not found');
    printerRepository.update(id, printerData);
    activityLogService.logActivity(actorId, 'PRINTER_UPDATED', 'PRINTER', id, { name: printerData.name });
  }

  deletePrinter(actorId, id) {
    const printer = printerRepository.findById(id);
    if (!printer) throw new Error('Printer not found');
    printerRepository.delete(id);
    activityLogService.logActivity(actorId, 'PRINTER_DELETED', 'PRINTER', id, { name: printer.name });
  }

  async discoverPrinters() {
    const discovered = [];

    // 1. Discover COM ports (Bluetooth/Serial)
    try {
      const ports = await SerialPort.list();
      ports.forEach(port => {
        discovered.push({
          name: port.path,
          port: port.path,
          type: 'ESCPOS_BT',
          description: port.friendlyName || 'Bluetooth/Serial Port'
        });
      });
    } catch (err) {
      console.error('[ConfigService] Failed to list COM ports:', err.message);
    }

    // 2. Discover Windows Spooler Printers (USB/Virtual)
    try {
      const { stdout } = await execAsync('powershell -NoProfile -Command "Get-WmiObject -Class Win32_Printer | Select-Object Name, PortName, Network | ConvertTo-Json"', { windowsHide: true });
      if (stdout.trim()) {
        const printers = JSON.parse(stdout);
        const printerList = Array.isArray(printers) ? printers : [printers];
        
        printerList.forEach(p => {
          discovered.push({
            name: p.Name,
            port: p.PortName,
            type: 'ESCPOS_USB',
            description: p.Network ? 'Network Printer' : 'Local Windows Printer'
          });
        });
      }
    } catch (err) {
      console.error('[ConfigService] Failed to list Windows printers:', err.message);
    }

    return discovered;
  }

  // Payment Methods
  getAllPaymentMethods() {
    return paymentMethodRepository.findAll();
  }

  getPaymentMethodByCode(code) {
    return paymentMethodRepository.findByCode(code);
  }

  createPaymentMethod(actorId, methodData) {
    const existing = paymentMethodRepository.findByCode(methodData.code);
    if (existing) throw new Error('Payment method code already exists');
    
    const code = paymentMethodRepository.create(methodData);
    activityLogService.logActivity(actorId, 'PAYMENT_METHOD_CREATED', 'PAYMENT', code, { name: methodData.name });
    return code;
  }

  updatePaymentMethod(actorId, code, methodData) {
    const existing = paymentMethodRepository.findByCode(code);
    if (!existing) throw new Error('Payment method not found');

    paymentMethodRepository.update(code, methodData);
    activityLogService.logActivity(actorId, 'PAYMENT_METHOD_UPDATED', 'PAYMENT', code, { name: methodData.name });
  }

  deletePaymentMethod(actorId, code) {
    const existing = paymentMethodRepository.findByCode(code);
    if (!existing) throw new Error('Payment method not found');
    
    paymentMethodRepository.delete(code);
    activityLogService.logActivity(actorId, 'PAYMENT_METHOD_DELETED', 'PAYMENT', code, { name: existing.name });
  }
}

// Export singleton instance
export const configService = new ConfigService();
