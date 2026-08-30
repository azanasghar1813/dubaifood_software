import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { ZipArchive } from 'archiver';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-core-'));
process.env.JWT_SECRET = 'test-jwt-secret-16chars';
process.env.DEVICE_SECRET = 'test-device-secret-16';
process.env.NODE_ENV = 'test';
process.env.STORAGE_ROOT = tmpRoot;
process.env.DEFAULT_ADMIN_PIN = '582941';
process.env.PORT = '5099';
process.env.HOST = '127.0.0.1';

const { initDatabase } = await import('../database/initDatabase.js');
const { dbEngine } = await import('../database/sqlite.js');
const { authService } = await import('../services/authService.js');
const { backupService } = await import('../backup/backupService.js');
const { cartService } = await import('../services/cartService.js');
const { orderCreationService } = await import('../services/orderCreationService.js');
const { paymentService } = await import('../services/paymentService.js');

let sessionId;
let userId;

before(async () => {
  await initDatabase();
});

after(() => {
  try { dbEngine.close(); } catch {}
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
});

test('archiver ZipArchive named export can write a zip', async () => {
  const zipPath = path.join(tmpRoot, 'archiver-smoke.zip');
  const payload = path.join(tmpRoot, 'hello.txt');
  fs.writeFileSync(payload, 'ok');
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 1 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.file(payload, { name: 'hello.txt' });
    archive.finalize();
  });
  assert.equal(fs.existsSync(zipPath), true);
  assert.ok(fs.statSync(zipPath).size > 0);
});

test('login succeeds with the default admin PIN', () => {
  const result = authService.login('admin', '1234', 'TEST');
  assert.ok(result.token);
  assert.equal(result.user.username, 'admin');
  assert.ok(result.cashierSessionId);
  sessionId = result.cashierSessionId;
  userId = result.user.id;
});

test('checkout then cash payment is idempotent', () => {
  const category = dbEngine.prepare('SELECT id FROM categories LIMIT 1').get();
  assert.ok(category);
  const productId = crypto.randomUUID();
  dbEngine.prepare(`
    INSERT INTO products (id, category_id, product_code, name, display_name, short_name, price, cost, lifecycle_state, status, visibility)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'AVAILABLE', 'VISIBLE')
  `).run(productId, category.id, 'TEST-BURGER', 'Test Burger', 'Test Burger', 'Test Burger', 100, 40);

  cartService.addItem(sessionId, userId, 'DEFAULT_BRANCH', {
    product_id: productId,
    quantity: 1
  });

  const checkoutKey = crypto.randomUUID();
  const order = orderCreationService.checkoutCart(sessionId, userId, {}, checkoutKey);
  assert.ok(order.id);
  assert.ok(order.order_number);

  const payKey = crypto.randomUUID();
  const first = paymentService.processPayment(order.id, sessionId, userId, {
    payment_method: 'CASH',
    amount_received: 100
  }, payKey);
  assert.ok(first.payment);

  const second = paymentService.processPayment(order.id, sessionId, userId, {
    payment_method: 'CASH',
    amount_received: 100
  }, payKey);
  assert.equal(second.payment.id, first.payment.id);
});

test('backup create writes a zip', async () => {
  const result = await backupService.createBackup('test');
  assert.ok(result.file);
  assert.equal(fs.existsSync(result.file), true);
  assert.ok(result.size > 0);
});
