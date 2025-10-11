import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/orm/prisma.module';
import { HousesService } from './houses.service';

/**
 * Houses Module
 *
 * Note: No controller/endpoints exposed. House data is accessed via scans API.
 * HousesService is maintained for internal use by other services.
 */
@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [HousesService],
  exports: [HousesService],
})
export class HousesModule {}
