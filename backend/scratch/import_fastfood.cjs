const Database = require('better-sqlite3');
const crypto = require('crypto');

const db = new Database('storage/database/pos.db');

// Hide old data
db.prepare('UPDATE categories SET lifecycle_state = ?').run('HIDDEN');
db.prepare('UPDATE products SET lifecycle_state = ?').run('HIDDEN');

let displayOrder = 10;
const nextOrder = () => { displayOrder += 10; return displayOrder; };

const addCategory = (name, parentId = null) => {
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO categories (id, name, parent_id, display_order, lifecycle_state) VALUES (?, ?, ?, ?, ?)').run(
    id, name, parentId, nextOrder(), 'ACTIVE'
  );
  return id;
};

const addProduct = (name, categoryId, price = 0) => {
  const id = crypto.randomUUID();
  const productCode = 'FF-' + Date.now().toString().slice(-4) + '-' + Math.floor(Math.random() * 1000);
  db.prepare(`
    INSERT INTO products (
      id, category_id, product_code, name, display_name, short_name, 
      price, display_order, lifecycle_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, categoryId, productCode, name, name, name, 
    price, nextOrder(), 'ACTIVE'
  );
  return id;
};

const addVariant = (productId, name, price) => {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO product_variants (
      id, product_id, name, price, display_order, lifecycle_state
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id, productId, name, price, nextOrder(), 'ACTIVE'
  );
};

db.transaction(() => {
  // Main Category
  const fastFoodId = addCategory('Fast Food');

  // 🍕 Regular Pizza (S / M / L / XL)
  const regPizzaId = addCategory('Regular Pizza', fastFoodId);
  const regularPizzas = [
    'Chicken Tikka Pizza', 'Chicken Fajita Pizza', 'Shahi Pizza', 'Bone Fire Pizza',
    'Max Pizza', 'Vegetable Pizza', 'Chicken Supreme Pizza', 'Chicken Achari Pizza',
    'Chicken Tandoori Pizza', 'Hot & Spicy Pizza'
  ];
  for (const name of regularPizzas) {
    const pid = addProduct(name, regPizzaId, 600); // Default to Small price
    addVariant(pid, 'Small', 600);
    addVariant(pid, 'Medium', 1050);
    addVariant(pid, 'Large', 1500);
    addVariant(pid, 'XL', 2000);
  }

  // ⭐ Premium Pizza (S / M / L / XL)
  const premPizzaId = addCategory('Premium Pizza', fastFoodId);
  const premiumPizzas = [
    'Malai Boti Pizza', 'Cheesy Lover Pizza', 'Special Lazania Pizza',
    'Behari Kabab Pizza', 'Dubai Special Pizza', 'Kabab Crown Crust Pizza',
    'Afghani Malai Boti Pizza', 'BBQ Pizza'
  ];
  for (const name of premiumPizzas) {
    const pid = addProduct(name, premPizzaId, 700);
    addVariant(pid, 'Small', 700);
    addVariant(pid, 'Medium', 1150);
    addVariant(pid, 'Large', 1650);
    addVariant(pid, 'XL', 2200);
  }

  // 🔲 Square Pizza (Special Edition)
  const sqPizzaId = addCategory('Square Pizza', fastFoodId);
  const sqId = addProduct('Square Pizza', sqPizzaId, 750);
  addVariant(sqId, 'Small', 750);
  addVariant(sqId, 'Medium', 1350);
  addVariant(sqId, 'Large', 1750);

  // 🍔 Burgers
  const burgersId = addCategory('Burgers', fastFoodId);
  const burgers = [
    { n: 'Zinger Burger', p: 350 }, { n: 'Grilled Burger', p: 380 }, { n: 'Chicken Burger', p: 180 },
    { n: 'Chapli Kabab Burger', p: 300 }, { n: 'Tower Burger', p: 550 }, { n: 'Patty Burger', p: 260 },
    { n: 'Turkish Burger', p: 260 }, { n: 'Pizza Burger', p: 520 }, { n: 'Double Decker Burger', p: 550 }
  ];
  for (const b of burgers) addProduct(b.n, burgersId, b.p);

  // 🌯 Pratha Rolls
  const prathaId = addCategory('Pratha Rolls', fastFoodId);
  const prathas = [
    { n: 'Zinger Pratha Roll', p: 300 }, { n: 'Chicken Pratha Roll', p: 300 },
    { n: 'Turkish Pratha Roll', p: 300 }, { n: 'Kabab Pratha Roll', p: 300 }
  ];
  for (const p of prathas) addProduct(p.n, prathaId, p.p);

  // 🌯 Special Rolls
  const splRollsId = addCategory('Special Rolls', fastFoodId);
  addProduct('Italian Roll', splRollsId, 500);
  addProduct('Malai Boti Roll', splRollsId, 550);

  // 🍝 Pasta
  const pastaId = addCategory('Pasta', fastFoodId);
  const pastId = addProduct('Chicken Cheese Pasta', pastaId, 500);
  addVariant(pastId, 'Small', 500);
  addVariant(pastId, 'Large', 750);

  // 🍗 Appetizers
  const appsId = addCategory('Appetizers', fastFoodId);
  const hwId = addProduct('Chicken Hot Wings', appsId, 420);
  addVariant(hwId, '6 pcs', 420);
  addVariant(hwId, '12 pcs', 840);
  addProduct('Nuggets (10 pcs)', appsId, 600);
  const friesId = addProduct('Fries', appsId, 150);
  addVariant(friesId, 'Small', 150);
  addVariant(friesId, 'Medium', 250);
  addVariant(friesId, 'Large', 300);
  addProduct('Loaded Fries', appsId, 750);
  addProduct('White Sauce', appsId, 50);

  // 🥪 Sandwich
  const sandwichId = addCategory('Sandwich', fastFoodId);
  addProduct('Turkish Sandwich', sandwichId, 300);
  addProduct('Chicken Club Sandwich', sandwichId, 300);
  addProduct('Grilled Cheesy Sandwich', sandwichId, 520);

  // 🌯 Shawarma
  const shawarmaId = addCategory('Shawarma', fastFoodId);
  const tsId = addProduct('Turkish Shawarma', shawarmaId, 200);
  addVariant(tsId, 'Regular', 200);
  addVariant(tsId, 'Large', 250);
  const csId = addProduct('Chicken Shawarma', shawarmaId, 150);
  addVariant(csId, 'Regular', 150);
  addVariant(csId, 'Large', 170);
  addProduct('Zinger Shawarma', shawarmaId, 300);
  addProduct('Platter Shawarma', shawarmaId, 350);
  addProduct('Kabab Shawarma', shawarmaId, 300);

  // ➕ Extra Toppings
  const toppingsId = addCategory('Extra Toppings', fastFoodId);
  addProduct('Extra Topping - Small Pizza', toppingsId, 100);
  addProduct('Extra Topping - Medium Pizza', toppingsId, 150);
  addProduct('Extra Topping - Large Pizza', toppingsId, 200);
  addProduct('Extra Topping - XL Pizza', toppingsId, 250);

})();

console.log('Fast Food menu imported successfully.');
