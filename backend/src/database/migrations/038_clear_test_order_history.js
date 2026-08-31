/**
 * One-time live cutover: wipe testing-phase orders/history/pending order sync.
 * Keeps products, variants, categories, deals, customers, tables, users, printers, settings.
 */
export default {
  version: '038',
  name: 'clear_test_order_history',
  disableForeignKeys: true,

  up: (db) => {
    const run = (sql) => {
      try { db.prepare(sql).run(); } catch { /* table may not exist */ }
    };

    run('DELETE FROM order_combo_components');
    run('DELETE FROM order_item_modifiers');
    run('DELETE FROM order_item_addons');
    run('DELETE FROM order_item_variants');
    run('DELETE FROM order_items');
    run('DELETE FROM order_payments');
    run('DELETE FROM payment_receipts');
    run('DELETE FROM order_timeline');
    run('DELETE FROM order_metadata');
    run('DELETE FROM order_audit_trail');
    run('DELETE FROM order_search_index');
    run('DELETE FROM order_tags');
    run('DELETE FROM order_attachments');
    run('DELETE FROM reprint_log');
    run('DELETE FROM print_jobs');
    run('DELETE FROM print_queue');
    run('DELETE FROM cart_cache');
    run('DELETE FROM orders');
    run('DELETE FROM order_number_sequences');
    run("DELETE FROM activity_logs WHERE entity_type IN ('ORDER', 'ORDER_ITEM', 'ORDER_PAYMENT', 'PAYMENT', 'PRINT')");
    run("DELETE FROM sync_queue WHERE entity_type IN ('ORDER', 'ORDER_ITEM', 'ORDER_PAYMENT', 'PAYMENT', 'PRINT', 'KDS', 'RECEIPT')");
    run("DELETE FROM sync_conflicts WHERE entity_type IN ('ORDER', 'ORDER_ITEM', 'ORDER_PAYMENT', 'PAYMENT')");

    try { db.prepare("UPDATE dining_tables SET status = 'AVAILABLE'").run(); } catch { /* optional */ }
    try { db.prepare("UPDATE tables SET status = 'Available'").run(); } catch { /* optional */ }

    try {
      db.prepare(`
        INSERT INTO application_settings (key, value, description)
        VALUES ('last_sync_timestamp', '0', 'Last successful cloud pull timestamp')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run();
    } catch { /* optional */ }

    console.log('[Migration 038] Testing order history cleared. Catalog/tables/users kept.');
  },

  down: () => {
    console.warn('Manual rollback required for 038_clear_test_order_history.');
  }
};
