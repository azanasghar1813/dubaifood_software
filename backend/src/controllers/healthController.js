import config from '../config/index.js';
import { dbEngine } from '../database/sqlite.js';
import { configService } from '../services/configService.js';

export const checkHealth = (req, res) => {
  const dbConnected = !!dbEngine.db;
  let orderPrefix = null;
  let waiterUrls = [];
  try {
    if (dbConnected) {
      orderPrefix = configService.getSyncConfig().order_prefix || null;
      if (orderPrefix && /^T[0-9A-F]{2}$/i.test(String(orderPrefix))) orderPrefix = null;
      waiterUrls = configService.getLanLoginUrls();
    }
  } catch { /* config may not be ready yet */ }

  const healthStatus = {
    status: dbConnected ? 'ok' : 'initializing',
    version: config.app.version,
    uptime: process.uptime(),
    currentTime: new Date().toISOString(),
    environment: config.app.env,
    backendStatus: 'healthy',
    databaseStatus: dbConnected ? 'connected' : 'not connected',
    order_prefix: orderPrefix,
    waiter_urls: waiterUrls
  };

  if (!dbConnected) {
    return res.status(503).json(healthStatus);
  }
  res.status(200).json(healthStatus);
};

export const claimDeviceId = (req, res) => {
  try {
    const prefix = configService.claimOrderPrefix(req.body?.order_prefix || req.body?.device_id);
    res.status(200).json({ success: true, data: { order_prefix: prefix } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
