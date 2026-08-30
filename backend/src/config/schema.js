import { z } from 'zod';

/**
 * Environment Validation Schema
 * Enforces types and provides default values for configuration variables.
 * Fails fast if required environment variables are missing in production.
 */
export const envSchema = z.object({
  // App
  APP_NAME: z.string().default('Dubai Food Software POS'),
  APP_VERSION: z.string().default('1.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Server
  PORT: z.string().transform(Number).default('5000'),
  HOST: z.string().default('0.0.0.0'),
  API_PREFIX: z.string().default('/api/v1'),
  DEFAULT_ADMIN_PIN: z.string().min(4).optional(),
  
  // Storage (Relative to backend root)
  STORAGE_ROOT: z.string().default('../../storage'),
  JWT_SECRET: z.string().min(16),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),

  // Sync API
  SYNC_API_URL: z.string().url().default('https://dubaifood-sync-api.vercel.app/api/v1'),
  DEVICE_SECRET: z.string().min(16).default('Azan@181314Sync2026'),
});
