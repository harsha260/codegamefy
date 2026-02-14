export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '3001', 10),
  WS_PORT: parseInt(process.env.WS_PORT ?? '3002', 10),

  // Database
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://codearena:codearena@localhost:5432/codearena',

  // Redis
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY ?? '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY ?? '7d',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:3000',

  // Judge Service
  JUDGE_URL: process.env.JUDGE_URL ?? 'http://localhost:3003',

  // OAuth
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? '',
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ?? '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
} as const;
