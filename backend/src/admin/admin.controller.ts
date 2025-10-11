import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { IdParamDto } from '../common/dto/id.dto';
import { AdminService } from './admin.service';
import { UserRole } from '@prisma/client';

class ToggleChecklistDto {
  @IsBoolean()
  enable!: boolean;
}

class UpdateBaseChecklistDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  itemsRaw?: any;
}

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@Roles(UserRole.admin)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics' })
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('houses')
  @ApiOperation({ summary: 'Get all houses with user info' })
  @ApiResponse({ status: 200, description: 'List of all houses' })
  getAllHouses() {
    return this.adminService.getAllHouses();
  }

  @Get('scans')
  @ApiOperation({ summary: 'Get all scans with details' })
  @ApiResponse({ status: 200, description: 'List of all scans' })
  getAllScans() {
    return this.adminService.getAllScans();
  }

  @Get('agent-runs')
  @ApiOperation({ summary: 'Get all agent runs with costs' })
  @ApiResponse({ status: 200, description: 'List of all agent runs' })
  getAllAgentRuns() {
    return this.adminService.getAllAgentRuns();
  }

  @Get('models')
  @ApiOperation({ summary: 'Get all model information' })
  @ApiResponse({ status: 200, description: 'List of all models' })
  getAllModels() {
    return this.adminService.getAllModels();
  }

  @Get('checklists/base')
  @ApiOperation({ summary: 'Get all base checklists' })
  @ApiResponse({ status: 200, description: 'List of all base checklists' })
  getAllBaseChecklists() {
    return this.adminService.getAllBaseChecklists();
  }

  @Patch('checklists/:id')
  @ApiOperation({ summary: 'Update base checklist' })
  @ApiResponse({ status: 200, description: 'Checklist updated successfully' })
  updateBaseChecklist(
    @Param() params: IdParamDto,
    @Body() dto: UpdateBaseChecklistDto,
  ) {
    return this.adminService.updateBaseChecklist(params.id, dto);
  }

  @Patch('checklists/:id/toggle')
  @ApiOperation({ summary: 'Enable/disable base checklist' })
  @ApiResponse({ status: 200, description: 'Checklist toggled successfully' })
  toggle(@Param() params: IdParamDto, @Body() dto: ToggleChecklistDto) {
    return this.adminService.toggleChecklist(params.id, dto.enable);
  }
}
