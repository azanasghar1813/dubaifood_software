import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Setup persistent storage for the production offline database
// Electron's userData defaults to %APPDATA%\<productName> (e.g., AppData\Roaming\Restaurant POS)
const userDataPath = app.getPath('userData');
const prodStorageRoot = path.join(userDataPath, 'storage');
process.env.STORAGE_ROOT = prodStorageRoot;

// First-run data migration: Bind the exact local database with all its existing content
if (app.isPackaged) {
  const defaultStorageRoot = path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'storage');
  if (!fs.existsSync(prodStorageRoot) && fs.existsSync(defaultStorageRoot)) {
    console.log('First run: Copying pre-populated database and storage to user data path...');
    fs.cpSync(defaultStorageRoot, prodStorageRoot, { recursive: true });
  }
}

// 2. Set NODE_ENV
process.env.NODE_ENV = app.isPackaged ? 'production' : 'development';

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Wait until ready-to-show
    webPreferences: {
      // Security standard
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.maximize();
  
  if (app.isPackaged) {
    // In production, the backend Express server will serve the frontend from localhost:5000
    mainWindow.loadURL('http://localhost:5000');
  } else {
    // In development, the Vite dev server runs on localhost:5173
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools for debugging
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
};

app.whenReady().then(async () => {
  // 3. Dynamically spawn the backend server as a separate process to avoid Electron ABI mismatches
  console.log('Starting local backend...');
  const { spawn } = await import('child_process');
  
  // Locate the node executable and the server script
  const nodeExe = app.isPackaged 
    ? path.join(process.resourcesPath, 'bin', 'node.exe') 
    : 'node';
  const serverScript = app.isPackaged 
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'src', 'server.js')
    : path.join(__dirname, 'backend', 'src', 'server.js');

  const backendProcess = spawn(nodeExe, [serverScript], {
    env: process.env,
    stdio: 'inherit' // Pipe logs to the Electron main process
  });

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend in child process:', err);
  });

  backendProcess.on('exit', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });

  // Ensure the child process is killed when the main process quits
  app.on('will-quit', () => {
    if (backendProcess && !backendProcess.killed) {
      backendProcess.kill();
    }
  });

  console.log('Backend process spawned. Creating window...');
  
  // Give the backend a brief moment to finish binding to port 5000
  setTimeout(() => {
    createWindow();
  }, 1000);

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
