import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/orm/prisma.module';
import { ChecklistMergeService } from './checklist-merge.service';
import { ChecklistsController } from './checklists.controller';
import { ChecklistsService } from './checklists.service';

/**
 * Checklists Module
 *
 * Public endpoints:
 * - PATCH /checklists/:checklistId - Update user checklist
 *
 * ChecklistsService and ChecklistMergeService maintained for internal use.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ChecklistsController],
  providers: [ChecklistsService, ChecklistMergeService],
  exports: [ChecklistsService, ChecklistMergeService],
})
export class ChecklistsModule {}
