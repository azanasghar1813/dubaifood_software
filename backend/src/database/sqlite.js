import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

/**
 * Production-grade SQLite Database Engine.
 * Implements Singleton pattern to ensure only one connection is managed.
 */
class DatabaseEngine {
  constructor() {
    if (DatabaseEngine.instance) {
      return DatabaseEngine.instance;
    }
    this.db = null;
    this.dbPath = null;
    // 64 MB WAL threshold
    this.WAL_SIZE_THRESHOLD = 64 * 1024 * 1024; 
    DatabaseEngine.instance = this;
  }

  /**
   * Connects to the database and applies recommended PRAGMAs for offline-first desktop.
   * @param {string} dbPath - Absolute path to the .db file
   */
  connect(dbPath) {
    if (this.db) {
      return this.db;
    }

    this.dbPath = dbPath;
    
    // Open connection
    this.db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : null,
      fileMustExist: false // Creates file if missing
    });

    // Apply strict optimizations for Desktop/Electron
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000'); // 5 seconds wait if locked
    this.db.pragma('cache_size = -64000'); // 64MB memory cache
    this.db.pragma('temp_store = MEMORY');

    return this.db;
  }

  /**
   * Performs an intelligent WAL Checkpoint (TRUNCATE).
   * Used during graceful shutdown, backups, sync, or if the WAL gets too large.
   */
  forceCheckpoint() {
    if (!this.db) return;
    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
      console.log('✅ SQLite WAL check-pointed and truncated successfully.');
    } catch (error) {
      console.error('❌ Failed to execute WAL checkpoint:', error.message);
    }
  }

  /**
   * Checks if the WAL file exceeds the configured threshold and truncates if necessary.
   * Should be invoked after heavy writes or periodically by a maintenance task.
   */
  autoCheckpointIfNecessary() {
    if (!this.dbPath) return;
    const walPath = `${this.dbPath}-wal`;
    try {
      if (fs.existsSync(walPath)) {
        const stats = fs.statSync(walPath);
        if (stats.size > this.WAL_SIZE_THRESHOLD) {
          console.log(`⚠️ WAL size (${(stats.size/1024/1024).toFixed(2)} MB) exceeded threshold. Truncating...`);
          this.forceCheckpoint();
        }
      }
    } catch (error) {
      console.error('Failed to check WAL size:', error.message);
    }
  }

  /**
   * Prepares a SQL statement.
   * @param {string} sql 
   */
  prepare(sql) {
    this._ensureConnected();
    return this.db.prepare(sql);
  }

  /**
   * Runs a SQL statement (INSERT, UPDATE, DELETE)
   */
  run(sql, ...params) {
    return this.prepare(sql).run(...params);
  }

  /**
   * Gets a single row (SELECT)
   */
  get(sql, ...params) {
    return this.prepare(sql).get(...params);
  }

  /**
   * Gets multiple rows (SELECT)
   */
  all(sql, ...params) {
    return this.prepare(sql).all(...params);
  }

  /**
   * Executes a callback function inside a database transaction.
   * Uses better-sqlite3's built-in robust transaction wrapper.
   * @param {Function} callback 
   */
  transaction(callback) {
    this._ensureConnected();
    const tx = this.db.transaction(callback);
    return tx(); // Supports passing arguments if needed by modifying this signature
  }

  /**
   * Safely closes the database connection.
   */
  close() {
    if (this.db) {
      console.log('Database Engine: Executing final WAL checkpoint...');
      this.forceCheckpoint();
      
      this.db.close();
      this.db = null;
      console.log('✅ SQLite database connection closed safely.');
    }
  }

  /**
   * Internal guard to prevent queries before connection.
   */
  _ensureConnected() {
    if (!this.db) {
      throw new Error('Database Engine is not connected. Call connect() first.');
    }
  }
}

export const dbEngine = new DatabaseEngine();
