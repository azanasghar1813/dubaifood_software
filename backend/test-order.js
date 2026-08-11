import { dbEngine } from './src/database/sqlite.js';
import { orderCreationService } from './src/services/orderCreationService.js';
import { cartService } from './src/services/cartService.js';

dbEngine.connect('C:\\Users\\Azan\\Desktop\\Dubai Food Software\\backend\\storage\\database\\pos.db');

async function run() {
  try {
    const user = dbEngine.prepare('SELECT id FROM users LIMIT 1').get();
    const session = dbEngine.prepare("SELECT id FROM cashier_sessions WHERE status = 'OPEN' LIMIT 1").get();
    
    // Find a variant
    const variant = dbEngine.prepare("SELECT id, product_id FROM product_variants WHERE lifecycle_state = 'ACTIVE' LIMIT 1").get();
    
    if (!variant || !session || !user) {
      console.log('Missing data to test');
      return;
    }

    const sessionId = session.id;
    const userId = user.id;

    console.log('Adding item to cart...');
    cartService.addItem(sessionId, userId, 'DEFAULT_BRANCH', {
      product_id: variant.product_id,
      variant_id: variant.id,
      quantity: 1
    });

    console.log('Checking out...');
    const order = orderCreationService.checkoutCart(sessionId, userId, {
      branch_id: 'DEFAULT_BRANCH',
      order_type: 'DINE_IN'
    });

    console.log('SUCCESS! Order created:', order.order_number);
  } catch (err) {
    console.error('ERROR in checkout:', err);
  }
}

run();
