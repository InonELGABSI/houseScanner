import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infra/orm/prisma.service';
import { ModelQueryDto } from './dto/model-query.dto';
import { UpsertModelInfoDto } from './dto/upsert-model-info.dto';

@Injectable()
export class ModelsInfoService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ModelQueryDto) {
    return this.prisma.modelInfo.findMany({
      where: {
        provider: query.provider,
        modelName: query.modelName,
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async upsert(dto: UpsertModelInfoDto) {
    const pricing = this.normalizeJson(dto.pricing);

    return this.prisma.modelInfo.upsert({
      where: {
        modelName_effectiveFrom: {
          modelName: dto.modelName,
          effectiveFrom: new Date(dto.effectiveFrom),
        },
      },
      create: {
        provider: dto.provider,
        modelName: dto.modelName,
        version: dto.version,
        pricing,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      },
      update: {
        provider: dto.provider,
        version: dto.version,
        pricing,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      },
    });
  }

  private normalizeJson(value: Record<string, unknown>): Prisma.InputJsonValue {
    const cloned = JSON.parse(JSON.stringify(value)) as unknown;

    if (!this.isJsonValue(cloned)) {
      throw new TypeError('Unsupported JSON value provided for pricing');
    }

    return cloned;
  }

  private isJsonValue(value: unknown): value is Prisma.InputJsonValue {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return true;
    }

    if (Array.isArray(value)) {
      return value.every((item) => this.isJsonValue(item));
    }

    if (typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).every((entry) =>
        this.isJsonValue(entry),
      );
    }

    return false;
  }
}
