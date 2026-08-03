import { dbEngine } from './src/database/sqlite.js';
import config from './src/config/index.js';

try {
  dbEngine.connect(config.paths.database.file);
  dbEngine.prepare(`
    UPDATE products 
    SET product_code = product_code || '_del_' || substr(id, 1, 8),
        barcode = CASE WHEN barcode IS NOT NULL THEN barcode || '_del_' || substr(id, 1, 8) ELSE NULL END
    WHERE lifecycle_state = 'DELETED' AND product_code NOT LIKE '%_del_%'
  `).run();
  console.log("Database fixed");
} catch(e) {
  console.error(e);
}
