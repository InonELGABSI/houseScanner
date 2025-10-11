import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChecklistScope, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../infra/orm/prisma.service';
import {
  ChecklistScopeDto,
  CreateCustomItemDto,
} from './dto/create-custom-item.dto';
import { UpdateCustomItemDto } from './dto/update-custom-item.dto';

type ChecklistUpdatePayload = {
  name?: string;
  version?: number;
  itemsRaw?: Record<string, unknown>;
};

@Injectable()
export class ChecklistsService {
  constructor(private readonly prisma: PrismaService) {}

  listBase(scope?: ChecklistScope) {
    return this.prisma.checklist.findMany({
      where: {
        isBase: true,
        scope,
      },
      orderBy: [{ scope: 'asc' }, { name: 'asc' }, { version: 'desc' }],
    });
  }

  listCustom(userId: string, scope?: ChecklistScope) {
    return this.prisma.checklist.findMany({
      where: {
        userId,
        scope,
        isBase: false,
      },
      orderBy: [{ name: 'asc' }, { version: 'desc' }],
    });
  }

  async createCustom(userId: string, dto: CreateCustomItemDto) {
    return this.prisma.checklist.create({
      data: {
        scope: this.mapScope(dto.scope),
        name: dto.name,
        version: dto.version ? Number(dto.version) : 1,
        isBase: false,
        userId,
        itemsRaw: structuredClone(dto.itemsRaw) as Prisma.JsonObject,
      },
    });
  }

  async updateCustom(
    userId: string,
    checklistId: string,
    dto: UpdateCustomItemDto,
  ) {
    const checklist = await this.prisma.checklist.findFirst({
      where: { id: checklistId, userId, isBase: false },
    });
    if (!checklist) {
      throw new NotFoundException('Checklist not found');
    }

    return this.prisma.checklist.update({
      where: { id: checklistId },
      data: {
        name: dto.name,
        version: dto.version ? Number(dto.version) : undefined,
        itemsRaw: dto.itemsRaw
          ? (structuredClone(dto.itemsRaw) as Prisma.JsonObject)
          : undefined,
      },
    });
  }

  async updateChecklist(
    userId: string,
    checklistId: string,
    dto: ChecklistUpdatePayload,
  ) {
    const checklist = await this.prisma.checklist.findFirst({
      where: { id: checklistId, userId, isBase: false },
    });
    if (!checklist) {
      throw new NotFoundException('Checklist not found');
    }

    return this.prisma.checklist.update({
      where: { id: checklistId },
      data: {
        name: dto.name,
        version: dto.version ? Number(dto.version) : undefined,
        itemsRaw: dto.itemsRaw
          ? (structuredClone(dto.itemsRaw) as Prisma.JsonObject)
          : undefined,
      },
    });
  }

  async deleteCustom(userId: string, checklistId: string) {
    const checklist = await this.prisma.checklist.findFirst({
      where: { id: checklistId, userId, isBase: false },
    });
    if (!checklist) {
      throw new NotFoundException('Checklist not found');
    }

    await this.prisma.checklist.delete({ where: { id: checklistId } });
    return { success: true };
  }

  async upsertByScope(
    userId: string,
    scope: string,
    dto: ChecklistUpdatePayload,
  ) {
    const checklistScope = scope as ChecklistScope;

    // Find existing checklist for this user and scope
    const existing = await this.prisma.checklist.findFirst({
      where: { userId, scope: checklistScope, isBase: false },
    });

    if (existing) {
      // Update existing checklist
      return this.prisma.checklist.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          version: dto.version ? Number(dto.version) : undefined,
          itemsRaw: dto.itemsRaw
            ? (structuredClone(dto.itemsRaw) as Prisma.JsonObject)
            : undefined,
        },
      });
    } else {
      // Create new checklist
      return this.prisma.checklist.create({
        data: {
          scope: checklistScope,
          name: dto.name || `Custom ${scope} checklist`,
          version: dto.version ? Number(dto.version) : 1,
          isBase: false,
          userId,
          itemsRaw: dto.itemsRaw
            ? (structuredClone(dto.itemsRaw) as Prisma.JsonObject)
            : ({} as Prisma.JsonObject),
        },
      });
    }
  }

  async getBaseChecklist(scope: string) {
    const checklistScope = scope as ChecklistScope;
    const checklist = await this.prisma.checklist.findFirst({
      where: { scope: checklistScope, isBase: true },
      orderBy: { version: 'desc' },
    });
    return checklist;
  }

  async updateBaseChecklist(
    userId: string,
    scope: string,
    dto: ChecklistUpdatePayload,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== UserRole.admin) {
      throw new ForbiddenException('Only admins can update base checklists');
    }

    const checklistScope = scope as ChecklistScope;
    const existing = await this.prisma.checklist.findFirst({
      where: { scope: checklistScope, isBase: true },
    });

    if (existing) {
      return this.prisma.checklist.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          version: dto.version ? Number(dto.version) : undefined,
          itemsRaw: dto.itemsRaw
            ? (structuredClone(dto.itemsRaw) as Prisma.JsonObject)
            : undefined,
        },
      });
    } else {
      return this.prisma.checklist.create({
        data: {
          scope: checklistScope,
          name: dto.name || `Base ${scope} checklist`,
          version: dto.version ? Number(dto.version) : 1,
          isBase: true,
          itemsRaw: dto.itemsRaw
            ? (structuredClone(dto.itemsRaw) as Prisma.JsonObject)
            : ({} as Prisma.JsonObject),
        },
      });
    }
  }

  async setBaseEnabled(checklistId: string, enable: boolean) {
    const checklist = await this.prisma.checklist.findUnique({
      where: { id: checklistId },
    });
    if (!checklist) {
      throw new NotFoundException('Checklist not found');
    }

    return this.prisma.checklist.update({
      where: { id: checklistId },
      data: { isBase: enable },
    });
  }

  private mapScope(scope: ChecklistScopeDto): ChecklistScope {
    switch (scope) {
      case ChecklistScopeDto.HOUSE:
        return 'house';
      case ChecklistScopeDto.ROOM:
        return 'room';
      case ChecklistScopeDto.PRODUCT:
        return 'product';
      default:
        return 'house';
    }
  }
}
