import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PythonAgentsModule } from '../http/python-agents.module';
import { queueOptions, SCAN_QUEUE } from './queues';
import { ScanProcessor } from './processors/scan.processor';
import { ScansModule } from '../../scans/scans.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        const connection = redisUrl
          ? { url: redisUrl }
          : { host: 'localhost', port: 6379 };
        return { connection };
      },
    }),
    BullModule.registerQueue({
      name: SCAN_QUEUE,
      defaultJobOptions: queueOptions[SCAN_QUEUE].defaultJobOptions,
    }),
    PythonAgentsModule,
    forwardRef(() => ScansModule),
  ],
  providers: [ScanProcessor],
  exports: [BullModule],
})
export class QueueModule {}
