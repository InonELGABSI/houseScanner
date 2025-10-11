import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChecklistsService } from './checklists.service';
import { UpdateChecklistDto } from './dto/update-checklist.dto';

interface RequestUser {
  userId: string;
  role: string;
}

@ApiTags('Checklists')
@ApiBearerAuth()
@Controller('checklists')
export class ChecklistsController {
  constructor(private readonly checklistsService: ChecklistsService) {}

  @Get('base/:scope')
  @ApiOperation({ summary: 'Get base checklist for a scope' })
  @ApiResponse({ status: 200, description: 'Base checklist retrieved' })
  getBaseChecklist(@Param('scope') scope: string) {
    return this.checklistsService.getBaseChecklist(scope);
  }

  @Put('base/:scope')
  @ApiOperation({ summary: 'Update or create base checklist (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Base checklist updated successfully',
  })
  updateBaseChecklist(
    @CurrentUser() user: RequestUser,
    @Param('scope') scope: string,
    @Body() dto: UpdateChecklistDto,
  ) {
    return this.checklistsService.updateBaseChecklist(user.userId, scope, dto);
  }

  @Patch(':checklistId')
  @ApiOperation({ summary: 'Update a specific user checklist' })
  @ApiResponse({ status: 200, description: 'Checklist updated successfully' })
  @ApiResponse({ status: 404, description: 'Checklist not found' })
  updateChecklist(
    @CurrentUser() user: RequestUser,
    @Param('checklistId') checklistId: string,
    @Body() dto: UpdateChecklistDto,
  ) {
    return this.checklistsService.updateChecklist(
      user.userId,
      checklistId,
      dto,
    );
  }

  @Put('scope/:scope')
  @ApiOperation({ summary: 'Create or update user checklist by scope' })
  @ApiResponse({
    status: 200,
    description: 'Checklist created or updated successfully',
  })
  upsertByScope(
    @CurrentUser() user: RequestUser,
    @Param('scope') scope: string,
    @Body() dto: UpdateChecklistDto,
  ) {
    return this.checklistsService.upsertByScope(user.userId, scope, dto);
  }
}
