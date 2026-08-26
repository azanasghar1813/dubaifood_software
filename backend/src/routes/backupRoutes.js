import { Router } from 'express';
import multer from 'multer';
import { restoreBackup, listBackups, createBackup, deleteBackup } from '../controllers/backupController.js';

const router = Router();
const upload = multer({ dest: 'temp_uploads/' }); // Temp upload directory

router.get('/', listBackups);
router.post('/create', createBackup);
router.post('/restore', upload.single('backup'), restoreBackup);
router.delete('/:id', deleteBackup);

export default router;
