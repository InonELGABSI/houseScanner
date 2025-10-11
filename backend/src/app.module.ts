import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import Joi from 'joi';
import {
  appConfig,
  dbConfig,
  jwtConfig,
  pythonAgentsConfig,
  rateLimitConfig,
  storageConfig,
} from './config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ValidationExceptionFilter } from './common/filters/validation-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './infra/orm/prisma.module';
import { StorageModule } from './infra/storage/storage.module';
import { PythonAgentsModule } from './infra/http/python-agents.module';
import { QueueModule } from './infra/queue/queue.module';
import { HealthModule } from './infra/health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HousesModule } from './houses/houses.module';
import { ScansModule } from './scans/scans.module';
import { RoomsModule } from './rooms/rooms.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { ModelsInfoModule } from './models-info/models-info.module';
import { AgentsRunsModule } from './agents-runs/agents-runs.module';
import { SummariesModule } from './summaries/summaries.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        dbConfig,
        storageConfig,
        jwtConfig,
        pythonAgentsConfig,
        rateLimitConfig,
      ],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3000),
        GLOBAL_PREFIX: Joi.string().default('api'),
        CORS_ORIGINS: Joi.string().optional(),
        DATABASE_URL: Joi.string().uri().required(),
        DATABASE_SHADOW_URL: Joi.string().uri().optional(),
        JWT_SECRET: Joi.string().min(10).required(),
        JWT_ISSUER: Joi.string().required(),
        JWT_AUDIENCE: Joi.string().required(),
        JWT_ACCESS_TTL: Joi.string().default('15m'),
        JWT_REFRESH_TTL: Joi.string().default('7d'),
        STORAGE_ENDPOINT: Joi.string().required(),
        STORAGE_BUCKET: Joi.string().required(),
        STORAGE_REGION: Joi.string().optional(),
        STORAGE_ACCESS_KEY: Joi.string().required(),
        STORAGE_SECRET_KEY: Joi.string().required(),
        STORAGE_USE_SSL: Joi.boolean()
          .truthy('true')
          .falsy('false')
          .default(true),
        STORAGE_PUBLIC_URL: Joi.string().optional(),
        PYTHON_AGENTS_BASE_URL: Joi.string().required(),
        PYTHON_AGENTS_TIMEOUT: Joi.number().default(300000), // 5 minutes for AI processing
        PYTHON_AGENTS_RETRY_COUNT: Joi.number().default(1), // 1 retry = 2 total attempts
        PYTHON_AGENTS_RETRY_DELAY: Joi.number().default(500),
        RATE_LIMIT_TTL: Joi.number().default(60),
        RATE_LIMIT_LIMIT: Joi.number().default(60),
        REDIS_URL: Joi.string().uri().optional(),
        UPLOAD_MAX_SIZE_MB: Joi.number().default(10),
      }),
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => [{ ttl: 60, limit: 60 }],
    }),
    PrismaModule,
    StorageModule,
    PythonAgentsModule,
    QueueModule,
    HealthModule,
    AuthModule,
    UsersModule,
    HousesModule,
    ScansModule,
    RoomsModule,
    ChecklistsModule,
    ModelsInfoModule,
    AgentsRunsModule,
    SummariesModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_FILTER, useClass: ValidationExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
