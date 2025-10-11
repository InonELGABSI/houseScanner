import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../infra/orm/prisma.module';
import { StorageModule } from '../infra/storage/storage.module';
import { QueueModule } from '../infra/queue/queue.module';
import { RoomsModule } from '../rooms/rooms.module';
import { SummariesModule } from '../summaries/summaries.module';
import { ChecklistsModule } from '../checklists/checklists.module';
import { ScansController } from './scans.controller';
import { ScansRepository } from './scans.repository';
import { ScansService } from './scans.service';
import { ScansGateway } from './scans.gateway';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    forwardRef(() => QueueModule),
    RoomsModule,
    SummariesModule,
    ChecklistsModule,
  ],
  controllers: [ScansController],
  providers: [ScansService, ScansRepository, ScansGateway],
  exports: [ScansService, ScansGateway],
})
export class ScansModule {}
