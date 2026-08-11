import { dbEngine } from './src/database/sqlite.js';
import { cartService } from './src/services/cartService.js';
import { orderCreationService } from './src/services/orderCreationService.js';
import { userRepository } from './src/repositories/userRepository.js';
import { cashierSessionRepository } from './src/repositories/cashierSessionRepository.js';
import { productRepository } from './src/repositories/productRepository.js';

(async () => {
  try {
    dbEngine.connect('storage/database/pos.db');
    
    // Find Owner or Super Admin
    const user = dbEngine.get("SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name IN ('Owner', 'Super Admin') LIMIT 1");
    if (!user) throw new Error("No user found");
    console.log("Testing with user:", user.username, user.role_name);

    // Ensure session
    let session = cashierSessionRepository.findOpenSessionForUser(user.id);
    if (!session) {
      const sessionId = require('crypto').randomUUID();
      dbEngine.run("INSERT INTO cashier_sessions (id, cashier_user_id, status) VALUES (?, ?, 'OPEN')", sessionId, user.id);
      session = { id: sessionId };
    }

    // Add item
    const product = dbEngine.get("SELECT * FROM products LIMIT 1");
    if (!product) throw new Error("No product found");

    cartService.addItem(session.id, user.id, 'DEFAULT_BRANCH', {
      product_id: product.id,
      quantity: 1,
      modifiers: []
    });

    console.log("Item added to cart");

    // Checkout
    const order = orderCreationService.checkoutCart(session.id, user.id, {
      order_type: 'DINE_IN',
      branch_id: 'DEFAULT_BRANCH'
    });
    
    console.log("SUCCESS! Order created:", order.order_number);
  } catch (e) {
    console.error("FAIL:", e);
  }
})();
