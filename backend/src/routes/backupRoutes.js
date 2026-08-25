import { Router } from 'express';
import multer from 'multer';
import { restoreBackup } from '../controllers/backupController.js';

const router = Router();
const upload = multer({ dest: 'temp_uploads/' }); // Temp upload directory

router.post('/restore', upload.single('backup'), restoreBackup);

export default router;
