import app from './app.js';
import config from './config/index.js';

const startServer = async () => {
  try {
    app.listen(config.port, () => {
      console.log(`[Sync API] Server is running on port ${config.port}`);
      console.log(`[Sync API] Environment: ${config.env}`);
    });
  } catch (error) {
    console.error('[Sync API] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
