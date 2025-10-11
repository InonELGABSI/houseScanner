import { Controller } from '@nestjs/common';
import { HousesService } from './houses.service';

/**
 * Houses Controller
 *
 * Note: All house endpoints have been removed. House data is now accessed
 * through the scans details API endpoint (GET /api/v1/scans/:scanId).
 * The HousesService is still maintained for internal use by other services.
 */
@Controller('houses')
export class HousesController {
  constructor(private readonly housesService: HousesService) {}

  // No public endpoints - house data accessed via scans API
}
