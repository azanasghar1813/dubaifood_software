import { categoryService } from './services/categoryService.js';
import { productService } from './services/productService.js';
import { variantService } from './services/variantService.js';
import { initDatabase } from './database/initDatabase.js';

// The system expects a userId for logs, use 'SYSTEM'
const USER_ID = 'SYSTEM';

const fastFoodData = {
  name: 'Fast Food',
  subcategories: [
    {
      name: 'Regular Pizza',
      products: [
        { name: 'Chicken Tikka Pizza', variants: [{name: 'Small', price: 600}, {name: 'Medium', price: 1050}, {name: 'Large', price: 1500}, {name: 'XL', price: 2000}] },
        { name: 'Chicken Fajita Pizza', variants: [{name: 'Small', price: 600}, {name: 'Medium', price: 1050}, {name: 'Large', price: 1500}, {name: 'XL', price: 2000}] },
        { name: 'Shahi Pizza', variants: [{name: 'Small', price: 600}, {name: 'Medium', price: 1050}, {name: 'Large', price: 1500}, {name: 'XL', price: 2000}] },
        { name: 'Bone Fire Pizza', variants: [{name: 'Small', price: 600}, {name: 'Medium', price: 1050}, {name: 'Large', price: 1500}, {name: 'XL', price: 2000}] },
        { name: 'Max Pizza', variants: [{name: 'Small', price: 600}, {name: 'Medium', price: 1050}, {name: 'Large', price: 1500}, {name: 'XL', price: 2000}] },
        { name: 'Vegetable Pizza', variants: [{name: 'Small', price: 600}, {name: 'Medium', price: 1050}, {name: 'Large', price: 1500}, {name: 'XL', price: 2000}] },
        { name: 'Chicken Supreme Pizza', variants: [{name: 'Small', price: 600}, {name: 'Medium', price: 1050}, {name: 'Large', price: 1500}, {name: 'XL', price: 2000}] },
        { name: 'Chicken Achari Pizza', variants: [{name: 'Small', price: 600}, {name: 'Medium', price: 1050}, {name: 'Large', price: 1500}, {name: 'XL', price: 2000}] },
        { name: 'Chicken Tandoori Pizza', variants: [{name: 'Small', price: 600}, {name: 'Medium', price: 1050}, {name: 'Large', price: 1500}, {name: 'XL', price: 2000}] },
        { name: 'Hot & Spicy Pizza', variants: [{name: 'Small', price: 600}, {name: 'Medium', price: 1050}, {name: 'Large', price: 1500}, {name: 'XL', price: 2000}] },
      ]
    },
    {
      name: 'Premium Pizza',
      products: [
        { name: 'Malai Boti Pizza', variants: [{name: 'Small', price: 700}, {name: 'Medium', price: 1150}, {name: 'Large', price: 1650}, {name: 'XL', price: 2200}] },
        { name: 'Cheesy Lover Pizza', variants: [{name: 'Small', price: 700}, {name: 'Medium', price: 1150}, {name: 'Large', price: 1650}, {name: 'XL', price: 2200}] },
        { name: 'Special Lazania Pizza', variants: [{name: 'Small', price: 700}, {name: 'Medium', price: 1150}, {name: 'Large', price: 1650}, {name: 'XL', price: 2200}] },
        { name: 'Behari Kabab Pizza', variants: [{name: 'Small', price: 700}, {name: 'Medium', price: 1150}, {name: 'Large', price: 1650}, {name: 'XL', price: 2200}] },
        { name: 'Dubai Special Pizza', variants: [{name: 'Small', price: 700}, {name: 'Medium', price: 1150}, {name: 'Large', price: 1650}, {name: 'XL', price: 2200}] },
        { name: 'Kabab Crown Crust Pizza', variants: [{name: 'Small', price: 700}, {name: 'Medium', price: 1150}, {name: 'Large', price: 1650}, {name: 'XL', price: 2200}] },
        { name: 'Afghani Malai Boti Pizza', variants: [{name: 'Small', price: 700}, {name: 'Medium', price: 1150}, {name: 'Large', price: 1650}, {name: 'XL', price: 2200}] },
        { name: 'BBQ Pizza', variants: [{name: 'Small', price: 700}, {name: 'Medium', price: 1150}, {name: 'Large', price: 1650}, {name: 'XL', price: 2200}] },
      ]
    },
    {
      name: 'Square Pizza',
      products: [
        { name: 'Square Pizza Special', variants: [{name: 'Small', price: 750}, {name: 'Medium', price: 1350}, {name: 'Large', price: 1750}] },
      ]
    },
    {
      name: 'Burgers',
      products: [
        { name: 'Zinger Burger', price: 350 },
        { name: 'Grilled Burger', price: 380 },
        { name: 'Chicken Burger', price: 180 },
        { name: 'Chapli Kabab Burger', price: 300 },
        { name: 'Tower Burger', price: 550 },
        { name: 'Patty Burger', price: 260 },
        { name: 'Turkish Burger', price: 260 },
        { name: 'Pizza Burger', price: 520 },
        { name: 'Double Decker Burger', price: 550 },
      ]
    },
    {
      name: 'Pratha Rolls',
      products: [
        { name: 'Zinger Pratha Roll', price: 300 },
        { name: 'Chicken Pratha Roll', price: 300 },
        { name: 'Turkish Pratha Roll', price: 300 },
        { name: 'Kabab Pratha Roll', price: 300 },
      ]
    },
    {
      name: 'Special Rolls',
      products: [
        { name: 'Italian Roll', price: 500 },
        { name: 'Malai Boti Roll', price: 550 },
      ]
    },
    {
      name: 'Pasta',
      products: [
        { name: 'Chicken Cheese Pasta', variants: [{name: 'Small', price: 500}, {name: 'Large', price: 750}] },
      ]
    },
    {
      name: 'Appetizers',
      products: [
        { name: 'Chicken Hot Wings', variants: [{name: '6 pcs', price: 420}, {name: '12 pcs', price: 840}] },
        { name: 'Nuggets', variants: [{name: '10 pcs', price: 600}] },
        { name: 'Fries', variants: [{name: 'Small', price: 150}, {name: 'Medium', price: 250}, {name: 'Large', price: 300}] },
        { name: 'Loaded Fries', price: 750 },
        { name: 'White Sauce', price: 50 },
      ]
    },
    {
      name: 'Sandwich',
      products: [
        { name: 'Turkish Sandwich', price: 300 },
        { name: 'Chicken Club Sandwich', price: 300 },
        { name: 'Grilled Cheesy Sandwich', price: 520 },
      ]
    },
    {
      name: 'Shawarma',
      products: [
        { name: 'Turkish Shawarma', variants: [{name: 'Regular', price: 200}, {name: 'Large', price: 250}] },
        { name: 'Chicken Shawarma', variants: [{name: 'Regular', price: 150}, {name: 'Large', price: 170}] },
        { name: 'Zinger Shawarma', price: 300 },
        { name: 'Platter Shawarma', price: 350 },
        { name: 'Kabab Shawarma', price: 300 },
      ]
    },
    {
      name: 'Extra Toppings',
      products: [
        { name: 'Small Pizza Topping', price: 100 },
        { name: 'Medium Pizza Topping', price: 150 },
        { name: 'Large Pizza Topping', price: 200 },
        { name: 'XL Pizza Topping', price: 250 },
      ]
    }
  ]
};

async function seed() {
  console.log('Starting seed...');
  try {
    await initDatabase();
    
    const parentCategory = categoryService.createCategory({ name: fastFoodData.name, display_order: 1 }, USER_ID);
    console.log(`Created parent category: ${parentCategory.name} (${parentCategory.id})`);

    let displayOrder = 1;
    for (const subcat of fastFoodData.subcategories) {
      const category = categoryService.createCategory({
        name: subcat.name,
        parent_id: parentCategory.id,
        display_order: displayOrder++
      }, USER_ID);
      console.log(`  Created subcategory: ${category.name}`);

      for (const prod of subcat.products) {
        const hasVariants = prod.variants && prod.variants.length > 0;
        const basePrice = hasVariants ? prod.variants[0].price : (prod.price || 0);

        const product = productService.createProduct({
          name: prod.name,
          category_id: category.id,
          price: basePrice,
        }, USER_ID);

        if (hasVariants) {
          for (let i = 0; i < prod.variants.length; i++) {
            const variantData = prod.variants[i];
            variantService.createVariant(product.id, {
              name: variantData.name,
              price: variantData.price,
              display_order: i + 1
            }, USER_ID);
          }
        }
      }
    }
    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
  }
}

seed();
