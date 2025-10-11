import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/orm/prisma.module';
import { CryptoUtil } from '../common/utils/crypto.util';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, CryptoUtil],
  exports: [UsersService],
})
export class UsersModule {}
