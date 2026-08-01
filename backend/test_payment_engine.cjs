/**
 * test_payment_engine.cjs
 *
 * Enterprise Payment Engine — Full Verification Test (15 tests)
 *
 * Tests:
 *  1.  Migration 014 runs cleanly (schema, indexes, payment method seeding)
 *  2.  payment_methods seeded with all 6 default methods
 *  3.  payment_receipts table created
 *  4.  Cash: exact amount → change = 0, order marked PAID
 *  5.  Cash: overpay → correct change calculated
 *  6.  Cash: underpay → rejected with clear error
 *  7.  Card payment with reference number → accepted
 *  8.  JazzCash payment → accepted
 *  9.  Duplicate full payment rejected (order already PAID)
 * 10.  Invalid payment method → rejected
 * 11.  Payment on cancelled order → rejected
 * 12.  Receipt payload generated with all required fields
 * 13.  Timeline event created for every payment
 * 14.  Activity log entry created for every payment
 * 15.  Sync queue event emitted for every payment
 */

const path   = require('path');
const assert = require('assert');

// Bootstrap database
const { dbEngine }         = require('./src/database/sqlite.js');
const { migrationRunner }  = require('./src/database/migrationRunner.js');

const dbPath = path.join(__dirname, 'local_pos.sqlite');
dbEngine.connect(dbPath);

async function runTests() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  💳  ENTERPRISE PAYMENT ENGINE — VERIFICATION TESTS  ');
  console.log('════════════════════════════════════════════════════════\n');

  // Run all pending migrations
  const migResult = await migrationRunner.runPendingMigrations();
  console.log('✅ Migrations applied:', JSON.stringify(migResult));

  // ── TEST 1: Schema verification ────────────────────────────────────────────
  console.log('\n── Test 1: Migration 014 schema verification ──');

  const tables = dbEngine.all("SELECT name FROM sqlite_master WHERE type='table'").map(t => t.name);
  assert(tables.includes('order_payments'),   'order_payments table must exist');
  assert(tables.includes('payment_receipts'), 'payment_receipts table must exist');

  const pmCols = dbEngine.all("PRAGMA table_info(order_payments)").map(c => c.name);
  assert(pmCols.includes('amount_received'),       'order_payments must have amount_received');
  assert(pmCols.includes('change_returned'),        'order_payments must have change_returned');
  assert(pmCols.includes('business_date'),          'order_payments must have business_date');
  assert(pmCols.includes('payment_method_label'),   'order_payments must have payment_method_label');
  assert(pmCols.includes('voided_at'),              'order_payments must have voided_at');
  console.log('✅ Migration 014 schema verified.');

  // ── TEST 2: Payment methods seeded ────────────────────────────────────────
  console.log('\n── Test 2: Default payment methods seeded ──');

  const { paymentMethodRepository } = require('./src/repositories/paymentMethodRepository.js');
  const methods = paymentMethodRepository.findAll();
  const methodCodes = methods.map(m => m.code);
  ['CASH', 'CARD', 'JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER', 'OTHER'].forEach(code => {
    assert(methodCodes.includes(code), `Payment method ${code} must be seeded`);
  });
  console.log(`✅ ${methods.length} payment methods seeded: ${methodCodes.join(', ')}`);

  // ── Seed order infrastructure ──────────────────────────────────────────────
  const { categoryRepository }  = require('./src/repositories/categoryRepository.js');
  const { productRepository }   = require('./src/repositories/productRepository.js');
  const { cartService }         = require('./src/services/cartService.js');
  const { orderCreationService }= require('./src/services/orderCreationService.js');
  const { paymentService }      = require('./src/services/paymentService.js');
  const { orderRepository }     = require('./src/repositories/orderRepository.js');

  let role = dbEngine.get("SELECT id FROM roles LIMIT 1");
  if (!role) {
    dbEngine.run("INSERT INTO roles (id, name, description) VALUES ('role-pay-1', 'Admin', 'Admin')");
    role = { id: 'role-pay-1' };
  }

  const USER_ID = 'cashier-pay-test-001';
  if (!dbEngine.get("SELECT id FROM users WHERE id = ?", USER_ID)) {
    dbEngine.run("INSERT INTO users (id, role_id, username, password_hash, first_name, last_name) VALUES (?, ?, 'paycashier', 'hash', 'Pay', 'Cashier')", USER_ID, role.id);
  }

  const BRANCH = 'PAY_TEST_BRANCH';

  /** Helper: creates a fresh paid order for a given session, with one product */
  function createDraftOrder(sessionSuffix) {
    const sessionId = `shift-pay-${sessionSuffix}`;
    if (!dbEngine.get("SELECT id FROM cashier_sessions WHERE id = ?", sessionId)) {
      dbEngine.run("INSERT INTO cashier_sessions (id, user_id, opening_float, status) VALUES (?, ?, 100.0, 'OPEN')", sessionId, USER_ID);
    }

    let cat = categoryRepository.findAll()[0];
    if (!cat) cat = categoryRepository.create({ name: 'TestCat', lifecycle_state: 'ACTIVE' });

    let prod = productRepository.findAll().find(p => p.product_code === 'PAY-TEST-PROD');
    if (!prod) {
      prod = productRepository.create({
        category_id: cat.id,
        product_code: 'PAY-TEST-PROD',
        name: 'Test Burger',
        display_name: 'Test Burger',
        price: 200.00,
        status: 'AVAILABLE',
        lifecycle_state: 'ACTIVE'
      });
    }

    // Add item to cart and checkout → creates draft order
    cartService.addItem(sessionId, USER_ID, BRANCH, { product_id: prod.id, quantity: 2 });
    const order = orderCreationService.checkoutCart(sessionId, USER_ID, { branch_id: BRANCH });
    return order;
  }

  // ── TEST 3: payment_receipts table validation ──────────────────────────────
  console.log('\n── Test 3: payment_receipts table exists ──');
  const receiptCols = dbEngine.all("PRAGMA table_info(payment_receipts)").map(c => c.name);
  ['id', 'payment_id', 'order_id', 'receipt_number', 'payload', 'generated_at'].forEach(col => {
    assert(receiptCols.includes(col), `payment_receipts must have column: ${col}`);
  });
  console.log('✅ payment_receipts table validated.');

  // ── TEST 4: Cash exact payment → order PAID, change = 0 ───────────────────
  console.log('\n── Test 4: Cash exact payment ──');

  const order4 = createDraftOrder('004');
  const amountDue4 = order4.grand_total;
  const sessionId4 = `shift-pay-004`;

  const result4 = paymentService.processPayment(order4.id, sessionId4, USER_ID, {
    payment_method:  'CASH',
    amount_received: amountDue4   // Exact
  });

  assert(result4.payment, 'Payment record must exist');
  assert.strictEqual(result4.payment.status, 'COMPLETED', 'Payment status must be COMPLETED');
  assert.strictEqual(result4.change_returned, 0, 'Change must be 0 for exact cash');
  assert.strictEqual(result4.order.payment_state, 'PAID', 'Order payment_state must be PAID');
  assert.strictEqual(result4.order.lifecycle_state, 'PAID', 'Order lifecycle_state must be PAID');
  assert(result4.receipt, 'Receipt must be generated');
  console.log(`✅ Exact cash: AED ${amountDue4} → paid, change = ${result4.change_returned}`);

  // ── TEST 5: Cash overpay → correct change ──────────────────────────────────
  console.log('\n── Test 5: Cash overpay → correct change ──');

  const order5 = createDraftOrder('005');
  const amountDue5 = order5.grand_total;
  const amountReceived5 = 1000;

  const result5 = paymentService.processPayment(order5.id, `shift-pay-005`, USER_ID, {
    payment_method:  'CASH',
    amount_received: amountReceived5
  });

  const expectedChange5 = Math.round((amountReceived5 - amountDue5) * 100) / 100;
  assert.strictEqual(result5.change_returned, expectedChange5, `Change must be ${expectedChange5}`);
  assert.strictEqual(result5.payment.amount, amountDue5, 'Payment amount must equal amount due (not tendered)');
  console.log(`✅ Overpay: received=${amountReceived5}, due=${amountDue5}, change=${result5.change_returned}`);

  // ── TEST 6: Cash underpay → rejected ─────────────────────────────────────
  console.log('\n── Test 6: Cash underpay → rejected ──');

  const order6 = createDraftOrder('006');
  let under6Error = false;
  try {
    paymentService.processPayment(order6.id, `shift-pay-006`, USER_ID, {
      payment_method:  'CASH',
      amount_received: 1  // Way too little
    });
  } catch (e) {
    under6Error = true;
    assert(e.message.includes('Insufficient cash'), `Error must say Insufficient cash, got: ${e.message}`);
    console.log(`✅ Underpay rejected: "${e.message}"`);
  }
  assert(under6Error, 'Underpay must throw error');

  // ── TEST 7: Card payment with reference number ─────────────────────────────
  console.log('\n── Test 7: Card payment with reference number ──');

  const order7 = createDraftOrder('007');
  const result7 = paymentService.processPayment(order7.id, `shift-pay-007`, USER_ID, {
    payment_method:        'CARD',
    transaction_reference: '****1234'
  });

  assert.strictEqual(result7.payment.payment_method, 'CARD');
  assert.strictEqual(result7.payment.transaction_reference, '****1234');
  assert.strictEqual(result7.order.payment_state, 'PAID');
  assert.strictEqual(result7.change_returned, 0);
  console.log(`✅ Card payment accepted: ref=****1234, order PAID`);

  // ── TEST 8: JazzCash payment ───────────────────────────────────────────────
  console.log('\n── Test 8: JazzCash payment ──');

  const order8 = createDraftOrder('008');
  const result8 = paymentService.processPayment(order8.id, `shift-pay-008`, USER_ID, {
    payment_method:        'JAZZCASH',
    transaction_reference: 'JZC-987654321'
  });

  assert.strictEqual(result8.payment.payment_method, 'JAZZCASH');
  assert.strictEqual(result8.payment.payment_method_label, 'JazzCash');
  assert.strictEqual(result8.order.payment_state, 'PAID');
  console.log(`✅ JazzCash payment accepted: ref=JZC-987654321`);

  // ── TEST 9: Duplicate full payment rejected ────────────────────────────────
  console.log('\n── Test 9: Duplicate payment on already-PAID order → rejected ──');

  // order4 is already PAID from Test 4
  let dup9Error = false;
  try {
    paymentService.processPayment(order4.id, sessionId4, USER_ID, {
      payment_method:  'CASH',
      amount_received: 500
    });
  } catch (e) {
    dup9Error = true;
    assert(e.message.includes('already been fully paid'), `Error must say already paid, got: ${e.message}`);
    console.log(`✅ Duplicate rejected: "${e.message}"`);
  }
  assert(dup9Error, 'Duplicate payment must throw error');

  // ── TEST 10: Invalid payment method → rejected ─────────────────────────────
  console.log('\n── Test 10: Invalid payment method → rejected ──');

  const order10 = createDraftOrder('010');
  let inv10Error = false;
  try {
    paymentService.processPayment(order10.id, `shift-pay-010`, USER_ID, {
      payment_method: 'CRYPTO_BTC',
      amount_received: 999
    });
  } catch (e) {
    inv10Error = true;
    assert(e.message.includes("does not exist"), `Got: ${e.message}`);
    console.log(`✅ Invalid method rejected: "${e.message}"`);
  }
  assert(inv10Error, 'Invalid method must throw error');

  // ── TEST 11: Payment on CANCELLED order → rejected ─────────────────────────
  console.log('\n── Test 11: Payment on CANCELLED order → rejected ──');

  const order11 = createDraftOrder('011');
  // Cancel the order first via orderRepository direct update (bypassing lifecycle for test speed)
  orderRepository.update(order11.id, { lifecycle_state: 'CANCELLED', payment_state: 'UNPAID' });

  let can11Error = false;
  try {
    paymentService.processPayment(order11.id, `shift-pay-011`, USER_ID, {
      payment_method:  'CASH',
      amount_received: 1000
    });
  } catch (e) {
    can11Error = true;
    assert(e.message.includes('CANCELLED'), `Error must mention CANCELLED, got: ${e.message}`);
    console.log(`✅ Cancelled order rejected: "${e.message}"`);
  }
  assert(can11Error, 'Payment on cancelled order must throw error');

  // ── TEST 12: Receipt payload has all required fields ───────────────────────
  console.log('\n── Test 12: Receipt payload completeness ──');

  const receipt12 = result4.receipt;
  assert(receipt12, 'Receipt must be present');

  const p = receipt12.payload;
  assert(p.schema_version,             'Receipt must have schema_version');
  assert(p.generated_at,               'Receipt must have generated_at');
  assert(p.business,                   'Receipt must have business block');
  assert(p.business.name,              'Receipt must have business.name');
  assert(p.order,                      'Receipt must have order block');
  assert(p.order.order_number,         'Receipt must have order.order_number');
  assert(Array.isArray(p.items),       'Receipt must have items array');
  assert(p.items.length > 0,           'Receipt items must not be empty');
  assert(p.financials,                 'Receipt must have financials block');
  assert(p.financials.grand_total > 0, 'Receipt financials must have grand_total > 0');
  assert(p.payment,                    'Receipt must have payment block');
  assert(p.payment.payment_method,     'Receipt must have payment.payment_method');
  assert(p.payment.amount_received > 0,'Receipt must have payment.amount_received > 0');
  assert(p.qr,                         'Receipt must have qr block');
  console.log(`✅ Receipt payload complete: order=${p.order.order_number}, items=${p.items.length}, total=${p.financials.grand_total}`);

  // ── TEST 13: Timeline events generated ────────────────────────────────────
  console.log('\n── Test 13: Timeline event recorded ──');

  const timeline13 = dbEngine.all(
    "SELECT * FROM order_timeline WHERE order_id = ? AND event_type = 'PAYMENT_COMPLETED'",
    order4.id
  );
  assert(timeline13.length > 0, 'At least one PAYMENT_COMPLETED timeline event must exist');
  console.log(`✅ ${timeline13.length} PAYMENT_COMPLETED timeline event(s) for order ${order4.order_number}`);

  // ── TEST 14: Activity log entries generated ────────────────────────────────
  console.log('\n── Test 14: Activity log entry recorded ──');

  const actLog14 = dbEngine.all(
    "SELECT * FROM activity_logs WHERE entity_type = 'PAYMENT' AND entity_id = ?",
    result4.payment.id
  );
  assert(actLog14.length > 0, 'Activity log must have entry for this payment');
  assert(actLog14[0].action === 'PAYMENT_COMPLETED', 'Activity log action must be PAYMENT_COMPLETED');
  console.log(`✅ Activity log entry: action=${actLog14[0].action}`);

  // ── TEST 15: Sync queue events emitted ────────────────────────────────────
  console.log('\n── Test 15: Sync queue event emitted ──');

  const syncEvents15 = dbEngine.all(
    "SELECT * FROM sync_queue WHERE entity_type = 'PAYMENT' AND entity_id = ?",
    result4.payment.id
  );
  assert(syncEvents15.length > 0, 'Sync queue must have a PAYMENT event');
  assert(syncEvents15[0].action === 'PAYMENT_COMPLETED', 'Sync action must be PAYMENT_COMPLETED');
  console.log(`✅ Sync queue event: action=${syncEvents15[0].action}, entity_id=${syncEvents15[0].entity_id}`);

  // ── BONUS: Quick cash button generation ───────────────────────────────────
  console.log('\n── Bonus: Quick cash button generation ──');
  const { cashPaymentService } = require('./src/services/cashPaymentService.js');
  const buttons = cashPaymentService.buildQuickCashButtons(420.00, [500, 1000, 2000, 5000]);
  assert(buttons[0].label === 'Exact',  'First button must be Exact');
  assert(buttons[0].value === 420.00,   'Exact button value must equal amount due');
  assert(buttons.find(b => b.value === 500), '500 button must exist');
  assert(buttons[buttons.length - 1].label === 'Custom', 'Last button must be Custom');
  console.log(`✅ Quick cash buttons: ${buttons.map(b => b.label).join(', ')}`);

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════');
  console.log('  🎉  ALL PAYMENT ENGINE VERIFICATION TESTS PASSED!  ');
  console.log('════════════════════════════════════════════════════════\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
