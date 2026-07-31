const db = require('better-sqlite3')('storage/database/pos.db');
const { v4: uuidv4 } = require('uuid');

const restaurantId = '66f1293c-4e70-4c2f-980e-29332fea9b1a'; // Restaurant top-level category

const categoryOrder = [
  'Chicken',
  'Mutton',
  'Beef',
  'Bar BQ',
  'Spicy Injected Broast',
  'Rices',
  'Starters',
  'Tandoor',
  'Chinese Gravy',
  'Noodles',
  'Soups',
  'Salads',
  'Hot & Cold Drinks',
  'Special Drinks',
  'Ice Cream',
  'Bar-B-Q Platers'
];

const menuData = {
  'Spicy Injected Broast': [
    { name: 'Half Broast (4 Pieces)', prices: [1100] },
    { name: 'Full Broast (8 Pieces)', prices: [2100] }
  ],
  'Starters': [
    { name: 'Chicken Dhaka', prices: [1050] },
    { name: 'Chicken Pakora', prices: [900] },
    { name: 'Honey Wings', prices: [690] },
    { name: 'Fish Crackers', prices: [300] }
  ],
  'Soups': [
    { name: 'Special Soup', prices: [1100, 600], variantNames: ['Full', 'Half'] },
    { name: 'Hot & Sour Soup', prices: [900, 550], variantNames: ['Full', 'Half'] },
    { name: 'Chicken Corn Soup', prices: [900, 550], variantNames: ['Full', 'Half'] },
    { name: 'Vegetable Soup', prices: [700, 400], variantNames: ['Full', 'Half'] }
  ],
  'Bar-B-Q Platers': [
    { name: 'Full Platter', prices: [3600], desc: '4 Piece Kabab, 1 Seekh Tikka Boti, 1 Seekh Malai Boti, 1 Tikka Piece (Leg), 1 Seekh Shish Tawook, 2 Piece Kalmi Tikka, 2 Piece Naan, Yakhni Pulao' },
    { name: 'Half Platter', prices: [2400], desc: '2 Piece Kabab, 1 Seekh Tikka Boti, 1 Kastoori Boti, 1 Tikka Piece, 2 Piece Naan, Yakhni Pulao' }
  ],
  'Salads': [
    { name: 'SP Salad Platter', prices: [1090] },
    { name: 'Russian Salad', prices: [690] },
    { name: 'Chicken Pineapple Salad', prices: [890] },
    { name: 'Kachumar Salad', prices: [90] },
    { name: 'Fresh Green Salad', prices: [70] },
    { name: 'Raita', prices: [70] }
  ],
  'Tandoor': [
    { name: 'SP Chicken Cheese Naan', prices: [400] },
    { name: 'Garlic Naan', prices: [90] },
    { name: 'Ginger Naan', prices: [90] },
    { name: 'Kalwanji Naan', prices: [70] },
    { name: 'Roghni Naan', prices: [80] },
    { name: 'Tandoori Paratha', prices: [90] },
    { name: 'Sada Naan', prices: [70] },
    { name: 'Sada Roti', prices: [14] },
    { name: 'Roti Per Head', prices: [140] }
  ],
  'Hot & Cold Drinks': [
    { name: 'Mint Margarita', prices: [150] },
    { name: 'Lemonade', prices: [120] },
    { name: 'Fresh Lime 7up', prices: [90] },
    { name: 'Regular Soft Drink', prices: [70] },
    { name: 'Tin Pack', prices: [120] },
    { name: 'Soft Drink (1.5L)', prices: [220] },
    { name: 'Mineral Water (1L)', prices: [90] },
    { name: 'SP Tea', prices: [80] },
    { name: 'SP Gurh Tea', prices: [100] },
    { name: 'Green Tea', prices: [60] }
  ],
  'Rices': [
    { name: 'Special Fried Rice', prices: [1000, 700], variantNames: ['Full', 'Half'] },
    { name: 'Chicken Fried Rice', prices: [950, 650], variantNames: ['Full', 'Half'] },
    { name: 'Chicken Masala Rice', prices: [950, 650], variantNames: ['Full', 'Half'] },
    { name: 'Chicken Shashlik with Rice', prices: [1100] },
    { name: 'Vegetable Fried Rice', prices: [800, 400], variantNames: ['Full', 'Half'] },
    { name: 'Chicken Biryani', prices: [1000, 550], variantNames: ['Full', 'Half'] },
    { name: 'Beef Bannu Pulao', prices: [900, 480], variantNames: ['Full', 'Half'] },
    { name: 'Jangi Pulao', prices: [1200, 650], variantNames: ['Full', 'Half'] },
    { name: 'Plain Rice', prices: [600] }
  ],
  'Chinese Gravy': [
    { name: 'Special Pineapple Cherry', prices: [1200] },
    { name: 'Chicken Manchurian', prices: [1000] },
    { name: 'Chicken Almond', prices: [1100] },
    { name: 'Chicken Chili Dry', prices: [1000] }
  ],
  'Noodles': [
    { name: 'Special Chow Mein', prices: [900] },
    { name: 'Chicken Chow Mein', prices: [800] },
    { name: 'Vegetable Chow Mein', prices: [700] }
  ],
  'Special Drinks': [
    { name: 'Blueberry', prices: [70, 100], variantNames: ['Regular', 'Large'] },
    { name: 'Pineapple', prices: [70, 100], variantNames: ['Regular', 'Large'] },
    { name: 'Imli', prices: [70, 100], variantNames: ['Regular', 'Large'] },
    { name: 'Red Anar', prices: [70, 100], variantNames: ['Regular', 'Large'] },
    { name: 'Lychee', prices: [70, 100], variantNames: ['Regular', 'Large'] },
    { name: 'Guava', prices: [70, 100], variantNames: ['Regular', 'Large'] },
    { name: 'Strawberry', prices: [70, 100], variantNames: ['Regular', 'Large'] },
    { name: 'Falsa', prices: [80, 100], variantNames: ['Regular', 'Large'] },
    { name: 'Mint Margarita (Special)', prices: [150, 150], variantNames: ['Regular', 'Large'] }
  ],
  'Ice Cream': [
    { name: 'Surprise Special', prices: [280] },
    { name: '3 Scoop Ice Cream', prices: [240] },
    { name: '2 Scoop Ice Cream', prices: [160] },
    { name: '1 Scoop Ice Cream', prices: [80] }
  ],
  'Mutton': [
    { name: 'Special Mutton Karahi', prices: [3600, 1850], variantNames: ['Full', 'Half'] },
    { name: 'Mutton Karahi', prices: [3400, 1850], variantNames: ['Full', 'Half'] },
    { name: 'Mutton White Karahi', prices: [3500, 1850], variantNames: ['Full', 'Half'] },
    { name: 'Mutton Shinwari Karahi', prices: [3500, 1850], variantNames: ['Full', 'Half'] },
    { name: 'Mutton Handi', prices: [3600, 1850], variantNames: ['Full', 'Half'] },
    { name: 'Mutton White Handi', prices: [3600, 1850], variantNames: ['Full', 'Half'] },
    { name: 'Mutton Achari Handi', prices: [3600, 1850], variantNames: ['Full', 'Half'] },
    { name: 'Mutton Arabian', prices: [2050] },
    { name: 'Mutton Hari Mirch', prices: [1890] },
    { name: 'Mutton Chili Lemon', prices: [1890] },
    { name: 'Mutton Machli', prices: [1900] }
  ],
  'Beef': [
    { name: 'Special Beef Karahi', prices: [2200, 1100], variantNames: ['Full', 'Half'] },
    { name: 'Beef Karahi', prices: [1900, 1000], variantNames: ['Full', 'Half'] },
    { name: 'Beef White Karahi', prices: [1950, 1050], variantNames: ['Full', 'Half'] },
    { name: 'Beef Rosh', prices: [1500] }, // Price was not clearly shown, setting to 1500 placeholder
    { name: 'Beef Namkeen Fry', prices: [600] }
  ],
  'Chicken': [
    { name: 'Special Chicken Karahi', prices: [1850, 950], variantNames: ['Full', 'Half'] },
    { name: 'Chicken Karahi', prices: [1650, 750], variantNames: ['Full', 'Half'] },
    { name: 'Chicken White Karahi', prices: [1750, 850], variantNames: ['Full', 'Half'] },
    { name: 'Chicken Handi', prices: [1750, 950], variantNames: ['Full', 'Half'] },
    { name: 'Chicken White Handi', prices: [1850, 950], variantNames: ['Full', 'Half'] },
    { name: 'Chicken Achari Handi', prices: [1650, 850], variantNames: ['Full', 'Half'] },
    { name: 'Chicken Madrasi', prices: [1550, 850], variantNames: ['Full', 'Half'] },
    { name: 'Chicken Makhni', prices: [1550, 850], variantNames: ['Full', 'Half'] },
    { name: 'Chicken Bharta', prices: [1550, 850], variantNames: ['Full', 'Half'] },
    { name: 'Chicken Hari Mirch', prices: [1550, 850], variantNames: ['Full', 'Half'] },
    { name: 'Chicken Chili Lemon', prices: [1550, 850], variantNames: ['Full', 'Half'] },
    { name: 'Chicken Nawabi', prices: [1550, 850], variantNames: ['Full', 'Half'] },
    { name: 'Chicken Rajasthani', prices: [1550, 850], variantNames: ['Full', 'Half'] },
    { name: 'Chicken Jalfrezi', prices: [1400] },
    { name: 'Chicken Ginger', prices: [1300] },
    { name: 'Kabab Masala', prices: [990] },
    { name: 'Tikka Piece Masala', prices: [990] },
    { name: 'Shahi Daal', prices: [550] },
    { name: 'Mix Vegetables', prices: [500] },
    { name: 'Daal Makhni', prices: [650] },
    { name: 'Daal Mash', prices: [450] }
  ],
  'Bar BQ': [
    { name: 'Special Qalmi Tikka (6 pcs)', prices: [1400] },
    { name: 'Lebanese Kabab (6 pcs)', prices: [1380] },
    { name: 'Makmali Kabab (6 pcs)', prices: [1400] },
    { name: 'Reshmi Kabab (6 pcs)', prices: [1200] },
    { name: 'Chicken Kabab (6 pcs)', prices: [1080] },
    { name: 'Malai Boti (12 pcs)', prices: [1200] },
    { name: 'Shish Tawook Boti (12 pcs)', prices: [1200] },
    { name: 'Kastoori Boti (12 pcs)', prices: [1200] },
    { name: 'Bihari Boti (12 pcs)', prices: [1200] },
    { name: 'Green Boti (12 pcs)', prices: [1200] },
    { name: 'Tikka Boti (12 pcs)', prices: [1080] },
    { name: 'Tikka Piece (Chest)', prices: [430] },
    { name: 'Tikka Piece (Leg)', prices: [390] },
    { name: 'Malai Piece (Chest)', prices: [450] },
    { name: 'Malai Piece (Leg)', prices: [410] },
    { name: 'Fish Tikka (8 pcs)', prices: [1650] },
    { name: 'Lahori Grilled Fish (1 KG)', prices: [1600] }
  ]
};

db.transaction(() => {
  // 1. First, create missing categories
  const catIds = {};
  for (let i = 0; i < categoryOrder.length; i++) {
    const catName = categoryOrder[i];
    let cat = db.prepare('SELECT id FROM categories WHERE name = ? AND parent_id = ?').get(catName, restaurantId);
    if (!cat) {
      const newId = uuidv4();
      db.prepare(`
        INSERT INTO categories (id, name, parent_id, lifecycle_state, version, visibility, display_order) 
        VALUES (?, ?, ?, 'ACTIVE', 1, 'VISIBLE', ?)
      `).run(newId, catName, restaurantId, i);
      catIds[catName] = newId;
    } else {
      catIds[catName] = cat.id;
      db.prepare('UPDATE categories SET display_order = ? WHERE id = ?').run(i, cat.id);
    }
  }

  // 2. Clear out any old restaurant products that were seeded previously to avoid duplicates 
  // (Assuming any product that has category_id in catIds is a restaurant product)
  for (const catName of categoryOrder) {
    const cid = catIds[catName];
    const oldProducts = db.prepare('SELECT id FROM products WHERE category_id = ?').all(cid);
    for (const op of oldProducts) {
      db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(op.id);
      db.prepare('DELETE FROM products WHERE id = ?').run(op.id);
    }
  }

  // 3. Insert items and variants
  let nextCode = 200;
  for (const catName of categoryOrder) {
    const cid = catIds[catName];
    const items = menuData[catName];
    
    for (const item of items) {
      const pId = uuidv4();
      const codeStr = nextCode.toString();
      nextCode++;
      
      const isVariant = item.prices.length > 1;
      const basePrice = isVariant ? 0 : item.prices[0];
      
      db.prepare(`
        INSERT INTO products (
          id, name, category_id, product_code, price, cost, 
          track_inventory, lifecycle_state, version, 
          description, visibility, status
        ) VALUES (
          ?, ?, ?, ?, ?, 0,
          0, 'ACTIVE', 1,
          ?, 'VISIBLE', 'AVAILABLE'
        )
      `).run(
        pId, item.name, cid, codeStr, basePrice, item.desc || null
      );
      
      if (isVariant) {
        for (let j = 0; j < item.prices.length; j++) {
          const vName = item.variantNames ? item.variantNames[j] : (j === 0 ? 'Full' : 'Half');
          const vPrice = item.prices[j];
          
          db.prepare(`
            INSERT INTO product_variants (
              id, product_id, name, sku, price, display_order, lifecycle_state, version
            ) VALUES (
              ?, ?, ?, ?, ?, ?, 'ACTIVE', 1
            )
          `).run(uuidv4(), pId, vName, `${codeStr}-${vName}`, vPrice, j);
        }
      }
    }
  }
})();

console.log('Seeded Restaurant Menu Successfully!');
