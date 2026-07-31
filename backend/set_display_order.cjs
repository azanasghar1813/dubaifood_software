const db = require('better-sqlite3')('storage/database/pos.db');

const order = [
  "Chicken Tikka Pizza",
  "Chicken Fajita Pizza",
  "Shahi Pizza",
  "Bone Fire Pizza",
  "Max Pizza",
  "Vegetable Pizza",
  "Chicken Supreme Pizza",
  "Chicken Achari Pizza",
  "Chicken Tandoori Pizza",
  "Hot & Spicy Pizza",
  "Kababish Pizza",
  "Max Special Pizza",
  "Afghani Pizza",
  "Malai Boti Pizza",
  "Seekh Kebab Pizza",
  "Sausage Pizza",
  "Chicken Pepperoni Pizza",
  "Cheese Lover Pizza",
  "Chicken Mughlai Pizza",
  "Double Cheese Pizza",
  "S.S. Pizza",
  "Crown Crust Pizza",
  "Kebab Stuffer Pizza",
  "Cheese Stuffer Pizza",
  "Max Special Square Pizza",
  "Zinger Burger",
  "Double Zinger Burger",
  "Chicken Burger",
  "Chicken Cheese Burger",
  "Zinger Cheese Burger",
  "Grilled Burger",
  "Tower Burger",
  "Pizza Burger",
  "Malai Boti Burger",
  "Chapli Burger",
  "Fish Burger",
  "Chicken Shawarma",
  "Chicken Shawarma (Large)",
  "Zinger Shawarma",
  "Zinger Shawarma (Large)",
  "Cheese Shawarma",
  "Cheese Shawarma (Large)",
  "Platter Shawarma",
  "Pizza Shawarma",
  "Zinger Paratha Roll",
  "Chicken Paratha Roll",
  "Chicken Cheese Paratha Roll",
  "Kebab Paratha Roll",
  "Malai Boti Paratha Roll",
  "Zinger Cheese Paratha Roll",
  "Turkish Paratha Roll",
  "Arabic Paratha Roll",
  "Italian Paratha Roll",
  "Max Special Paratha Roll",
  "Chicken Macaroni Pasta",
  "Chicken Cheese Pasta",
  "Max Special Pasta",
  "Spaghetti Pasta",
  "Fries",
  "Masala Fries",
  "Mayo Garlic Fries",
  "Loaded Fries",
  "Max Special Fries",
  "Hot Wings (10 Pcs)",
  "Fried Chicken (1 Pc)",
  "Nuggets (10 Pcs)",
  "Chicken Sandwich",
  "Club Sandwich",
  "Grilled Sandwich",
  "Max Special Sandwich",
  "Extra Cheese",
  "Extra Topping",
  "Extra Kebab",
  "Extra Dip Sauce"
];

try {
  const updateStmt = db.prepare('UPDATE products SET display_order = ? WHERE name = ?');
  
  db.transaction(() => {
    order.forEach((name, index) => {
      updateStmt.run(index + 1, name);
    });
  })();
  
  console.log('Successfully updated display_order for products');
} catch (e) {
  console.error('Failed to update display_order:', e);
}
