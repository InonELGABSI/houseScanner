import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/orm/prisma.module';
import { RoomsService } from './rooms.service';

@Module({
  imports: [PrismaModule],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
