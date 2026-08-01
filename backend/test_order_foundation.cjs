const { dbEngine } = require('./src/database/sqlite.js');
const { migrationRunner } = require('./src/database/migrationRunner.js');
const { orderService } = require('./src/services/orderService.js');
const { orderLifecycleService } = require('./src/services/orderLifecycleService.js');
const { orderNumberService } = require('./src/services/orderNumberService.js');
const { orderCacheService } = require('./src/services/orderCacheService.js');
const { productRepository } = require('./src/repositories/productRepository.js');
const { categoryRepository } = require('./src/repositories/categoryRepository.js');
const { variantRepository } = require('./src/repositories/variantRepository.js');
const { modifierRepository } = require('./src/repositories/modifierRepository.js');
const { OrderLifecycleState } = require('./src/constants/orderStates.js');
const path = require('path');
const assert = require('assert');

async function runVerification() {
  console.log('--- 🚀 STARTING ENTERPRISE ORDER FOUNDATION VERIFICATION ---');

  // 1. Database Connection & Migration
  const dbPath = path.join(__dirname, 'local_pos.sqlite');
  dbEngine.connect(dbPath);
  const migrationResult = await migrationRunner.runPendingMigrations();
  console.log('✅ Migration Runner Result:', migrationResult);

  // Verify Migration 012 tables
  const tables = dbEngine.all("SELECT name FROM sqlite_master WHERE type='table'").map(t => t.name);
  const requiredTables = [
    'orders', 'order_items', 'order_item_variants', 'order_item_modifiers',
    'order_item_addons', 'order_combo_components', 'order_timeline',
    'order_payments', 'order_metadata', 'order_tags', 'order_attachments',
    'order_number_sequences'
  ];
  for (const table of requiredTables) {
    assert(tables.includes(table), `Table ${table} must exist in SQLite database!`);
  }
  console.log('✅ Database Schema Verification Passed (All 12 tables exist).');

  let role = dbEngine.get("SELECT id FROM roles LIMIT 1");
  if (!role) {
    const roleId = 'role-admin-1';
    dbEngine.run("INSERT INTO roles (id, name, description) VALUES (?, 'Admin', 'Full Admin')", roleId);
    role = { id: roleId };
  }

  const userId = 'user-cashier-101';
  let user = dbEngine.get("SELECT id FROM users WHERE id = ?", userId);
  if (!user) {
    dbEngine.run("INSERT INTO users (id, role_id, username, password_hash, first_name, last_name) VALUES (?, ?, 'cashier1', 'hash', 'Test', 'Cashier')", userId, role.id);
  }

  const shiftId = 'test-shift-101';
  let shift = dbEngine.get("SELECT id FROM cashier_sessions WHERE id = ?", shiftId);
  if (!shift) {
    dbEngine.run("INSERT INTO cashier_sessions (id, user_id, opening_float, status) VALUES (?, ?, 100.0, 'OPEN')", shiftId, userId);
  }

  const branchId = 'BRANCH_DUBAI_MAIN';

  let category = categoryRepository.findAll()[0];
  if (!category) {
    category = categoryRepository.create({ name: 'Burgers' });
  }

  let mockProduct = productRepository.findAll()[0];
  if (!mockProduct) {
    mockProduct = productRepository.create({
      category_id: category.id,
      product_code: 'BURGER-01',
      name: 'Gourmet Beef Burger',
      display_name: 'Gourmet Beef Burger',
      price: 45.00,
      cost: 15.00
    });
  }

  // Create mock variant
  let mockVariant = variantRepository.findByProduct(mockProduct.id)[0];
  if (!mockVariant) {
    mockVariant = variantRepository.create({
      product_id: mockProduct.id,
      name: 'Double Patty',
      sku: 'BURGER-01-DBL',
      price: 55.00
    });
  }

  // Create mock modifier group & modifier
  let mockGroup = modifierRepository.findAllGroups()[0];
  if (!mockGroup) {
    mockGroup = modifierRepository.createGroup({ name: 'Cheese Selection' });
  }
  let mockModifier = modifierRepository.findAllModifiers()[0];
  if (!mockModifier) {
    mockModifier = modifierRepository.createModifier({ name: 'Extra Cheddar Cheese', price_adjustment: 5.00 });
    modifierRepository.addOptionToGroup(mockGroup.id, mockModifier.id, { price_adjustment: 5.00 });
  }

  // 3. Test Business Order Numbering Strategy
  console.log('--- Testing Business Order Numbering Strategy ---');
  const dateStr = '2026-07-31';
  const num1 = orderNumberService.generateNextNumber(branchId, dateStr);
  const num2 = orderNumberService.generateNextNumber(branchId, dateStr);
  console.log(`Generated sequence order numbers: ${num1}, ${num2}`);
  assert(num1 !== num2, 'Order numbers must be unique!');
  assert(num1.includes('POS-'), 'Order number must contain prefix POS');
  console.log('✅ Atomic Order Number Generation Passed.');

  // 4. Test Order Creation & Snapshot Immutability
  console.log('--- Testing Order Creation & Snapshot Immutability ---');
  const order1 = orderService.createDraftOrder(shiftId, userId, {
    branch_id: branchId,
    order_type: 'DINE_IN',
    notes: 'Test order for snapshot verification'
  });
  assert(order1.id, 'Order ID must exist');
  assert.strictEqual(order1.lifecycle_state, OrderLifecycleState.DRAFT);
  assert.strictEqual(order1.payment_state, 'UNPAID');

  // Add Item to Order with variant and modifier
  const updatedOrder1 = orderService.addItemToOrder(order1.id, {
    product_id: mockProduct.id,
    variant_id: mockVariant.id,
    modifiers: [{ modifier_id: mockModifier.id, group_id: mockGroup.id, price_adjustment: 5.00 }],
    quantity: 2,
    notes: 'Extra crispy'
  }, userId);

  console.log(`Order ${updatedOrder1.order_number} Item Added. Grand Total: ${updatedOrder1.grand_total}`);
  assert.strictEqual(updatedOrder1.items.length, 1);
  const item = updatedOrder1.items[0];
  assert.strictEqual(item.product_name_snapshot, mockProduct.name);
  assert.strictEqual(item.quantity, 2);
  assert(item.variants.length > 0, 'Item variant snapshot must be populated');
  assert(item.modifiers.length > 0, 'Item modifier snapshot must be populated');
  
  const originalSnapshotName = item.product_name_snapshot;
  const originalSnapshotPrice = item.base_unit_price;

  // NOW ALTER CATALOG PRODUCT IN DB TO TEST IMMUTABILITY
  productRepository.update(mockProduct.id, {
    name: 'ALTERED PRODUCT NAME DO NOT USE IN HISTORICAL ORDERS',
    price: 999.99
  });

  // Re-fetch order from database (bypassing active cache)
  orderCacheService.clear();
  const refetchedOrder = orderService.getOrderById(order1.id);
  const refetchedItem = refetchedOrder.items[0];

  assert.strictEqual(refetchedItem.product_name_snapshot, originalSnapshotName, 'Historical item name must remain immutable!');
  assert.strictEqual(refetchedItem.base_unit_price, originalSnapshotPrice, 'Historical item price must remain immutable!');
  console.log('✅ Snapshot Immutability Verification Passed. (Catalog changes did NOT alter historical order)');

  // 5. Test State Machine Transitions & Centralized Lifecycle Enforcement
  console.log('--- Testing Centralized State Machine Transitions ---');
  
  // Transition DRAFT -> HELD
  const heldOrder = orderLifecycleService.transition(order1.id, OrderLifecycleState.HELD, {
    userId,
    holdName: 'Table 4 Hold'
  });
  assert.strictEqual(heldOrder.lifecycle_state, OrderLifecycleState.HELD);
  assert.strictEqual(heldOrder.hold_name, 'Table 4 Hold');

  // Transition HELD -> DRAFT
  const resumedOrder = orderLifecycleService.transition(order1.id, OrderLifecycleState.DRAFT, { userId });
  assert.strictEqual(resumedOrder.lifecycle_state, OrderLifecycleState.DRAFT);
  assert.strictEqual(resumedOrder.hold_name, null);

  // Transition DRAFT -> PENDING_PAYMENT -> PAID -> PREPARING -> READY -> SERVED -> COMPLETED -> ARCHIVED
  orderLifecycleService.transition(order1.id, OrderLifecycleState.PENDING_PAYMENT, { userId });
  orderLifecycleService.transition(order1.id, OrderLifecycleState.PAID, { userId, paymentState: 'PAID' });
  orderLifecycleService.transition(order1.id, OrderLifecycleState.PREPARING, { userId, kitchenState: 'PREPARING' });
  orderLifecycleService.transition(order1.id, OrderLifecycleState.READY, { userId, kitchenState: 'READY' });
  orderLifecycleService.transition(order1.id, OrderLifecycleState.SERVED, { userId, kitchenState: 'SERVED' });
  const completedOrder = orderLifecycleService.transition(order1.id, OrderLifecycleState.COMPLETED, { userId });

  assert.strictEqual(completedOrder.lifecycle_state, OrderLifecycleState.COMPLETED);
  assert(completedOrder.completed_at, 'completed_at must be populated');

  // TEST ILLEGAL TRANSITION ENFORCEMENT
  console.log('--- Testing Illegal Transition Prevention ---');
  let illegalTransitionCaught = false;
  try {
    // Attempting COMPLETED -> DRAFT (illegal!)
    orderLifecycleService.transition(order1.id, OrderLifecycleState.DRAFT, { userId });
  } catch (err) {
    illegalTransitionCaught = true;
    console.log(`✅ Caught expected state machine error: "${err.message}"`);
  }
  assert(illegalTransitionCaught, 'State machine MUST block illegal state transitions!');

  // 6. Verify Timeline Audit Entries
  console.log('--- Testing Order Timeline Audit Logging ---');
  const timeline = orderService.getOrderById(order1.id).timeline;
  assert(timeline.length >= 6, 'Timeline must contain entries for creation and state transitions');
  console.log(`Recorded ${timeline.length} timeline audit events.`);
  console.log('✅ Order Timeline Audit Verification Passed.');

  // 7. Verify Sync Queue Events & Activity Logs
  console.log('--- Testing Sync Queue & Activity Log Integration ---');
  const syncQueueEvents = dbEngine.all("SELECT * FROM sync_queue WHERE entity_id = ?", order1.id);
  assert(syncQueueEvents.length > 0, 'Sync queue must contain events for order');
  console.log(`Recorded ${syncQueueEvents.length} sync_queue events.`);

  const activityLogs = dbEngine.all("SELECT * FROM activity_logs WHERE entity_id = ?", order1.id);
  assert(activityLogs.length > 0, 'Activity log must contain entries for order');
  console.log(`Recorded ${activityLogs.length} activity_logs entries.`);
  console.log('✅ Sync Queue & Activity Log Integration Passed.');

  console.log('--- 🎉 ALL ENTERPRISE ORDER FOUNDATION VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
}

runVerification().catch(err => {
  console.error('❌ Verification Failed with Error:', err);
  process.exit(1);
});
