import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdParamDto } from '../common/dto/id.dto';
import { SummariesService } from './summaries.service';
import { ScanSummaryResponseDto } from './dto/scan-summary-response.dto';

interface RequestUser {
  userId: string;
}

@ApiTags('Scans')
@ApiBearerAuth()
@Controller('scans')
export class SummariesController {
  constructor(private readonly summariesService: SummariesService) {}

  @Get(':id/summary')
  @ApiOperation({ summary: 'Get scan summary' })
  @ApiOkResponse({
    type: ScanSummaryResponseDto,
    description: 'Scan summary retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Scan or summary not found' })
  getSummary(@CurrentUser() user: RequestUser, @Param() params: IdParamDto) {
    return this.summariesService.getByScan(user.userId, params.id);
  }
}
