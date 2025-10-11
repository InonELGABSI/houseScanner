import { registerAs } from '@nestjs/config';

export interface AppConfig {
  environment: string;
  port: number;
  globalPrefix: string;
  corsOrigins: string[];
}

const parseCorsOrigins = (value: string | undefined): string[] => {
  if (!value || value.trim().length === 0) {
    return ['http://localhost:5173'];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

export default registerAs<AppConfig>('app', () => ({
  environment: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  globalPrefix: process.env.GLOBAL_PREFIX ?? 'api',
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
}));
