import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import http from 'http';
import pkg from 'electron-updater';
const { autoUpdater, CancellationToken } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const userDataPath = app.getPath('userData');
const prodStorageRoot = path.join(userDataPath, 'storage');
process.env.STORAGE_ROOT = prodStorageRoot;

const copyDirContents = (src, dest) => {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) {
      copyDirContents(from, to);
      continue;
    }
    // Never overwrite a live database on upgrade (orders, tickets, settings).
    const isDb = /\.(db|db-shm|db-wal|sqlite|sqlite3)$/i.test(name);
    if (isDb && fs.existsSync(to)) continue;
    if (!fs.existsSync(to)) {
      fs.copyFileSync(from, to);
    }
  }
};

if (app.isPackaged) {
  const defaultStorageRoot = path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'storage');
  const packedDb = path.join(defaultStorageRoot, 'database', 'pos.db');
  const liveDb = path.join(prodStorageRoot, 'database', 'pos.db');
  const claimMarker = path.join(prodStorageRoot, '.needs-device-claim');
  const liveExisted = fs.existsSync(liveDb);
  // Copy only when this PC has no live database yet. Never overwrite AppData.
  if (!liveExisted && fs.existsSync(packedDb)) {
    try {
      console.log('First run: Copying pre-populated database and storage to user data path...');
      copyDirContents(defaultStorageRoot, prodStorageRoot);
      fs.writeFileSync(claimMarker, '1');
      console.log('First run: device ID will be chosen on login.');
    } catch (e) {
      console.error('First-run storage copy failed:', e.message);
    }
  } else if (liveExisted) {
    console.log('Upgrade: keeping live database at', liveDb);
    if (fs.existsSync(claimMarker)) {
      try { fs.unlinkSync(claimMarker); } catch { /* ignore */ }
    }
  }
  // Always fill in missing product photos (sync may have pointed DB at dead cloud URLs).
  try {
    const packedImages = path.join(defaultStorageRoot, 'images');
    const liveImages = path.join(prodStorageRoot, 'images');
    if (fs.existsSync(packedImages)) {
      copyDirContents(packedImages, liveImages);
    }
  } catch (e) {
    console.error('Product image copy failed:', e.message);
  }
}

const isProdMode = app.isPackaged || process.env.TEST_BUILD === 'true';
process.env.NODE_ENV = isProdMode ? 'production' : 'development';

const envCandidates = app.isPackaged
  ? [
    path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', '.env'),
    path.join(__dirname, 'backend', '.env'),
  ]
  : [path.join(__dirname, 'backend', '.env')];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const ensureSecrets = () => {
  const secretsPath = path.join(userDataPath, 'secrets.json');
  let secrets = {};
  try {
    if (fs.existsSync(secretsPath)) {
      secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
    }
  } catch {
    secrets = {};
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) {
    secrets.jwtSecret = process.env.JWT_SECRET;
  } else if (!secrets.jwtSecret || String(secrets.jwtSecret).length < 16) {
    secrets.jwtSecret = crypto.randomBytes(32).toString('hex');
  }

  if (process.env.DEVICE_SECRET && process.env.DEVICE_SECRET.length >= 16) {
    secrets.deviceSecret = process.env.DEVICE_SECRET;
  } else if (!secrets.deviceSecret || String(secrets.deviceSecret).length < 16) {
    secrets.deviceSecret = crypto.randomBytes(24).toString('hex');
  }

  try {
    fs.writeFileSync(secretsPath, JSON.stringify(secrets, null, 2));
  } catch (err) {
    console.error('Failed to persist secrets:', err.message);
  }

  process.env.JWT_SECRET = secrets.jwtSecret;
  if (secrets.deviceSecret) {
    process.env.DEVICE_SECRET = secrets.deviceSecret;
  }
};

ensureSecrets();
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
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
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
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
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
  if (!backendEnv.SYNC_API_URL) backendEnv.SYNC_API_URL = 'https://dubaifood-sync-api.vercel.app/api/v1';
  if (!backendEnv.SYNC_API_FALLBACK_URL) {
    backendEnv.SYNC_API_FALLBACK_URL = 'https://dubaifood-software-wlko.onrender.com/api/v1';
  }
  if (app.isPackaged) {
    backendEnv.STORAGE_ROOT = path.join(app.getPath('userData'), 'storage');
  }
  if (isProdMode) {
    backendEnv.NODE_ENV = 'production';
  }

  if (app.isPackaged) {
    backendEnv.NODE_PATH = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules');
  }

  const nodeArgs = app.isPackaged ? ['--use-system-ca', serverScript] : [serverScript];
  backendProcess = spawn(nodeExe, nodeArgs, {
    env: backendEnv,
    cwd: app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked')
      : __dirname,
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
    // Clean exit (e.g. backup restore) while the UI is already open: respawn backend.
    if (code === 0 && !quitting && mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => startBackendProcess(), 500);
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
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log('Backend is healthy. Reloading existing window...');
          mainWindow.reload();
        } else {
          console.log('Backend is healthy! Creating main window...');
          createWindow();
        }
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

// ════════════════════════════════════════════════════════════════════════════
// Silent thermal printing: HTML -> bitmap -> ESC/POS raster -> RAW to spooler.
// Independent of driver paper size. Falls back to the Windows print dialog.
// Optional env: POS_PRINT_MODE=driver, POS_PRINTER_NAME, POS_PRINTER_DOTS, POS_PRINT_TEST=1
// ════════════════════════════════════════════════════════════════════════════
const PRINT_MODE = String(process.env.POS_PRINT_MODE || 'auto').toLowerCase();
const DEFAULT_PRINTER_DOTS = 512; // safe on 512/576/640-dot heads; raise after the width test
const PRINTER_DOTS = Math.max(256, Math.floor((Number.parseInt(process.env.POS_PRINTER_DOTS || '', 10) || DEFAULT_PRINTER_DOTS) / 8) * 8);
const RECEIPT_CSS_WIDTH = 302;   // 80mm in CSS px, what your HTML is designed for
const INK_THRESHOLD = 170;       // 0-255, higher = darker print
const RASTER_BAND_ROWS = 128;
const TOP_MARGIN_ROWS = 4;
const BOTTOM_MARGIN_ROWS = 16;
const FEED_BEFORE_CUT_DOTS = 24;

const VIRTUAL_PRINTER_RE = /pdf|xps|onenote|fax|document writer|virtual|snagit|anydesk|send to/i;
const OFFICE_PRINTER_RE = /laserjet|deskjet|officejet|designjet|canon|brother|ricoh|kyocera|lexmark|xerox|konica|pantum|\bhp\b/i;
const THERMAL_PRINTER_RE = /thermal|receipt|\bpos\b|pos-?\d|xp-?\d|tm-?[tum]?\d|rp-?\d|rongta|xprinter|bixolon|citizen|munbyn|gprinter|gp-?\d|zjiang|zj-?\d|hoin|sunmi|3nstar|sewoo|tsp\d|srp-?\d|80mm|58mm|escpos|kitchen|bill/i;

const BASE_CSS = 'html,body{margin:0!important;padding:0!important;min-height:0!important;height:auto!important;background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}';
const RASTER_CSS = BASE_CSS + 'html,body{width:100%!important;display:block!important}.receipt,.ticket{width:100%!important;max-width:none!important;padding:4px!important;margin:0!important}';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const withTimeout = (promise, ms, label) => {
  let t;
  return Promise.race([
    promise,
    new Promise((_, reject) => { t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms); })
  ]).finally(() => clearTimeout(t));
};

const injectCss = (html, css) => {
  const tag = `<style>${css}</style>`;
  return html.includes('</head>')
    ? html.replace('</head>', () => `${tag}</head>`)
    : `<!DOCTYPE html><html><head>${tag}</head><body>${html}</body></html>`;
};

// ── printer selection (automatic) ───────────────────────────────────────────
const listPrinters = async () => {
  const win = (mainWindow && !mainWindow.isDestroyed()) ? mainWindow : BrowserWindow.getAllWindows()[0];
  const wc = win && win.webContents;
  if (!wc) return [];
  return typeof wc.getPrintersAsync === 'function' ? wc.getPrintersAsync() : wc.getPrinters();
};

const pickThermalPrinter = (printers) => {
  const forced = String(process.env.POS_PRINTER_NAME || '').trim();
  if (forced) return forced;
  const real = printers.filter((p) => !VIRTUAL_PRINTER_RE.test(p.name));
  const thermal = real.filter((p) => THERMAL_PRINTER_RE.test(p.name));
  const pool = thermal.length ? thermal : real.filter((p) => !OFFICE_PRINTER_RE.test(p.name));
  if (!pool.length) return null;
  return (pool.find((p) => p.isDefault) || pool[0]).name;
};

// ── persistent offscreen renderer (created once, lives for the app's lifetime) ──
let rendererWindow = null;
let rendererReady = null;

const DSF = PRINTER_DOTS / RECEIPT_CSS_WIDTH;

const createRendererWindow = () => new Promise((resolve, reject) => {
  const win = new BrowserWindow({
    show: false, frame: false, width: RECEIPT_CSS_WIDTH, height: 900,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  const wc = win.webContents;

  win.webContents.once('did-finish-load', async () => {
    try {
      wc.debugger.attach('1.3'); // attached ONCE for the window's whole life
      await wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
        width: RECEIPT_CSS_WIDTH, height: 900, deviceScaleFactor: DSF, mobile: false
      });
      resolve(win);
    } catch (err) {
      reject(err);
    }
  });
  win.webContents.once('did-fail-load', (_e, code, desc) => reject(new Error(`Renderer init failed: ${desc || code}`)));
  win.loadURL('about:blank').catch(reject);
});

const getRendererWindow = async () => {
  if (rendererWindow && !rendererWindow.isDestroyed()) return rendererWindow;
  if (!rendererReady) {
    rendererReady = createRendererWindow().then((win) => {
      rendererWindow = win;
      win.on('closed', () => { rendererWindow = null; rendererReady = null; });
      return win;
    }).catch((err) => { rendererReady = null; throw err; });
  }
  return withTimeout(rendererReady, 15000, 'Renderer init');
};

// Call this once at app startup (app.whenReady) so the FIRST real print
// isn't the one that pays for window creation + CDP attach.
const prewarmPrinting = async () => {
  try { await getRendererWindow(); } catch (err) { console.error('[print] prewarm failed:', err.message); }
  try { await ensureRawWorker(); } catch (err) { console.error('[print] worker prewarm failed:', err.message); }
};

// One in-page round trip: reset the document AND wait for it to be paint-ready.
// document.open/write/close replaces the whole DOM in-place — no navigation,
// no did-finish-load wait, fonts/cache stay warm from the previous job.
const renderAndMeasure = (wc, html) => withTimeout(wc.executeJavaScript(`(async () => {
  document.open();
  document.write(${JSON.stringify(injectCss(html, RASTER_CSS))});
  document.close();
  await Promise.all(Array.from(document.images).map(img => img.complete ? null : new Promise(r => {
    img.addEventListener('load', r, { once: true });
    img.addEventListener('error', r, { once: true });
  })));
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const el = document.querySelector('.receipt, .ticket') || document.body;
  return { height: Math.ceil(el.getBoundingClientRect().height) };
})()`, true), 10000, 'Render+measure');

const waitForPaintSettle = (wc) => withTimeout(
  wc.executeJavaScript('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))', true),
  5000, 'Paint settle'
);

// ── HTML -> PNG at printer resolution (persistent window, no per-job creation) ──
const renderReceiptImage = async (html) => {
  const win = await getRendererWindow();
  const wc = win.webContents;

  const m = await renderAndMeasure(wc, html);
  const cssHeight = Math.min(Math.max(m.height, 50), 12000);

  await wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
    width: RECEIPT_CSS_WIDTH, height: cssHeight + 4, deviceScaleFactor: DSF, mobile: false
  });
  await waitForPaintSettle(wc); // replaces the old fixed 200ms sleep

  const shot = await withTimeout(
    wc.debugger.sendCommand('Page.captureScreenshot', { format: 'png', fromSurface: true }),
    15000, 'Screenshot'
  );
  const image = nativeImage.createFromBuffer(Buffer.from(shot.data, 'base64'));
  if (image.isEmpty()) throw new Error('Screenshot was empty');

  // Reset viewport back to the tall default so the NEXT job's measure pass
  // isn't accidentally clipped by this job's shorter height.
  await wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
    width: RECEIPT_CSS_WIDTH, height: 900, deviceScaleFactor: DSF, mobile: false
  });

  return image;
};

// ── printer selection, now CACHED — enumeration cost paid once, not per job ──
let printerCache = { name: null, resolvedAt: 0 };
const PRINTER_CACHE_MS = 10 * 60 * 1000; // re-check every 10 min, or immediately on failure

const resolveThermalPrinter = async (force = false) => {
  const fresh = !force && printerCache.name && (Date.now() - printerCache.resolvedAt < PRINTER_CACHE_MS);
  if (fresh) return printerCache.name;

  const printers = await listPrinters();
  const target = pickThermalPrinter(printers);
  if (target) {
    printerCache = { name: target, resolvedAt: Date.now() };
    return target;
  }
  printerCache = { name: null, resolvedAt: 0 };
  console.warn('[print-html] No physical printer matched. Installed:', printers.map((p) => p.name).join(', ') || '(none)');
  return null;
};

// ── bitmap -> ESC/POS (centered, trimmed top/bottom, feed, cut) ─────────────
const buildEscPosRaster = (image) => {
  let img = image;
  if (img.getSize().width !== PRINTER_DOTS) img = img.resize({ width: PRINTER_DOTS, quality: 'best' });
  const { width, height } = img.getSize();
  const bmp = img.toBitmap(); // BGRA
  const stride = Math.floor(bmp.length / height);
  const rowBytes = Math.ceil(width / 8);
  const packed = Buffer.alloc(rowBytes * height);
  let firstInk = -1;
  let lastInk = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * stride + x * 4;
      const lum = 0.114 * bmp[i] + 0.587 * bmp[i + 1] + 0.299 * bmp[i + 2] + (255 - bmp[i + 3]);
      if (lum < INK_THRESHOLD) {
        packed[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
        if (firstInk < 0) firstInk = y;
        lastInk = y;
      }
    }
  }
  if (lastInk < 0) throw new Error('Rendered receipt is blank, refusing to print');

  const startRow = Math.max(0, firstInk - TOP_MARGIN_ROWS);
  const endRow = Math.min(height, lastInk + 1 + BOTTOM_MARGIN_ROWS);
  const parts = [Buffer.from([0x1b, 0x40]), Buffer.from([0x1b, 0x61, 0x01])]; // init, center
  for (let y = startRow; y < endRow; y += RASTER_BAND_ROWS) {
    const h = Math.min(RASTER_BAND_ROWS, endRow - y);
    parts.push(Buffer.from([0x1d, 0x76, 0x30, 0x00, rowBytes & 0xff, (rowBytes >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff]));
    parts.push(packed.subarray(y * rowBytes, (y + h) * rowBytes));
  }
  parts.push(Buffer.from([0x1b, 0x4a, FEED_BEFORE_CUT_DOTS]));
  parts.push(Buffer.from([0x1d, 0x56, 0x42, 0x00])); // feed to cut position + cut
  console.log(`[print-html] raster ${width}x${endRow - startRow} dots`);
  return Buffer.concat(parts);
};

// ── RAW bytes -> Windows spooler through ONE long-lived PowerShell worker ───
const RAW_PRINTER_CS = `using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
  static extern bool OpenPrinter(string name, out IntPtr h, IntPtr pd);
  [DllImport("winspool.drv", SetLastError = true, ExactSpelling = true)]
  static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
  static extern bool StartDocPrinter(IntPtr h, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);
  [DllImport("winspool.drv", SetLastError = true, ExactSpelling = true)]
  static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true, ExactSpelling = true)]
  static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true, ExactSpelling = true)]
  static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true, ExactSpelling = true)]
  static extern bool WritePrinter(IntPtr h, IntPtr bytes, int count, out int written);

  public static void Send(string printer, byte[] data) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero))
      throw new Exception("OpenPrinter failed for '" + printer + "' (Win32 error " + Marshal.GetLastWin32Error() + ")");
    try {
      DOCINFOW di = new DOCINFOW();
      di.pDocName = "POS Receipt";
      di.pDataType = "RAW";
      if (!StartDocPrinter(h, 1, di))
        throw new Exception("StartDocPrinter failed (Win32 error " + Marshal.GetLastWin32Error() + ")");
      try {
        if (!StartPagePrinter(h))
          throw new Exception("StartPagePrinter failed (Win32 error " + Marshal.GetLastWin32Error() + ")");
        IntPtr p = Marshal.AllocCoTaskMem(data.Length);
        try {
          Marshal.Copy(data, 0, p, data.Length);
          int written;
          if (!WritePrinter(h, p, data.Length, out written) || written != data.Length)
            throw new Exception("WritePrinter failed (Win32 error " + Marshal.GetLastWin32Error() + ")");
        } finally { Marshal.FreeCoTaskMem(p); }
        EndPagePrinter(h);
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
  }
}`;

const RAW_WORKER_PS = [
  "$ErrorActionPreference = 'Stop'",
  "$src = @'",
  RAW_PRINTER_CS,
  "'@",
  'Add-Type -TypeDefinition $src',
  "[Console]::Out.WriteLine('READY')",
  '[Console]::Out.Flush()',
  'while ($true) {',
  '  $line = [Console]::In.ReadLine()',
  '  if ($null -eq $line) { break }',
  '  try {',
  "    $p = $line.Split('|')",
  '    $printer = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p[0]))',
  '    $file = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p[1]))',
  '    [RawPrinter]::Send($printer, [IO.File]::ReadAllBytes($file))',
  "    [Console]::Out.WriteLine('OK')",
  '  } catch {',
  "    $m = ($_.Exception.Message -replace '[\\r\\n]+', ' ')",
  "    [Console]::Out.WriteLine('ERR ' + $m)",
  '  }',
  '  [Console]::Out.Flush()',
  '}'
].join('\n');

let rawWorker = null;
let rawWorkerReady = null;
let rawJob = null;
let rawOut = '';

const killRawWorker = () => {
  const w = rawWorker;
  rawWorker = null;
  rawWorkerReady = null;
  if (w) { try { w.kill(); } catch { /* ignore */ } }
};

const ensureRawWorker = async () => {
  if (rawWorker && rawWorkerReady) return withTimeout(rawWorkerReady, 20000, 'PowerShell start');
  const { spawn } = await import('child_process');
  const encoded = Buffer.from(RAW_WORKER_PS, 'utf16le').toString('base64');
  const ps = spawn('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  rawWorker = ps;
  ps.stdin.on('error', () => { /* worker died; the exit handler rejects the job and the dialog fallback prints */ });
  rawOut = '';
  let stderr = '';
  let readyResolve;
  let readyReject;
  rawWorkerReady = new Promise((res, rej) => { readyResolve = res; readyReject = rej; });
  rawWorkerReady.catch(() => { });

  ps.stderr.on('data', (d) => { stderr += d.toString(); });
  ps.stdout.on('data', (d) => {
    rawOut += d.toString();
    let idx;
    while ((idx = rawOut.indexOf('\n')) >= 0) {
      const line = rawOut.slice(0, idx).trim();
      rawOut = rawOut.slice(idx + 1);
      if (line === 'READY') { readyResolve(); continue; }
      if (rawJob && (line === 'OK' || line.startsWith('ERR'))) {
        const job = rawJob;
        rawJob = null;
        if (line === 'OK') job.resolve();
        else job.reject(Object.assign(new Error(line.slice(4) || 'Printer error'), { soft: true }));
      }
    }
  });
  const onDead = (why) => {
    if (rawWorker === ps) { rawWorker = null; rawWorkerReady = null; }
    const err = new Error(`PowerShell worker ${why}: ${stderr.slice(0, 300)}`);
    readyReject(err);
    if (rawJob) { const j = rawJob; rawJob = null; j.reject(err); }
  };
  ps.on('error', (e) => onDead(e.message));
  ps.on('exit', (c) => onDead(`exited (${c})`));
  return withTimeout(rawWorkerReady, 20000, 'PowerShell start');
};

const sendRawToPrinter = async (printerName, data) => {
  const tmpFile = path.join(app.getPath('temp'), `pos-raw-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.bin`);
  fs.writeFileSync(tmpFile, data);
  try {
    await ensureRawWorker();
    await withTimeout(new Promise((resolve, reject) => {
      rawJob = { resolve, reject };
      const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
      rawWorker.stdin.write(`${b64(printerName)}|${b64(tmpFile)}\n`);
    }), 25000, 'RAW spool');
  } catch (err) {
    rawJob = null;
    if (!err.soft) killRawWorker(); // restart the worker only if it is unhealthy
    throw err;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
};

// ── fallback: your existing working Windows print dialog ────────────────────
const printViaDialog = (htmlContent) => new Promise((resolve) => {
  let settled = false;
  const win = new BrowserWindow({
    show: true, width: 420, height: 780,
    webPreferences: { nodeIntegration: false, contextIsolation: true, backgroundThrottling: false }
  });
  const hardTimeout = setTimeout(() => done({ success: false, errorType: 'Timeout' }), 60000);
  const done = (result) => {
    if (settled) return;
    settled = true;
    clearTimeout(hardTimeout);
    if (!win.isDestroyed()) win.close();
    resolve(result);
  };
  win.webContents.once('did-finish-load', () => {
    if (win.isDestroyed()) return done({ success: false, errorType: 'WindowDestroyed' });
    win.webContents.print({ silent: false, printBackground: true }, (success, errorType) => done({ success, errorType }));
  });
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(injectCss(htmlContent, BASE_CSS + '@media print{@page{margin:0!important}}'))}`).catch(() => { });
});

// ── one job at a time (receipt + kitchen ticket never overlap) ──────────────
let printQueue = Promise.resolve();
const enqueuePrint = (task) => {
  const run = printQueue.then(task, task);
  printQueue = run.catch(() => { });
  return run;
};

const printJob = async (htmlContent) => {
  if (PRINT_MODE !== 'driver' && process.platform === 'win32') {
    let target = null;
    try {
      target = await resolveThermalPrinter();
      if (target) {
        const image = await withTimeout(renderReceiptImage(htmlContent), 30000, 'Render');
        const data = buildEscPosRaster(image);
        try {
          await sendRawToPrinter(target, data);
        } catch (err) {
          // Cached printer name may be stale (renamed/unplugged) — re-resolve once and retry.
          if (!err.soft) throw err;
          target = await resolveThermalPrinter(true);
          if (!target) throw err;
          await sendRawToPrinter(target, data);
        }
        console.log(`[print-html] RAW ESC/POS sent to "${target}" (${data.length} bytes)`);
        return { success: true };
      }
    } catch (err) {
      console.error('[print-html] RAW print failed, using print dialog:', err.message);
    }
  }
  return printViaDialog(htmlContent);
};

// One-time width test: run the app once with POS_PRINT_TEST=1
const RULER_HTML = `<!DOCTYPE html><html><head><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;background:#fff;color:#000}
.receipt{width:302px;padding:8px}.row{display:flex;width:100%}
.row div{flex:1;border:2px solid #000;text-align:center;font-weight:900;font-size:18px;padding:12px 0}
</style></head><body><div class="receipt">
<div style="font-weight:900;font-size:14px;text-align:center;margin-bottom:6px">WIDTH TEST (${PRINTER_DOTS} dots)</div>
<div class="row">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<div>${n}</div>`).join('')}</div>
<div style="font-size:11px;font-weight:700;margin-top:6px;text-align:center">Count the fully visible boxes (of 10)</div>
</div></body></html>`;




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
  prewarmPrinting();

  // Start the print worker now so the first receipt is fast
  if (process.platform === 'win32' && PRINT_MODE !== 'driver') {
    ensureRawWorker().catch((e) => console.warn('[print-html] Worker warm-up failed:', e.message));
  }
  if (process.env.POS_PRINT_TEST === '1') {
    setTimeout(() => enqueuePrint(() => printJob(RULER_HTML)), 8000);
  }

  ipcMain.on('retry-startup', () => {
    startBackendProcess();
  });

  ipcMain.on('app-quit', () => {
    app.quit();
  });

  ipcMain.handle('print-html', (_event, htmlContent) => enqueuePrint(() => printJob(htmlContent)));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Auto-updater setup
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  if (process.env.GH_TOKEN) {
    autoUpdater.requestHeaders = {
      Authorization: `Bearer ${process.env.GH_TOKEN}`
    };
  }

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
  if (rendererWindow && !rendererWindow.isDestroyed()) {
    try { rendererWindow.destroy(); } catch { /* ignore */ }
  }
  killRawWorker();
  await stopBackendGracefully();
  app.exit(0);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
