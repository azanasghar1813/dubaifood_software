import { dbEngine } from '../src/database/sqlite.js';
import { migrationRunner } from '../src/database/migrationRunner.js';
import { productService } from '../src/services/productService.js';
import { categoryRepository } from '../src/repositories/categoryRepository.js';
import { globalSearchService } from '../src/services/search/globalSearchService.js';
import { recentUsageService } from '../src/services/search/recentUsageService.js';
import { popularityService } from '../src/services/search/popularityService.js';
import { menuCacheService } from '../src/services/menuCacheService.js';

const mockUser = { id: 'search-tester' };

(async () => {
  try {
    dbEngine.connect();
    await migrationRunner.runPendingMigrations();

    // Clear db for clean test
    dbEngine.run("DELETE FROM products");
    dbEngine.run("DELETE FROM categories");
    dbEngine.run("DELETE FROM item_popularity");
    dbEngine.run("DELETE FROM recent_usage");
    dbEngine.run("INSERT OR IGNORE INTO roles (id, name) VALUES ('admin', 'Admin')");
    dbEngine.run("INSERT OR IGNORE INTO users (id, username, password_hash, role_id) VALUES ('search-tester', 'test', 'x', 'admin')");

    // 1. Setup Categories
    const cat = categoryRepository.create({ name: 'Drinks', display_order: 1, lifecycle_state: 'ACTIVE' });

    // 2. Setup Products with specific codes to test code search
    const p1 = productService.createProduct({ category_id: cat.id, name: 'Water', product_code: '2', price: 1, lifecycle_state: 'ACTIVE' }, mockUser.id);
    const p2 = productService.createProduct({ category_id: cat.id, name: 'Cola', product_code: '20', price: 2, lifecycle_state: 'ACTIVE' }, mockUser.id);
    const p3 = productService.createProduct({ category_id: cat.id, name: 'Juice', product_code: '200', price: 3, lifecycle_state: 'ACTIVE' }, mockUser.id);
    const p4 = productService.createProduct({ category_id: cat.id, name: 'Premium Coffee', product_code: '2001', price: 4, lifecycle_state: 'ACTIVE' }, mockUser.id);
    const p5 = productService.createProduct({ category_id: cat.id, name: 'Tea 200', product_code: '888', price: 2, lifecycle_state: 'ACTIVE' }, mockUser.id);

    // Global Search should automatically be ready because menuCacheService triggers it!
    console.log('\n--- Testing Code Search ---');
    
    // Type '2' -> Should return 2001, 200, 20, 2 (but 2 should rank highest as exact match)
    let res = globalSearchService.search('2', mockUser.id, 10);
    console.log('Query: "2"');
    res.forEach((r, i) => console.log(` ${i+1}. [${r.score}] ${r.item.name} (${r.item.product_code})`));
    if (res[0].item.product_code !== '2') throw new Error('Code search exact match failed');

    // Type '20' -> Should return 20, 200, 2001. '2' should NOT be returned because it doesn't contain '20'.
    res = globalSearchService.search('20', mockUser.id, 10);
    console.log('\nQuery: "20"');
    res.forEach((r, i) => console.log(` ${i+1}. [${r.score}] ${r.item.name} (${r.item.product_code})`));
    if (res[0].item.product_code !== '20') throw new Error('Code search prefix exact match failed');

    // Type '2001'
    res = globalSearchService.search('2001', mockUser.id, 10);
    console.log('\nQuery: "2001"');
    res.forEach((r, i) => console.log(` ${i+1}. [${r.score}] ${r.item.name} (${r.item.product_code})`));
    if (res[0].item.product_code !== '2001') throw new Error('Code search exact match 2001 failed');

    console.log('\n--- Testing Suggestions (Empty Query) ---');
    // Bump popularity and recent usage
    popularityService.increment('PRODUCT', p4.id, 100);
    recentUsageService.markUsed(mockUser.id, 'PRODUCT', p1.id);
    
    // Re-initialize search index to load the DB persistence
    globalSearchService.initialize();

    const suggestions = globalSearchService.search('', mockUser.id, 5);
    suggestions.forEach((r, i) => console.log(` ${i+1}. [${r.suggestion_reason}] ${r.item.name}`));

    const hasRecent = suggestions.some(s => s.suggestion_reason === 'RECENTLY_USED' && s.item.id === p1.id);
    const hasPopular = suggestions.some(s => (s.suggestion_reason === 'POPULAR_ALL_TIME' || s.suggestion_reason === 'POPULAR_TODAY') && s.item.id === p4.id);

    if (!hasRecent) throw new Error('Suggestions missing recent usage');
    if (!hasPopular) throw new Error('Suggestions missing popularity');

    console.log('\n🎉 Search Engine Tests Passed!');
  } catch (err) {
    console.error('\n❌ Test Failed:', err.stack);
  }
})();
