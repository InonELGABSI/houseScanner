import { registerAs } from '@nestjs/config';

export interface RateLimitConfig {
  ttl: number;
  limit: number;
}

export default registerAs<RateLimitConfig>('rateLimit', () => ({
  ttl: Number(process.env.RATE_LIMIT_TTL ?? 60),
  limit: Number(process.env.RATE_LIMIT_LIMIT ?? 60),
}));
