import config from '../config/index.js';

/**
 * Health Controller
 * Provides system health metrics and application status.
 */
export const checkHealth = (req, res) => {
  const healthStatus = {
    status: 'ok',
    version: config.app.version,
    uptime: process.uptime(),
    currentTime: new Date().toISOString(),
    environment: config.app.env,
    backendStatus: 'healthy',
    databaseStatus: 'not connected' // Placeholder for future DB integration
  };

  res.status(200).json(healthStatus);
};
