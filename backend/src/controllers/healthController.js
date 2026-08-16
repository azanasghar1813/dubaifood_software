import config from '../config/index.js';

/**
 * Health Controller
 * Provides system health metrics and application status.
 */
import { dbEngine } from '../database/sqlite.js';

export const checkHealth = (req, res) => {
  const dbConnected = !!dbEngine.db;
  
  const healthStatus = {
    status: dbConnected ? 'ok' : 'initializing',
    version: config.app.version,
    uptime: process.uptime(),
    currentTime: new Date().toISOString(),
    environment: config.app.env,
    backendStatus: 'healthy',
    databaseStatus: dbConnected ? 'connected' : 'not connected'
  };

  if (!dbConnected) {
    return res.status(503).json(healthStatus);
  }
  res.status(200).json(healthStatus);
};
