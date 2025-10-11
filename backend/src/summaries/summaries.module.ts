import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/orm/prisma.module';
import { SummariesController } from './summaries.controller';
import { SummariesService } from './summaries.service';

@Module({
  imports: [PrismaModule],
  controllers: [SummariesController],
  providers: [SummariesService],
  exports: [SummariesService],
})
export class SummariesModule {}
