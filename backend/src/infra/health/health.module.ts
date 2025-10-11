import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PythonAgentsModule } from '../http/python-agents.module';
import { PrismaModule } from '../orm/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [ConfigModule, PrismaModule, StorageModule, PythonAgentsModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
