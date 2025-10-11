import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/orm/prisma.module';
import { AgentsRunsController } from './agents-runs.controller';
import { AgentsRunsService } from './agents-runs.service';

@Module({
  imports: [PrismaModule],
  controllers: [AgentsRunsController],
  providers: [AgentsRunsService],
  exports: [AgentsRunsService],
})
export class AgentsRunsModule {}
