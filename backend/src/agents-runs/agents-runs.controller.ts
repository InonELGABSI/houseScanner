import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ListAgentRunsDto } from './dto/list-agent-runs.dto';
import { AgentsRunsService } from './agents-runs.service';

interface RequestUser {
  userId: string;
}

@Controller('agents-runs')
export class AgentsRunsController {
  constructor(private readonly agentsRunsService: AgentsRunsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() query: ListAgentRunsDto) {
    return this.agentsRunsService.list(user.userId, query);
  }
}
