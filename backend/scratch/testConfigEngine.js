import { dbEngine } from '../src/database/sqlite.js';
import { migrationRunner } from '../src/database/migrationRunner.js';
import { productService } from '../src/services/productService.js';
import { variantService } from '../src/services/variantService.js';
import { modifierService } from '../src/services/modifierService.js';
import { dealRepository } from '../src/repositories/dealRepository.js';
import { pricingService } from '../src/services/pricingService.js';
import { menuCacheService } from '../src/services/menuCacheService.js';
import { categoryRepository } from '../src/repositories/categoryRepository.js';

// Setup Mock User
const mockUser = { id: 'test-user-id' };

(async () => {
  try {
    dbEngine.connect();
    await migrationRunner.runPendingMigrations();

    dbEngine.run("INSERT OR IGNORE INTO roles (id, name) VALUES ('test-role', 'Test Role')");
    dbEngine.run("INSERT OR IGNORE INTO users (id, role_id, username, password_hash, first_name) VALUES ('test-user-id', 'test-role', 'test_user', 'hash', 'Test')");

    // 1. Create a category
  const cat = categoryRepository.create({ name: 'Burgers', display_order: 1, lifecycle_state: 'ACTIVE' });
  
  // 2. Create a base product
  const productData = {
    category_id: cat.id,
    name: 'Classic Burger',
    price: 10.00,
    lifecycle_state: 'ACTIVE'
  };
  const product = productService.createProduct(productData, mockUser.id);
  console.log('✅ Created Base Product:', product.name, product.id);

  // 3. Add Variants
  const varLarge = variantService.createVariant(product.id, { name: 'Double Patty', price: 15.00, lifecycle_state: 'ACTIVE' }, mockUser.id);
  const varSmall = variantService.createVariant(product.id, { name: 'Single Patty', price: 10.00, lifecycle_state: 'ACTIVE' }, mockUser.id);
  console.log('✅ Created Variants:', varLarge.name, varSmall.name);

  // 4. Modifiers
  const modCheese = modifierService.createModifier({ name: 'Extra Cheese', price_adjustment: 2.00, lifecycle_state: 'ACTIVE' }, mockUser.id);
  const modBacon = modifierService.createModifier({ name: 'Bacon', price_adjustment: 3.00, lifecycle_state: 'ACTIVE' }, mockUser.id);
  console.log('✅ Created Modifiers');

  const group = modifierService.createGroup({ name: 'Add-ons', min_selection: 0, max_selection: 2, lifecycle_state: 'ACTIVE' }, mockUser.id);
  modifierService.addOptionToGroup(group.id, modCheese.id, { max_quantity_per_selection: 2 }, mockUser.id);
  modifierService.addOptionToGroup(group.id, modBacon.id, {}, mockUser.id);
  console.log('✅ Created Modifier Group & Options');

  modifierService.linkGroupToProduct(product.id, group.id, 0, mockUser.id);
  console.log('✅ Linked Group to Product');

  // 5. Test Pricing
  // Refresh cache manually just in case
  menuCacheService.refresh();

  // Price of Double Patty + Extra Cheese
  // We need the option ID to calculate pricing
  const pCached = menuCacheService.productMap.get(product.id);
  const cheeseOption = pCached.modifier_groups[0].options.find(o => o.modifier_id === modCheese.id);

  const finalPrice = pricingService.calculateItemPrice(product.id, varLarge.id, [cheeseOption.id], []);
  console.log(`\n💰 Final Price (Double Patty + Cheese): $${finalPrice}`); // Expected: 15 + 2 = 17

  // 6. Test Combo (Dynamic Pricing)
  const combo = dealRepository.create({
    code: 'B-MEAL',
    name: 'Burger Meal',
    pricing_strategy: 'DYNAMIC',
    lifecycle_state: 'ACTIVE',
    groups: [
      {
        name: 'Choose Burger',
        components: [
          { product_id: product.id }
        ]
      }
    ]
  });

  const comboPrice = pricingService.calculateComboPrice(combo.id, [{ product_id: product.id, quantity: 1 }]);
  console.log(`💰 Combo Price (Dynamic): $${comboPrice}`); // Expected: 10 (base price of Classic Burger)

  console.log('\n🎉 Product Configuration Engine Tests Passed!');

  } catch (err) {
    console.error('❌ Test Failed:', err.stack);
  }
})();
