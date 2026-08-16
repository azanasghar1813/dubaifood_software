import app from './app.js';
import config from './config/index.js';
import { storageManager } from './utils/storageManager.js';
import { initDatabase } from './database/initDatabase.js';
import { dbEngine } from './database/sqlite.js';
import { configService } from './services/configService.js';
import { menuCacheService } from './services/menuCacheService.js';
import { printEngineService } from './services/printEngineService.js';

/**
 * Handle Uncaught Exceptions
 * These are programmer errors that are completely unhandled.
 */
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err.name, err.message);
  console.error(err.stack);
  if (!process.versions.electron) {
    process.exit(1);
  }
});

// Print Startup Summary
const printStartupSummary = (storageResults, dbInfo, startupTimeMs) => {
  console.log('\n======================================================');
  console.log(`🚀 ${config.app.name} Backend Starting`);
  console.log('======================================================');
  console.log(`[Version]     : ${config.app.version}`);
  console.log(`[Environment] : ${config.app.env}`);
  console.log(`[Port]        : ${config.server.port}`);
  console.log(`[API URL]     : http://localhost:${config.server.port}${config.server.apiPrefix}`);
  console.log(`[Startup]     : ${startupTimeMs} ms`);
  console.log('------------------------------------------------------');
  
  if (storageResults) {
    console.log('📁 Storage Initialization:');
    let failures = false;
    storageResults.forEach(result => {
      const icon = result.status === 'VERIFIED' ? '✅' : result.status === 'CREATED' ? '✨' : '❌';
      console.log(`   ${icon} [${result.status}] ${result.path}`);
      if (result.status === 'FAILED') failures = true;
    });
    
    if (failures) {
      console.error('\n⚠️  WARNING: Some storage paths failed to initialize! Check permissions.');
    }
  }

  console.log('------------------------------------------------------');
  if (dbInfo) {
    console.log('🗄️  Database Engine:');
    console.log(`   Status      : ✅ ${dbInfo.status}`);
    console.log(`   Path        : ${dbInfo.path}`);
    console.log(`   SQLite Ver  : ${dbInfo.version}`);
    console.log(`   Mode        : ${dbInfo.journalMode}`);
    console.log(`   Foreign Keys: ${dbInfo.foreignKeysActive ? 'ON' : 'OFF'}`);
    
    if (dbInfo.migrations) {
      console.log('------------------------------------------------------');
      console.log('🏗️  Schema & Migrations:');
      console.log(`   Version     : ${dbInfo.migrations.newVersion}`);
      console.log(`   New Applied : ${dbInfo.migrations.newlyApplied}`);
      if (dbInfo.migrations.newlyApplied > 0) {
        console.log(`   Status      : ✅ Schema Upgraded`);
      } else {
        console.log(`   Status      : ✅ Schema Up To Date`);
      }
    }
    
    if (dbInfo.seeds) {
      console.log('------------------------------------------------------');
      console.log('🌱  Seed Data Initialization:');
      let anyNew = false;
      for (const stat of dbInfo.seeds) {
        console.log(`   ${stat.name.padEnd(12)}: ${stat.inserted > 0 ? `[INSERTED ${stat.inserted}]` : '[SKIPPED]'}`);
        if (stat.inserted > 0) anyNew = true;
      }
      if (anyNew) {
        console.log(`   Status      : ✅ Missing defaults injected`);
      } else {
        console.log(`   Status      : ✅ All defaults present`);
      }
    }
  }

  console.log('======================================================\n');
};

// Initialize environment and start server
const startServer = async () => {
  const startTime = Date.now();
  try {
    // 1. Initialize all local storage paths required by the app
    const storageResults = await storageManager.initializeStorage();
    
    // 2. Initialize the Database Engine
    const dbInfo = await initDatabase();

    // 3. Initialize Configuration Cache
    configService.initialize();

    // 4. Initialize Menu Engine Cache
    menuCacheService.initialize();

    // 5. Start the Print Engine background processor (independent of HTTP server)
    printEngineService.start();

    // 6. Start the HTTP server
    const server = app.listen(config.server.port, () => {
      const startupTimeMs = Date.now() - startTime;
      printStartupSummary(storageResults, dbInfo, startupTimeMs);
    });

    /**
     * Handle Unhandled Promise Rejections
     * These are unhandled rejections from async functions.
     */
    process.on('unhandledRejection', (err) => {
      console.error('[UNHANDLED REJECTION]', err.name, err.message);
      if (!process.versions.electron) {
        printEngineService.stop();
        dbEngine.close();
        server.close(() => {
          process.exit(1);
        });
      }
    });

    const gracefulShutdown = (signal) => {
      console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
      printEngineService.stop();
      dbEngine.close();
      server.close(() => {
        console.log('HTTP server closed.');
        if (!process.versions.electron) {
          process.exit(0);
        }
      });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    console.error('❌ FATAL STARTUP ERROR:', error);
    // Ensure DB is closed if it somehow crashed after connecting
    dbEngine.close();
    if (!process.versions.electron) {
      process.exit(1);
    }
  }
};

startServer();