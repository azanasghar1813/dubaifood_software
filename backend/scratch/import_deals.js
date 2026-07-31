import Database from 'better-sqlite3';
import crypto from 'crypto';

const db = new Database('storage/database/pos.db');

const dealsData = [
  { name: 'Deal #1', price: 1250, items: [{ name: 'Small Pizza', qty: 2 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #2', price: 2200, items: [{ name: 'Medium Pizza', qty: 2 }, { name: '1.5 L Drink', qty: 1 }] },
  { name: 'Deal #3', price: 3000, items: [{ name: 'Large Pizza', qty: 2 }, { name: '1.5 L Drink', qty: 1 }] },
  { name: 'Deal #4', price: 3100, items: [{ name: 'XL Pizza', qty: 1 }, { name: 'Medium Pizza', qty: 1 }, { name: '2.5 L Drink', qty: 1 }] },
  { name: 'Deal #5 (Birthday Deal)', price: 4750, items: [{ name: 'Large Pizza', qty: 2 }, { name: 'Zinger Burger', qty: 3 }, { name: 'Chicken Shawarma', qty: 3 }, { name: '1.5 L Drink', qty: 2 }] },
  { name: 'Deal #6', price: 2000, items: [{ name: 'Medium Pizza', qty: 1 }, { name: 'Zinger Burger', qty: 2 }, { name: 'Small Fries', qty: 1 }, { name: '1.5 L Drink', qty: 1 }] },
  { name: 'Deal #7', price: 1500, items: [{ name: 'Small Pizza', qty: 1 }, { name: 'Zinger Burger', qty: 2 }, { name: 'Large Shawarma', qty: 1 }, { name: '1 L Drink', qty: 1 }] },
  { name: 'Deal #8', price: 1850, items: [{ name: 'Zinger Burger', qty: 5 }, { name: '1.5 L Drink', qty: 1 }] },
  { name: 'Deal #9', price: 1150, items: [{ name: 'Zinger Burger', qty: 3 }, { name: '1 L Drink', qty: 1 }] },
  { name: 'Deal #10', price: 800, items: [{ name: 'Zinger Burger', qty: 2 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #11', price: 680, items: [{ name: 'Zinger Burger', qty: 1 }, { name: 'Chicken Hot Wings', qty: 5 }] },
  { name: 'Deal #12', price: 680, items: [{ name: 'Chicken Nuggets', qty: 10 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #13', price: 1050, items: [{ name: 'Chicken Burger', qty: 5 }, { name: '1.5 L Drink', qty: 1 }] },
  { name: 'Deal #14', price: 950, items: [{ name: 'Chicken Shawarma (Large)', qty: 5 }, { name: '1 L Drink', qty: 1 }] },
  { name: 'Deal #15', price: 1600, items: [{ name: 'L Chicken Cheese Pasta', qty: 2 }, { name: '1 L Drink', qty: 1 }] },
  { name: 'Deal #16', price: 1000, items: [{ name: 'Small Chicken Cheese Pasta', qty: 2 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #17', price: 780, items: [{ name: 'Malai Boti Roll', qty: 1 }, { name: 'Small Fries', qty: 1 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #18', price: 1350, items: [{ name: 'Turkish Sandwich', qty: 3 }, { name: 'Zinger Burger', qty: 1 }, { name: '1 L Drink', qty: 1 }] },
  { name: 'Deal #19', price: 750, items: [{ name: 'Pizza Burger', qty: 1 }, { name: 'Small Fries', qty: 1 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #20', price: 900, items: [{ name: 'Tower Burger', qty: 1 }, { name: 'Chicken Hot Wings', qty: 4 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #21', price: 600, items: [{ name: 'Chicken Patty Burger', qty: 1 }, { name: 'Medium Fries', qty: 1 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #22', price: 500, items: [{ name: 'Chapli Kebab Burger', qty: 1 }, { name: 'Small Fries', qty: 1 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #23', price: 600, items: [{ name: 'Grilled Burger', qty: 1 }, { name: 'Small Fries', qty: 1 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #24', price: 700, items: [{ name: 'Zinger Paratha', qty: 2 }, { name: 'Small Fries', qty: 1 }] },
  { name: 'Deal #25', price: 630, items: [{ name: 'Kebab Paratha', qty: 1 }, { name: 'Medium Fries', qty: 1 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #26', price: 780, items: [{ name: 'Hot Wings', qty: 10 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #27', price: 1100, items: [{ name: 'Loaded Fries', qty: 1 }, { name: 'Chicken Wings', qty: 4 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #28', price: 1500, items: [{ name: 'Chicken Hot Wings', qty: 20 }, { name: '1 L Drink', qty: 1 }] },
  { name: 'Deal #29', price: 1300, items: [{ name: 'Chicken Nuggets', qty: 20 }, { name: '1 L Drink', qty: 1 }] },
  { name: 'Deal #30', price: 730, items: [{ name: 'Italian Roll', qty: 1 }, { name: 'Small Fries', qty: 1 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #31', price: 680, items: [{ name: 'Turkish Paratha', qty: 2 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #32', price: 850, items: [{ name: 'Chicken Cheese Small Pasta', qty: 1 }, { name: 'Chicken Hot Wings', qty: 4 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #33', price: 900, items: [{ name: 'Malai Boti Roll', qty: 1 }, { name: 'Chicken Hot Wings', qty: 4 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #34', price: 980, items: [{ name: 'Zinger Burger', qty: 1 }, { name: 'Turkish Paratha', qty: 1 }, { name: 'Medium Fries', qty: 1 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #35', price: 1320, items: [{ name: 'L Chicken Cheese Pasta', qty: 1 }, { name: 'Chicken Nuggets', qty: 6 }, { name: 'Small Fries', qty: 1 }, { name: '500 ml Drink', qty: 1 }] },
  { name: 'Deal #36', price: 1800, items: [{ name: 'Chicken Shawarma', qty: 10 }, { name: '1 L Drink', qty: 1 }] },
];

let defaultCategoryId = db.prepare('SELECT id FROM categories LIMIT 1').get()?.id;
if (!defaultCategoryId) {
  defaultCategoryId = crypto.randomUUID();
  db.prepare('INSERT INTO categories (id, name, lifecycle_state) VALUES (?, ?, ?)').run(defaultCategoryId, 'General', 'ACTIVE');
}

const getOrCreateProduct = (name) => {
  let product = db.prepare('SELECT id FROM products WHERE name LIKE ?').get('%' + name + '%');
  if (!product) {
    const id = crypto.randomUUID();
    const productCode = 'PRD-' + Date.now().toString().slice(-4) + '-' + Math.floor(Math.random() * 1000);
    db.prepare('INSERT INTO products (id, category_id, product_code, name, price, lifecycle_state) VALUES (?, ?, ?, ?, ?, ?)').run(
      id, defaultCategoryId, productCode, name, 0, 'ACTIVE'
    );
    return id;
  }
  return product.id;
};

db.transaction(() => {
  for (const deal of dealsData) {
    // Check if deal already exists
    const existing = db.prepare('SELECT id FROM deals WHERE name = ?').get(deal.name);
    if (existing) {
      console.log('Deal ' + deal.name + ' already exists. Skipping.');
      continue;
    }

    const dealId = crypto.randomUUID();
    const dealCode = 'DL-' + Date.now().toString().slice(-4) + '-' + Math.floor(Math.random() * 1000);
    
    db.prepare('INSERT INTO deals (id, code, name, description, price, lifecycle_state) VALUES (?, ?, ?, ?, ?, ?)').run(
      dealId, dealCode, deal.name, '', deal.price, 'ACTIVE'
    );

    for (const item of deal.items) {
      const productId = getOrCreateProduct(item.name);
      const componentId = crypto.randomUUID();
      db.prepare('INSERT INTO deal_components (id, deal_id, product_id, quantity) VALUES (?, ?, ?, ?)').run(
        componentId, dealId, productId, item.qty
      );
    }
    console.log('Created ' + deal.name);
  }
})();

console.log('All deals created successfully.');
