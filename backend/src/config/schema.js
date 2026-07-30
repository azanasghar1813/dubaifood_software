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
  API_PREFIX: z.string().default('/api/v1'),
  
  // Storage (Relative to backend root)
  STORAGE_ROOT: z.string().default('../../storage'),
  JWT_SECRET: z.string().min(16).default('development-secret-key-do-not-use-in-prod'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
});
