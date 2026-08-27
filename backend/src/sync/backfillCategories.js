import { dbEngine } from '../database/sqlite.js';
import { syncService } from '../services/syncService.js';
import path from 'path';

console.log('Starting category backfill...');

try {
  dbEngine.connect(path.join(process.cwd(), 'storage/database/pos.db'));
  const categories = dbEngine.prepare('SELECT * FROM categories').all();
  let count = 0;
  
  for (const cat of categories) {
    // Check if it already exists in sync_queue to prevent duplicates
    const existing = dbEngine.prepare("SELECT id FROM sync_queue WHERE entity_type = 'CATEGORY' AND entity_id = ?").get(cat.id);
    
    if (!existing) {
      syncService.queueSyncEvent('CATEGORY', cat.id, 'CREATED', { name: cat.name }, cat.payload_version || 1);
      count++;
    }
  }
  
  console.log(`Successfully backfilled ${count} categories into sync_queue.`);
} catch (error) {
  console.error('Error backfilling categories:', error);
}
