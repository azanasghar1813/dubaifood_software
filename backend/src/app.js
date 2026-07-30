import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import config from './config/index.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';

const app = express();

// Trust proxy if running behind reverse proxy (e.g. Nginx, Heroku)
app.set('trust proxy', 1);

// --- GLOBAL MIDDLEWARE ---

// Security Headers
app.use(helmet());

// Cross-Origin Resource Sharing
app.use(cors({
  origin: '*', // Configure properly in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request Logging
app.use(morgan(config.app.isDev ? 'dev' : 'combined'));

// Payload Compression
app.use(compression());

// Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- ROUTES ---

// Mount API Routes
app.use(config.server.apiPrefix, apiRoutes);

// --- ERROR HANDLING ---

// 404 Route Not Found
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

export default app;
