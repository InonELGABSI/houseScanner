import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/orm/prisma.module';
import { ModelsInfoController } from './models-info.controller';
import { ModelsInfoService } from './models-info.service';

@Module({
  imports: [PrismaModule],
  controllers: [ModelsInfoController],
  providers: [ModelsInfoService],
  exports: [ModelsInfoService],
})
export class ModelsInfoModule {}
