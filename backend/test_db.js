import { dashboardService } from './src/services/dashboardService.js';
import { dbEngine } from './src/database/sqlite.js';

try {
  dbEngine.connect('./storage/database/pos.db');
  const summary = dashboardService.getSummary();
  console.log('Summary:', summary);
} catch (e) {
  console.error(e.message);
  console.error(e.stack);
}
