import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import { restoreBackup, restoreLocalBackup, listBackups, createBackup, deleteBackup } from '../controllers/backupController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import config from '../config/index.js';

const router = Router();

const tempDir = config.paths.temp;
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
const upload = multer({ dest: tempDir });

router.use(authenticate);
router.use(authorize(['VIEW_BACKUP', 'MANAGE_SETTINGS']));

router.get('/', listBackups);
router.post('/create', createBackup);
router.post('/restore', upload.single('backup'), restoreBackup);
router.post('/restore-local/:id', restoreLocalBackup);
router.delete('/:id', deleteBackup);

export default router;
