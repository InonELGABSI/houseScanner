import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PythonAgentsClient } from './python-agents.client';
import { PythonAgentsConfig } from '../../config';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.getOrThrow<PythonAgentsConfig>(
          'pythonAgents',
          {
            infer: true,
          },
        );

        return {
          timeout: config.timeout,
          baseURL: config.baseUrl,
        };
      },
    }),
  ],
  providers: [PythonAgentsClient],
  exports: [PythonAgentsClient],
})
export class PythonAgentsModule {}
