import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  logQueries: boolean;
}

export default registerAs<DatabaseConfig>('database', () => ({
  url: process.env.DATABASE_URL ?? '',
  logQueries:
    (process.env.DATABASE_LOG_QUERIES ?? 'false').toLowerCase() === 'true',
}));
