import { Module } from '@nestjs/common';
import { ChecklistsModule } from '../checklists/checklists.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [ChecklistsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
