import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosRequestConfig } from 'axios';
import { lastValueFrom } from 'rxjs';
import { PythonAgentsConfig } from '../../config';

@Injectable()
export class PythonAgentsClient {
  private readonly logger = new Logger(PythonAgentsClient.name);

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const settings = this.configService.getOrThrow<PythonAgentsConfig>(
      'pythonAgents',
      {
        infer: true,
      },
    );

    let attempt = 0;
    const maxAttempts = settings.retryCount + 1;

    while (attempt < maxAttempts) {
      try {
        const response = await lastValueFrom(
          this.http.request<T>({
            baseURL: settings.baseUrl,
            timeout: settings.timeout,
            ...config,
          }),
        );
        return response.data;
      } catch (error) {
        attempt += 1;
        this.logger.warn(
          `Python agents request failed (attempt ${attempt}/${maxAttempts})`,
          error instanceof Error ? error.stack : undefined,
        );
        if (attempt >= maxAttempts) {
          throw new ServiceUnavailableException(
            'Python agents service unavailable',
          );
        }
        await this.delay(settings.retryDelayMs);
      }
    }

    throw new ServiceUnavailableException('Python agents service unavailable');
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
