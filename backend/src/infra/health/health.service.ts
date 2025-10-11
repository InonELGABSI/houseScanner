import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../orm/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PythonAgentsClient } from '../http/python-agents.client';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly pythonAgents: PythonAgentsClient,
    private readonly config: ConfigService,
  ) {}

  async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async checkStorage(): Promise<boolean> {
    try {
      const key = `health-check/${Date.now()}.txt`;
      await this.storage.uploadObject(key, 'ok');
      await this.storage.deleteObject(key);
      return true;
    } catch {
      return false;
    }
  }

  async checkPythonAgents(): Promise<boolean> {
    try {
      await this.pythonAgents.request({ method: 'GET', url: '/health' });
      return true;
    } catch {
      return false;
    }
  }

  getEnvironment() {
    return this.config.get<string>('NODE_ENV', 'development');
  }
}
