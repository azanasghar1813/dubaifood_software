import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Setup persistent storage for the production offline database
const userDataPath = app.getPath('userData');
const prodStorageRoot = path.join(userDataPath, 'storage');
process.env.STORAGE_ROOT = prodStorageRoot;

if (app.isPackaged) {
  const defaultStorageRoot = path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'storage');
  if (!fs.existsSync(prodStorageRoot) && fs.existsSync(defaultStorageRoot)) {
    console.log('First run: Copying pre-populated database and storage to user data path...');
    fs.cpSync(defaultStorageRoot, prodStorageRoot, { recursive: true });
  }
}

// 2. Set NODE_ENV
process.env.NODE_ENV = app.isPackaged ? 'production' : 'development';

// 3. Load backend config to ensure shared PORT
const envPath = app.isPackaged 
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', '.env')
  : path.join(__dirname, 'backend', '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
const BACKEND_PORT = process.env.PORT || 5000;

let mainWindow;
let splashWindow;

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

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Wait until ready-to-show
    frame: false, // Frameless window
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  // Hide the native menu bar
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);

  mainWindow.maximize();
  
  if (app.isPackaged) {
    mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
  } else {
    mainWindow.loadURL('http://localhost:5173');
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

app.whenReady().then(async () => {
  // IPC Handlers for window controls
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });
  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  });
  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  // Show splash immediately
  createSplashWindow();

  let backendProcess = null;
  let backendErrorLog = '';

  const startBackendProcess = async () => {
    backendErrorLog = ''; // Reset error log on new start
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.executeJavaScript(`window.updateStatus('Starting backend systems...', false);`);
    }

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
    if (app.isPackaged) {
      backendEnv.STORAGE_ROOT = path.join(app.getPath('userData'), 'storage');
      // No need for ELECTRON_RUN_AS_NODE since we use standalone node
    }

    backendProcess = spawn(nodeExe, [serverScript], {
      env: backendEnv,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
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

    backendProcess.on('exit', (code) => {
      console.log(`Backend process exited with code ${code}`);
      if (code !== 0 && splashWindow && !splashWindow.isDestroyed()) {
        const cleanError = JSON.stringify(backendErrorLog.substring(0, 500).replace(/\n/g, '\\n'));
        splashWindow.webContents.executeJavaScript(`window.updateStatus('Backend exited unexpectedly.', true, ${cleanError});`);
      }
    });

    console.log('Backend process spawned. Waiting for health check...');
    
    // Health Polling Loop
    const MAX_WAIT_MS = 20000;
    const POLL_INTERVAL_MS = 300;
    const startTime = Date.now();

    const checkHealth = () => {
      // If process exited early, stop checking
      if (backendProcess && backendProcess.exitCode !== null && backendProcess.exitCode !== undefined) {
        return; 
      }

      if (Date.now() - startTime > MAX_WAIT_MS) {
        console.error('Backend failed to start within timeout.');
        if (splashWindow && !splashWindow.isDestroyed()) {
          const cleanError = JSON.stringify(backendErrorLog.substring(0, 500).replace(/\n/g, '\\n') || 'Timeout waiting for backend.');
          splashWindow.webContents.executeJavaScript(`window.updateStatus('Startup failed. Check logs.', true, ${cleanError});`);
        }
        return;
      }

      const req = http.get(`http://localhost:${BACKEND_PORT}/api/v1/health`, (res) => {
        if (res.statusCode === 200) {
          console.log('Backend is healthy! Creating main window...');
          createWindow();
        } else {
          setTimeout(checkHealth, POLL_INTERVAL_MS);
        }
      });

      req.on('error', () => {
        setTimeout(checkHealth, POLL_INTERVAL_MS);
      });

      req.end();
    };

    // Start polling
    setTimeout(checkHealth, 500);
  };

  startBackendProcess();

  ipcMain.on('retry-startup', () => {
    startBackendProcess();
  });

  const { exec } = await import('child_process');
  app.on('will-quit', () => {
    if (backendProcess && backendProcess.pid) {
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${backendProcess.pid} /T /F`, (err) => {
          if (err) console.error('Failed to kill backend process tree:', err);
        });
      } else {
        backendProcess.kill();
      }
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
