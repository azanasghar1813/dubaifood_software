import fs from 'fs';
import path from 'path';
import config from '../config/index.js';
import { dbEngine } from '../database/sqlite.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');

export const restoreBackup = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file provided' });
    }

    const zipFilePath = req.file.path;
    console.log(`[BackupController] Attempting restore from: ${zipFilePath}`);

    // Verify it's a valid zip
    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();
    
    let hasDb = false;
    for (const entry of zipEntries) {
      if (entry.entryName === 'database/pos.db') {
        hasDb = true;
        break;
      }
    }

    if (!hasDb) {
      fs.unlinkSync(zipFilePath); // Clean up temp upload
      return res.status(400).json({ error: 'Invalid backup file: pos.db not found' });
    }

    // Step 1: Safely close database connections
    console.log('[BackupController] Closing database connections for restore...');
    dbEngine.close();

    // Step 2: Extract over existing paths
    console.log('[BackupController] Extracting backup...');
    
    // We want to extract 'database/pos.db' directly into config.paths.database.file 
    // Wait, AdmZip extracts preserving the folder structure. 
    // We'll extract everything to a temp folder, then move the db file.
    const tempExtractDir = path.join(config.paths.root, 'temp_restore');
    if (!fs.existsSync(tempExtractDir)) {
      fs.mkdirSync(tempExtractDir);
    }

    zip.extractAllTo(tempExtractDir, true);

    // Step 3: Replace DB
    const extractedDbPath = path.join(tempExtractDir, 'database', 'pos.db');
    if (fs.existsSync(extractedDbPath)) {
      // Overwrite current DB
      fs.copyFileSync(extractedDbPath, config.paths.database.file);
      console.log('[BackupController] Database replaced successfully.');
    }

    // Replace images if they exist
    const extractedImagesPath = path.join(tempExtractDir, 'images');
    const targetImagesPath = path.join(config.paths.root, 'images');
    if (fs.existsSync(extractedImagesPath)) {
      // Simple copy over
      fs.cpSync(extractedImagesPath, targetImagesPath, { recursive: true, force: true });
      console.log('[BackupController] Images restored successfully.');
    }

    // Clean up
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
    fs.unlinkSync(zipFilePath);

    res.status(200).json({ message: 'Restore successful. System will now restart.' });

    // Step 4: Restart Backend
    console.log('[BackupController] Triggering backend restart...');
    setTimeout(() => {
      // Electron listens to process exit and automatically restarts the backend process
      process.exit(0); 
    }, 1000);

  } catch (error) {
    console.error('[BackupController] Restore failed:', error);
    res.status(500).json({ error: 'Failed to restore backup: ' + error.message });
  }
};
