import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('healthz')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  async check() {
    const [database, storage, pythonAgents] = await Promise.all([
      this.healthService.checkDatabase(),
      this.healthService.checkStorage(),
      this.healthService.checkPythonAgents(),
    ]);

    return {
      status: database && storage && pythonAgents ? 'ok' : 'degraded',
      environment: this.healthService.getEnvironment(),
      checks: {
        database,
        storage,
        pythonAgents,
      },
    };
  }
}
