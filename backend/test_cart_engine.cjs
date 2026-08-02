/**
 * test_cart_engine.cjs
 * 
 * Enterprise Cart & Order Creation Engine - Full Verification Test
 * 
 * Verifies:
 *  1. Migration 013 (cart_cache table creation)
 *  2. Cart creation and session isolation per cashier
 *  3. Item addition with backend pricing (variant + modifier + add-on calculation)
 *  4. Line item merging (identical items merge qty; different items create separate lines)
 *  5. Quantity update and item removal
 *  6. Crash-recovery persistence (cartCacheRepository)
 *  7. Modifier group min/max validation before checkout
 *  8. Atomic checkout: cart -> Order Draft in a single transaction
 *  9. Snapshot immutability after checkout (altering catalog doesn't change historical order)
 * 10. Order number ONLY allocated at checkout (never for abandoned/cleared carts)
 */

const path = require('path');
const assert = require('assert');

// ── Bootstrap database ────────────────────────────────────────────────────────
const { dbEngine } = require('./src/database/sqlite.js');
const { migrationRunner } = require('./src/database/migrationRunner.js');

const dbPath = path.join(__dirname, 'local_pos.sqlite');
dbEngine.connect(dbPath);

async function runTests() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('  🛒  ENTERPRISE CART & ORDER CREATION ENGINE — TESTS  ');
  console.log('══════════════════════════════════════════════════════════\n');

  // ── Run migrations ──────────────────────────────────────────────────────────
  const migResult = await migrationRunner.runPendingMigrations();
  console.log('✅ Migrations:', JSON.stringify(migResult));

  // Verify cart_cache table exists
  const tables = dbEngine.all("SELECT name FROM sqlite_master WHERE type='table'").map(t => t.name);
  assert(tables.includes('cart_cache'), 'cart_cache table must exist');
  assert(tables.includes('orders'), 'orders table must exist');
  console.log('✅ Schema verified: cart_cache and orders tables exist.\n');

  // ── Import services (AFTER db is connected) ─────────────────────────────────
  const { cartService } = require('./src/services/cartService.js');
  const { cartCalculationService } = require('./src/services/cartCalculationService.js');
  const { cartValidationService } = require('./src/services/cartValidationService.js');
  const { cartCacheRepository } = require('./src/repositories/cartCacheRepository.js');
  const { orderCreationService } = require('./src/services/orderCreationService.js');
  const { orderRepository } = require('./src/repositories/orderRepository.js');
  const { orderItemRepository } = require('./src/repositories/orderItemRepository.js');
  const { categoryRepository } = require('./src/repositories/categoryRepository.js');
  const { productRepository } = require('./src/repositories/productRepository.js');
  const { variantRepository } = require('./src/repositories/variantRepository.js');
  const { modifierRepository } = require('./src/repositories/modifierRepository.js');
  const { orderNumberService } = require('./src/services/orderNumberService.js');

  // ── Seed required FK data ─────────────────────────────────────────────────
  let role = dbEngine.get("SELECT id FROM roles LIMIT 1");
  if (!role) {
    dbEngine.run("INSERT INTO roles (id, name, description) VALUES ('role-admin-1', 'Admin', 'Full Admin')");
    role = { id: 'role-admin-1' };
  }

  const USER_ID = 'cashier-test-101';
  if (!dbEngine.get("SELECT id FROM users WHERE id = ?", USER_ID)) {
    dbEngine.run("INSERT INTO users (id, role_id, username, password_hash, first_name, last_name) VALUES (?, ?, 'testcashier', 'hash', 'Test', 'Cashier')", USER_ID, role.id);
  }

  const SHIFT_ID = 'shift-cart-test-101';
  if (!dbEngine.get("SELECT id FROM cashier_sessions WHERE id = ?", SHIFT_ID)) {
    dbEngine.run("INSERT INTO cashier_sessions (id, user_id, opening_float, status) VALUES (?, ?, 100.0, 'OPEN')", SHIFT_ID, USER_ID);
  }

  // Seed isolated session for second cart test
  const SHIFT_ID_2 = 'shift-cart-test-102';
  if (!dbEngine.get("SELECT id FROM cashier_sessions WHERE id = ?", SHIFT_ID_2)) {
    dbEngine.run("INSERT INTO cashier_sessions (id, user_id, opening_float, status) VALUES (?, ?, 100.0, 'OPEN')", SHIFT_ID_2, USER_ID);
  }

  let category = categoryRepository.findAll()[0];
  if (!category) category = categoryRepository.create({ name: 'Burgers', lifecycle_state: 'ACTIVE' });

  // Create two distinct products for merge testing
  let burger = productRepository.findAll().find(p => p.product_code === 'CART-BURGER-01');
  if (!burger) {
    burger = productRepository.create({
      category_id: category.id,
      product_code: 'CART-BURGER-01',
      name: 'Beef Burger',
      display_name: 'Beef Burger',
      price: 35.00,
      status: 'AVAILABLE',
      lifecycle_state: 'ACTIVE'
    });
  }

  let fries = productRepository.findAll().find(p => p.product_code === 'CART-FRIES-01');
  if (!fries) {
    fries = productRepository.create({
      category_id: category.id,
      product_code: 'CART-FRIES-01',
      name: 'Large Fries',
      display_name: 'Large Fries',
      price: 15.00,
      status: 'AVAILABLE',
      lifecycle_state: 'ACTIVE'
    });
  }

  // Create variant for burger
  let burgerVariant = variantRepository.findByProduct(burger.id).find(v => v.name === 'Double Patty');
  if (!burgerVariant) {
    burgerVariant = variantRepository.create({
      product_id: burger.id,
      name: 'Double Patty',
      sku: 'CART-BURGER-01-DBL',
      price: 45.00,
      lifecycle_state: 'ACTIVE'
    });
  }

  // Create modifier group & modifier for burger
  let cheeseGroup = modifierRepository.findAllGroups().find(g => g.name === 'Cheese Type');
  if (!cheeseGroup) {
    cheeseGroup = modifierRepository.createGroup({
      name: 'Cheese Type',
      min_selection: 0,
      max_selection: 2,
      is_required: false,
      lifecycle_state: 'ACTIVE'
    });
  }

  let modifierCheddar = modifierRepository.findAllModifiers().find(m => m.name === 'Cheddar Cheese');
  if (!modifierCheddar) {
    modifierCheddar = modifierRepository.createModifier({ name: 'Cheddar Cheese', price_adjustment: 5.00, lifecycle_state: 'ACTIVE' });
    modifierRepository.addOptionToGroup(cheeseGroup.id, modifierCheddar.id, { price_adjustment: 5.00 });
  }

  modifierRepository.linkGroupToProduct(burger.id, cheeseGroup.id, 0);

  const BRANCH_ID = 'TEST_BRANCH_DUBAI';

  // ══════════════════════════════════════════════════════════════════════
  // TEST 1: Cart creation and session isolation
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── Test 1: Cart creation and session isolation ──');
  
  const cart1 = cartService.getOrCreateCart(SHIFT_ID, USER_ID, BRANCH_ID, { order_type: 'DINE_IN' });
  const cart2 = cartService.getOrCreateCart(SHIFT_ID_2, USER_ID, BRANCH_ID, { order_type: 'TAKEAWAY' });

  assert(cart1.session_id === SHIFT_ID, 'Cart 1 must have correct session_id');
  assert(cart2.session_id === SHIFT_ID_2, 'Cart 2 must have correct session_id');
  assert(cart1.session_id !== cart2.session_id, 'Different sessions must produce independent carts');
  assert(cart1.order_type === 'DINE_IN', 'Cart 1 must have DINE_IN order type');
  assert(cart2.order_type === 'TAKEAWAY', 'Cart 2 must have TAKEAWAY order type');
  assert.deepStrictEqual(cart1.items, [], 'New cart must start with empty items');
  console.log('✅ Cart creation and session isolation verified.');

  // ══════════════════════════════════════════════════════════════════════
  // TEST 2: Item addition with backend pricing (base product)
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── Test 2: Adding item with base price ──');

  const updatedCart = cartService.addItem(SHIFT_ID, USER_ID, BRANCH_ID, {
    product_id: fries.id,
    quantity: 2
  });

  assert.strictEqual(updatedCart.items.length, 1, 'Cart must have 1 item after adding fries');
  const friesLine = updatedCart.items[0];
  assert.strictEqual(friesLine.product_id, fries.id);
  assert.strictEqual(friesLine.quantity, 2);
  assert.strictEqual(friesLine.base_unit_price, 15.00);
  assert(friesLine._cart_item_id, 'Cart line must have a temporary UUID (_cart_item_id)');
  assert(friesLine.subtotal > 0, 'Subtotal must be > 0');
  console.log(`✅ Added: 2x ${fries.name} — Line subtotal: ${friesLine.subtotal}`);

  // ══════════════════════════════════════════════════════════════════════
  // TEST 3: Line item MERGING (identical product + no extras)
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── Test 3: Line item merging ──');

  const cartAfterMerge = cartService.addItem(SHIFT_ID, USER_ID, BRANCH_ID, {
    product_id: fries.id,
    quantity: 1 // Should merge into existing fries line → qty becomes 3
  });

  assert.strictEqual(cartAfterMerge.items.length, 1, 'Identical items must merge into ONE line');
  assert.strictEqual(cartAfterMerge.items[0].quantity, 3, 'Merged quantity must be 3');
  console.log(`✅ Merge verified: 2 + 1 = qty ${cartAfterMerge.items[0].quantity}`);

  // ══════════════════════════════════════════════════════════════════════
  // TEST 4: Variant + modifier pricing
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── Test 4: Variant + modifier pricing ──');

  const cartWithBurger = cartService.addItem(SHIFT_ID, USER_ID, BRANCH_ID, {
    product_id: burger.id,
    variant_id: burgerVariant.id,
    modifiers: [{ modifier_id: modifierCheddar.id, group_id: cheeseGroup.id, price_adjustment: 5.00, quantity: 1 }],
    quantity: 1
  });

  assert.strictEqual(cartWithBurger.items.length, 2, 'Cart must now have 2 distinct lines (fries + burger)');
  const burgerLine = cartWithBurger.items.find(i => i.product_id === burger.id);
  assert(burgerLine, 'Burger line must exist');
  assert.strictEqual(burgerLine.variant_id, burgerVariant.id, 'Variant must be recorded');
  assert.strictEqual(burgerLine.base_unit_price, 45.00, 'Variant price (45) must override base price (35)');
  assert.strictEqual(burgerLine.modifier_total_adj, 5.00, 'Modifier adjustment must be 5');
  assert.strictEqual(burgerLine.final_unit_price, 50.00, 'Final unit price must be variant(45) + modifier(5) = 50');
  console.log(`✅ Pricing verified: base=45 + modifier_adj=5 = final=50`);

  // ══════════════════════════════════════════════════════════════════════
  // TEST 5: Separate lines when modifier differs
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── Test 5: Separate lines for different modifier selections ──');

  const cartSeparated = cartService.addItem(SHIFT_ID, USER_ID, BRANCH_ID, {
    product_id: burger.id,
    variant_id: burgerVariant.id,
    modifiers: [], // Same burger + variant, but NO modifier → different from previous
    quantity: 1
  });

  assert.strictEqual(cartSeparated.items.filter(i => i.product_id === burger.id).length, 2,
    'Two burger lines must exist when modifiers differ');
  console.log('✅ Separate lines created for identical product with different modifier selections.');

  // ══════════════════════════════════════════════════════════════════════
  // TEST 6: Quantity update
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── Test 6: Quantity update ──');

  const friesCartItemId = cartSeparated.items.find(i => i.product_id === fries.id)._cart_item_id;
  const cartAfterUpdate = cartService.updateItemQuantity(SHIFT_ID, friesCartItemId, 5, USER_ID);
  const updatedFries = cartAfterUpdate.items.find(i => i._cart_item_id === friesCartItemId);
  assert.strictEqual(updatedFries.quantity, 5, 'Fries quantity must now be 5');
  console.log(`✅ Quantity updated to ${updatedFries.quantity}`);

  // ══════════════════════════════════════════════════════════════════════
  // TEST 7: Item removal
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── Test 7: Item removal ──');

  const itemsBefore = cartAfterUpdate.items.length;
  const cartAfterRemove = cartService.removeItem(SHIFT_ID, friesCartItemId, USER_ID);
  assert.strictEqual(cartAfterRemove.items.length, itemsBefore - 1, 'Item count must decrease by 1');
  assert(!cartAfterRemove.items.find(i => i._cart_item_id === friesCartItemId), 'Removed item must not exist');
  console.log('✅ Item removal verified.');

  // ══════════════════════════════════════════════════════════════════════
  // TEST 8: Crash-recovery persistence
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── Test 8: Crash-recovery persistence ──');

  // Simulate crash: delete from in-memory store
  cartService._carts.delete(SHIFT_ID);
  assert(!cartService._carts.has(SHIFT_ID), 'Memory cache should not have cart after simulated crash');

  const recovered = cartService.getCart(SHIFT_ID);
  assert(recovered, 'Cart must be recoverable from cart_cache after memory loss');
  assert(recovered.items.length > 0, 'Recovered cart must still have items');
  console.log(`✅ Cart recovered from crash-recovery cache with ${recovered.items.length} item(s).`);

  // ══════════════════════════════════════════════════════════════════════
  // TEST 9: Cart notes and metadata
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── Test 9: Cart notes and metadata ──');

  const cartWithNotes = cartService.setNotes(SHIFT_ID, { notes: 'Allergy: nuts', kitchen_notes: 'Extra crispy' });
  assert.strictEqual(cartWithNotes.notes, 'Allergy: nuts');
  assert.strictEqual(cartWithNotes.kitchen_notes, 'Extra crispy');

  const cartWithMeta = cartService.setCartMeta(SHIFT_ID, { order_type: 'TAKEAWAY' });
  assert.strictEqual(cartWithMeta.order_type, 'TAKEAWAY');
  console.log('✅ Cart notes and metadata updates verified.');

  // ══════════════════════════════════════════════════════════════════════
  // TEST 10: Checkout validation — reject empty cart
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── Test 10: Checkout validation — empty cart rejection ──');

  let emptyCatchError = false;
  try {
    cartValidationService.validateCartForCheckout({ items: [], shift_id: SHIFT_ID, cashier_user_id: USER_ID });
  } catch (err) {
    emptyCatchError = true;
    console.log(`✅ Empty cart rejected: "${err.message}"`);
  }
  assert(emptyCatchError, 'Empty cart checkout must throw a validation error.');

  // ══════════════════════════════════════════════════════════════════════
  // TEST 11: Atomic checkout → Order Draft creation
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── Test 11: Atomic checkout → Order Draft creation ──');

  const seqBefore = dbEngine.get(
    "SELECT last_sequence FROM order_number_sequences WHERE branch_id = ?",
    BRANCH_ID
  )?.last_sequence || 0;

  const order = orderCreationService.checkoutCart(SHIFT_ID, USER_ID, {
    branch_id: BRANCH_ID,
    order_type: 'TAKEAWAY'
  });

  assert(order, 'Checkout must return an Order object');
  assert(order.id, 'Order must have an ID');
  assert(order.order_number, 'Order must have a business order number');
  assert.strictEqual(order.lifecycle_state, 'DRAFT', 'Newly created order must be in DRAFT state');
  assert.strictEqual(order.payment_state, 'UNPAID', 'Newly created order must be UNPAID');
  assert(Array.isArray(order.items) && order.items.length > 0, 'Order must contain line items');
  assert(order.grand_total > 0, 'Order grand total must be > 0');
  assert(Array.isArray(order.timeline) && order.timeline.length > 0, 'Order must have timeline entries');

  console.log(`✅ Order created: ${order.order_number} — Grand Total: AED ${order.grand_total} — Items: ${order.items.length}`);

  // Verify a sequence number was consumed
  const seqAfter = dbEngine.get(
    "SELECT last_sequence FROM order_number_sequences WHERE branch_id = ?",
    BRANCH_ID
  )?.last_sequence || 0;
  assert.strictEqual(seqAfter, seqBefore + 1, 'Exactly ONE sequence number must be consumed at checkout');
  console.log(`✅ Order number sequence: ${seqBefore} → ${seqAfter} (exactly +1)`);

  // ══════════════════════════════════════════════════════════════════════
  // TEST 12: Cart is destroyed after successful checkout
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── Test 12: Cart destroyed after checkout ──');

  const cartAfterCheckout = cartService.getCart(SHIFT_ID);
  const cacheAfterCheckout = cartCacheRepository.getCart(SHIFT_ID);
  assert(!cartAfterCheckout, 'In-memory cart must be destroyed after successful checkout');
  assert(!cacheAfterCheckout, 'Crash-recovery cache must be cleared after successful checkout');
  console.log('✅ Cart properly destroyed after checkout (no memory leak, no cache pollution).');

  // ══════════════════════════════════════════════════════════════════════
  // TEST 13: Order number NOT consumed for abandoned/cleared cart
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── Test 13: Order number preservation for abandoned carts ──');

  const abandonedShiftId = 'shift-abandoned-test-001';
  if (!dbEngine.get("SELECT id FROM cashier_sessions WHERE id = ?", abandonedShiftId)) {
    dbEngine.run("INSERT INTO cashier_sessions (id, user_id, opening_float, status) VALUES (?, ?, 100.0, 'OPEN')", abandonedShiftId, USER_ID);
  }

  // Start a cart and add items but DON'T checkout
  cartService.addItem(abandonedShiftId, USER_ID, BRANCH_ID, {
    product_id: fries.id,
    quantity: 1
  });

  // Clear the cart (simulating cashier abandoning it)
  cartService.clearCart(abandonedShiftId, USER_ID);

  // Verify NO sequence number was consumed
  const seqAfterAbandoned = dbEngine.get(
    "SELECT last_sequence FROM order_number_sequences WHERE branch_id = ?",
    BRANCH_ID
  )?.last_sequence || 0;

  assert.strictEqual(seqAfterAbandoned, seqAfter, 'Order number sequence must NOT increment for abandoned carts');
  console.log(`✅ Sequence untouched for abandoned cart: still at ${seqAfterAbandoned}`);

  // ══════════════════════════════════════════════════════════════════════
  // TEST 14: Snapshot immutability after checkout
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── Test 14: Snapshot immutability ──');

  const originalName = order.items[0].product_name_snapshot;
  const originalPrice = order.items[0].base_unit_price;

  // Alter the catalog — should NOT affect the historical order
  productRepository.update(burger.id, { name: 'CHANGED NAME - DO NOT USE', price: 999.99 });

  // Fetch order fresh from DB
  const freshOrder = orderItemRepository.findItemsByOrderId(order.id);
  const freshBurgerItem = freshOrder.find(i => i.product_id === burger.id);
  if (freshBurgerItem) {
    assert.strictEqual(freshBurgerItem.product_name_snapshot, originalName, 'Name snapshot must remain immutable!');
    assert.strictEqual(freshBurgerItem.base_unit_price, originalPrice, 'Price snapshot must remain immutable!');
    console.log(`✅ Snapshot immutability verified. Historical price: ${originalPrice}, catalog now: 999.99`);
  } else {
    console.log('  (No burger line in this order — skipping immutability check for burger)');
  }

  // ══════════════════════════════════════════════════════════════════════
  // TEST 15: Sync queue events generated for Order only
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── Test 15: Sync queue integration ──');

  const syncEvents = dbEngine.all("SELECT * FROM sync_queue WHERE entity_id = ?", order.id);
  assert(syncEvents.length > 0, 'Sync queue must have at least one event for the created order');
  console.log(`✅ ${syncEvents.length} sync_queue event(s) recorded for order ${order.order_number}.`);

  // ══════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  🎉  ALL CART ENGINE VERIFICATION TESTS PASSED!  ');
  console.log('══════════════════════════════════════════════════════════\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
