/**
 * Seeds Business, Application, and Receipt Settings.
 * Uses INSERT OR IGNORE to guarantee idempotency.
 * 
 * @param {Object} db 
 * @returns {Object} 
 */
export const runSettingsSeeder = (db) => {
  let inserted = 0;

  const insertSetting = db.prepare('INSERT OR IGNORE INTO business_settings (key, value, category, description) VALUES (?, ?, ?, ?)');
  
  const defaultSettings = [
    // General
    { key: 'business_name', val: 'Dubai Food Software POS', cat: 'GENERAL', desc: 'The official name of the business' },
    { key: 'business_address', val: 'Dubai, UAE', cat: 'GENERAL', desc: 'Main physical address' },
    { key: 'phone_number', val: '+971 50 123 4567', cat: 'GENERAL', desc: 'Main contact number' },
    { key: 'whatsapp_number', val: '+971 50 123 4567', cat: 'GENERAL', desc: 'WhatsApp support number' },
    { key: 'email_address', val: 'contact@dubaifood.com', cat: 'GENERAL', desc: 'Support email address' },
    { key: 'timezone', val: 'Asia/Dubai', cat: 'GENERAL', desc: 'Business timezone' },
    
    // Financial
    { key: 'currency_code', val: 'AED', cat: 'FINANCIAL', desc: 'Default currency code' },
    { key: 'currency_symbol', val: 'د.إ', cat: 'FINANCIAL', desc: 'Currency symbol' },
    { key: 'tax_rate_percent', val: '5.00', cat: 'FINANCIAL', desc: 'Default VAT rate' },
    { key: 'service_charge_percent', val: '0.00', cat: 'FINANCIAL', desc: 'Default Service Charge' },
    
    // Operations
    { key: 'business_day_start', val: '06:00', cat: 'OPERATIONS', desc: 'When the financial day resets' },
    
    // Receipt
    { key: 'receipt_footer_text', val: 'Thank you for dining with us!', cat: 'RECEIPT', desc: 'Text printed at the bottom of the receipt' },
    { key: 'receipt_show_qr', val: 'true', cat: 'RECEIPT', desc: 'Enable QR code printing' }
  ];

  for (const setting of defaultSettings) {
    const res = insertSetting.run(setting.key, setting.val, setting.cat, setting.desc);
    if (res.changes > 0) inserted++;
  }

  return { name: 'Settings', inserted };
};
