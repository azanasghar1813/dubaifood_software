import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import config from './config/index.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy if running behind reverse proxy (e.g. Nginx, Heroku)
app.set('trust proxy', 1);

// --- GLOBAL MIDDLEWARE ---

// Security Headers
app.use(helmet({ crossOriginResourcePolicy: false }));

// Cross-Origin Resource Sharing
app.use(cors({
  origin: '*', // Configure properly in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-cashier-session-id', 'x-terminal-id']
}));

// Request Logging
app.use(morgan(config.app.isDev ? 'dev' : 'combined'));

// Payload Compression
app.use(compression());

// Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static storage (images, etc)
app.use('/storage', express.static(config.paths.root));

// --- ROUTES ---

// Mount API Routes
app.use(config.server.apiPrefix, apiRoutes);

// --- ERROR HANDLING ---

// 404 Route Not Found for API
app.use(config.server.apiPrefix, notFoundHandler);

// In production, serve the React frontend
if (config.app.isProd) {
  // Go up from backend/src/app.js to frontend/dist
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));
  
  // Catch-all route to serve index.html for React Router
  app.use((req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  // If not prod, keep the global 404 handler for non-API routes too
  app.use(notFoundHandler);
}

// Global Error Handler
app.use(errorHandler);

export default app;
