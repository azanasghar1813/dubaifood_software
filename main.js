import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import http from 'http';
import pkg from 'electron-updater';
const { autoUpdater, CancellationToken } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const userDataPath = app.getPath('userData');
const prodStorageRoot = path.join(userDataPath, 'storage');
process.env.STORAGE_ROOT = prodStorageRoot;

if (app.isPackaged) {
  const defaultStorageRoot = path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'storage');
  if (!fs.existsSync(prodStorageRoot) && fs.existsSync(defaultStorageRoot)) {
    console.log('First run: Copying pre-populated database and storage to user data path...');
    fs.cpSync(defaultStorageRoot, prodStorageRoot, { recursive: true });
    
    // Wipe cloned identity so the new laptop generates its own unique ID and syncs properly
    try {
      const { createRequire } = await import('node:module');
      const require = createRequire(import.meta.url);
      const Database = require('better-sqlite3');
      
      const dbPath = path.join(prodStorageRoot, 'database', 'pos.db');
      if (fs.existsSync(dbPath)) {
        const db = new Database(dbPath);
        db.prepare("DELETE FROM application_settings WHERE key = 'device_id'").run();
        db.prepare("DELETE FROM application_settings WHERE key = 'order_prefix'").run();
        db.prepare("DELETE FROM sync_queue").run();
        
        // After wiping sync_queue/device identity, backfill fresh CREATE events
        // for every entity already sitting in the cloned/local database, since
        // none of them have ever actually been pushed to the cloud.
        const backfillTables = [
          { table: 'categories', type: 'CATEGORY' },
          { table: 'products', type: 'PRODUCT' },
          { table: 'deals', type: 'DEAL' },
          { table: 'customers', type: 'CUSTOMER' },
          { table: 'users', type: 'USER' },
        ];

        const cryptoLib = require('crypto');
        for (const { table, type } of backfillTables) {
          try {
            const rows = db.prepare(`SELECT id FROM ${table}`).all();
            const insertStmt = db.prepare(`
              INSERT INTO sync_queue (id, entity_type, entity_id, action, metadata, payload_version)
              VALUES (?, ?, ?, 'CREATED', '{}', 1)
            `);
            for (const row of rows) {
              insertStmt.run(cryptoLib.randomUUID(), type, row.id);
            }
          } catch(e) {}
        }

        try { db.prepare("DELETE FROM sync_conflicts").run(); } catch(e){}
        db.prepare("UPDATE application_settings SET value = '0' WHERE key = 'last_sync_timestamp'").run();
        db.close();
        console.log('Successfully wiped cloned identity for fresh start on new device.');
      }
    } catch (e) {
      console.error('Failed to wipe cloned identity:', e.message);
    }
  }
}

const isProdMode = app.isPackaged || process.env.TEST_BUILD === 'true';
process.env.NODE_ENV = isProdMode ? 'production' : 'development';

const envPath = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', '.env')
  : path.join(__dirname, 'backend', '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
const BACKEND_PORT = process.env.PORT || 5000;


let mainWindow;
let splashWindow;
let backendProcess = null;
let backendErrorLog = '';
let backendExitedCleanly = false;

const createSplashWindow = () => {
  splashWindow = new BrowserWindow({
    width: 600,
    height: 520,
    frame: false,
    transparent: false,
    backgroundColor: '#ffffff',
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  splashWindow.loadFile('splash.html');
};

const updateSplashStatus = (message, isError = false, errorDetail = '') => {
  if (splashWindow && !splashWindow.isDestroyed()) {
    const cleanDetail = JSON.stringify(errorDetail);
    splashWindow.webContents.executeJavaScript(
      `window.updateStatus(${JSON.stringify(message)}, ${isError}, ${cleanDetail});`
    ).catch(() => { });
  }
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);
  mainWindow.maximize();

  if (isProdMode) {
    mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}`);
  } else {
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  });
};

const startBackendProcess = async () => {
  backendErrorLog = '';
  backendExitedCleanly = false;
  updateSplashStatus('Starting backend systems...', false);

  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }

  console.log('Starting local backend...');
  const { spawn } = await import('child_process');

  const nodeExe = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'bin', 'node.exe')
    : 'node';
  const serverScript = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'src', 'server.js')
    : path.join(__dirname, 'backend', 'src', 'server.js');

  const backendEnv = { ...process.env };
  backendEnv.PORT = BACKEND_PORT;
  if (app.isPackaged) {
    backendEnv.STORAGE_ROOT = path.join(app.getPath('userData'), 'storage');
  }
  if (isProdMode) {
    backendEnv.NODE_ENV = 'production';
  }

  backendProcess = spawn(nodeExe, [serverScript], {
    env: backendEnv,
    windowsHide: true,
    // 'ipc' channel added — required for backendProcess.send()/process.on('message')
    // to work at all. Without this, graceful shutdown messages silently fail.
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend] ${data.toString()}`);
  });

  backendProcess.stderr.on('data', (data) => {
    const errStr = data.toString();
    console.error(`[Backend ERROR] ${errStr}`);
    backendErrorLog += errStr;
  });

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend in child process:', err);
    backendErrorLog += err.toString() + '\n';
  });

  backendProcess.on('message', (msg) => {
    if (msg === 'shutdown-complete') {
      backendExitedCleanly = true;
    }
  });

  backendProcess.on('exit', (code) => {
    console.log(`Backend process exited with code ${code}`);
    if (code !== 0 && splashWindow && !splashWindow.isDestroyed()) {
      const cleanError = backendErrorLog.substring(0, 500);
      updateSplashStatus('Backend exited unexpectedly.', true, cleanError);
    }
  });

  console.log('Backend process spawned. Waiting for health check...');

  // Increased from 20s to 60s to tolerate slow disks, cold OS file cache,
  // antivirus first-scan of the executable, or a large post-crash WAL
  // recovery. The friendlier staged messaging below keeps the user informed
  // instead of presenting a bare timer.
  const MAX_WAIT_MS = 60000;
  const POLL_INTERVAL_MS = 300;
  const startTime = Date.now();
  let slowStartupMessageShown = false;

  const checkHealth = () => {
    if (backendProcess && backendProcess.exitCode !== null && backendProcess.exitCode !== undefined) {
      return;
    }

    const elapsed = Date.now() - startTime;

    // After 8s with no response, reassure the user rather than staying silent —
    // this covers ordinary slow-disk/cold-cache cases that aren't failures.
    if (!slowStartupMessageShown && elapsed > 8000) {
      slowStartupMessageShown = true;
      updateSplashStatus('Still starting up — this can take a bit longer on the first launch of the day...', false);
    }

    if (elapsed > MAX_WAIT_MS) {
      console.error('Backend failed to start within timeout.');
      const cleanError = backendErrorLog.substring(0, 500) || 'Timeout waiting for backend to respond.';
      updateSplashStatus('Startup is taking unusually long. You can retry, or check logs.', true, cleanError);
      return;
    }

    const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/v1/health`, (res) => {
      if (res.statusCode === 200) {
        console.log('Backend is healthy! Creating main window...');
        createWindow();
      } else {
        console.warn(`Health check got status: ${res.statusCode}`);
        setTimeout(checkHealth, POLL_INTERVAL_MS);
      }
    });

    req.on('error', (err) => {
      console.error('Health check error:', err.message);
      setTimeout(checkHealth, POLL_INTERVAL_MS);
    });

    req.end();
  };

  setTimeout(checkHealth, 500);
};

/**
 * Gracefully stops the backend: sends an IPC 'shutdown' message and waits
 * for confirmation, falling back to a forced taskkill if it doesn't respond
 * within a bounded time. Returns a Promise that resolves once the backend
 * process has actually exited (clean or forced).
 */
const stopBackendGracefully = (timeoutMs = 5000) => {
  return new Promise((resolve) => {
    if (!backendProcess || backendProcess.killed || backendProcess.exitCode !== null) {
      resolve();
      return;
    }

    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };

    backendProcess.once('exit', finish);

    try {
      backendProcess.send('shutdown');
    } catch (err) {
      console.warn('[Shutdown] IPC send failed, falling back to taskkill immediately:', err.message);
    }

    setTimeout(async () => {
      if (resolved) return;
      console.warn('[Shutdown] Backend did not exit gracefully within timeout, forcing kill.');
      const { exec } = await import('child_process');
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${backendProcess.pid} /T /F`, () => finish());
      } else {
        backendProcess.kill('SIGKILL');
        finish();
      }
    }, timeoutMs);
  });
};

app.whenReady().then(async () => {
  ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  });
  ipcMain.on('window-close', () => { if (mainWindow) mainWindow.close(); });

  createSplashWindow();
  startBackendProcess();

  ipcMain.on('retry-startup', () => {
    startBackendProcess();
  });

  ipcMain.on('app-quit', () => {
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Auto-updater setup
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  // Set the read-only GitHub token for private repository access
  autoUpdater.requestHeaders = {
    "Authorization": "Bearer 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"
  };

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-available', info);
  });
  autoUpdater.on('update-not-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-not-available', info);
  });
  autoUpdater.on('error', (err) => {
    if (mainWindow) mainWindow.webContents.send('update-error', err.message);
  });
  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) mainWindow.webContents.send('download-progress', progressObj);
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
  });

  ipcMain.handle('check-for-updates', async () => {
    try {
      if (!app.isPackaged) return { error: "Development mode: Updates disabled" };
      return await autoUpdater.checkForUpdates();
    } catch (err) {
      return { error: err.message };
    }
  });

  let cancellationToken;
  ipcMain.handle('download-update', async () => {
    try {
      cancellationToken = new CancellationToken();
      return await autoUpdater.downloadUpdate(cancellationToken);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('cancel-update', () => {
    if (cancellationToken) {
      cancellationToken.cancel();
    }
    return true;
  });

  ipcMain.handle('install-update', async () => {
    if (mainWindow) mainWindow.webContents.send('update-installing');
    await stopBackendGracefully();
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch(err => console.error("Silent update check failed:", err));
  }
});

// Ensures the backend is stopped cleanly (checkpointing SQLite) before
// Electron actually exits, instead of racing a fire-and-forget taskkill.
let quitting = false;
app.on('before-quit', async (event) => {
  if (quitting) return;
  quitting = true;
  event.preventDefault();
  await stopBackendGracefully();
  app.exit(0);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
