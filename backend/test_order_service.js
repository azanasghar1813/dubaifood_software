import { orderService } from './src/services/orderService.js';
import { dbEngine } from './src/database/sqlite.js';

try {
  dbEngine.connect('storage/database/pos.db');
  
  // Test with product
  const products = dbEngine.prepare('SELECT id FROM products LIMIT 1').all();
  if (products.length > 0) {
    const productId = products[0].id;
    console.log('Testing with product ID:', productId);
    
    orderService.addItemToDraft('session-1', 'user-1', {
      product_id: productId,
      quantity: 1
    }).then(res => console.log('Product Success:', res))
      .catch(e => console.error('Product Error:', e.message));
  }
} catch (e) {
  console.error(e);
}
