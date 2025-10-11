import { registerAs } from '@nestjs/config';

export interface StorageConfig {
  endpoint: string;
  bucket: string;
  region?: string;
  accessKey: string;
  secretKey: string;
  useSSL: boolean;
  publicUrl?: string;
}

export default registerAs<StorageConfig>('storage', () => ({
  endpoint: process.env.STORAGE_ENDPOINT ?? '',
  bucket: process.env.STORAGE_BUCKET ?? '',
  region: process.env.STORAGE_REGION,
  accessKey: process.env.STORAGE_ACCESS_KEY ?? '',
  secretKey: process.env.STORAGE_SECRET_KEY ?? '',
  useSSL: (process.env.STORAGE_USE_SSL ?? 'true').toLowerCase() === 'true',
  publicUrl: process.env.STORAGE_PUBLIC_URL,
}));
