import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { ModelQueryDto } from './dto/model-query.dto';
import { UpsertModelInfoDto } from './dto/upsert-model-info.dto';
import { ModelsInfoService } from './models-info.service';

@Controller('models-info')
export class ModelsInfoController {
  constructor(private readonly modelsInfoService: ModelsInfoService) {}

  @Get()
  list(@Query() query: ModelQueryDto) {
    return this.modelsInfoService.list(query);
  }

  @Post()
  @Roles('admin')
  upsert(@Body() dto: UpsertModelInfoDto) {
    return this.modelsInfoService.upsert(dto);
  }
}
