import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  secret: string;
  issuer: string;
  audience: string;
  accessTokenTtl: string;
  refreshTokenTtl: string;
}

export default registerAs<JwtConfig>('jwt', () => ({
  secret: process.env.JWT_SECRET ?? 'secret',
  issuer: process.env.JWT_ISSUER ?? 'house-scanner',
  audience: process.env.JWT_AUDIENCE ?? 'house-scanner-users',
  accessTokenTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshTokenTtl: process.env.JWT_REFRESH_TTL ?? '7d',
}));
