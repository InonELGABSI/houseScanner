import { registerAs } from '@nestjs/config';

export interface PythonAgentsConfig {
  baseUrl: string;
  timeout: number;
  retryCount: number;
  retryDelayMs: number;
}

export default registerAs<PythonAgentsConfig>('pythonAgents', () => ({
  baseUrl: process.env.PYTHON_AGENTS_BASE_URL ?? 'http://localhost:8000',
  timeout: Number(process.env.PYTHON_AGENTS_TIMEOUT ?? 300000), // 5 minutes for AI processing
  retryCount: Number(process.env.PYTHON_AGENTS_RETRY_COUNT ?? 1), // 1 retry = 2 total attempts
  retryDelayMs: Number(process.env.PYTHON_AGENTS_RETRY_DELAY ?? 500),
}));
