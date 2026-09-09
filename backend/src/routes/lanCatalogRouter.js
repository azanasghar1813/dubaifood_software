import { Router } from 'express';
import { dbEngine } from '../database/sqlite.js';
import { configService } from '../services/configService.js';
import { lanCatalogSyncService } from '../services/lanCatalogSyncService.js';
import { LAN_SHARED_SECRET } from '../config/lanSecret.js';
import crypto from 'crypto';

const router = Router();

// Middleware to verify internal requests
const verifyInternal = (req, res, next) => {
  const secret = req.headers['x-device-secret'];
  const expectedSecret = LAN_SHARED_SECRET;
  
  if (!secret) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const bufSecret = Buffer.from(secret);
  const bufExpected = Buffer.from(expectedSecret);
  
  if (bufSecret.length !== bufExpected.length || !crypto.timingSafeEqual(bufSecret, bufExpected)) {
    return res.status(401).json({ success: false, message: 'Invalid device credentials' });
  }
  next();
};

router.use(verifyInternal);

router.get('/dump', (req, res) => {
  try {
    const data = {
      categories: dbEngine.prepare('SELECT * FROM categories WHERE lifecycle_state != ?').all('DELETED'),
      products: dbEngine.prepare('SELECT * FROM products WHERE lifecycle_state != ?').all('DELETED'),
      product_variants: dbEngine.prepare('SELECT * FROM product_variants').all(),
      modifiers: dbEngine.prepare('SELECT * FROM modifiers').all(),
      modifier_options: dbEngine.prepare('SELECT * FROM modifier_options').all(),
      deals: dbEngine.prepare('SELECT * FROM deals WHERE lifecycle_state != ?').all('DELETED'),
      deal_items: dbEngine.prepare('SELECT * FROM deal_items').all(),
      settings: dbEngine.prepare('SELECT * FROM settings').all()
    };
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/pull', async (req, res) => {
  try {
    const result = await lanCatalogSyncService.pullCatalogFromHub();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
