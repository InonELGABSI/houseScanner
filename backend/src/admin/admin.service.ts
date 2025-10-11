import { Injectable } from '@nestjs/common';
import { PrismaService } from '../infra/orm/prisma.service';
import { ChecklistsService } from '../checklists/checklists.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checklistsService: ChecklistsService,
  ) {}

  // Dashboard stats
  async getDashboardStats() {
    const [usersCount, housesCount, scansCount, checklistsCount] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.house.count(),
        this.prisma.scan.count(),
        this.prisma.checklist.count({ where: { isBase: true } }),
      ]);

    return {
      users: usersCount,
      houses: housesCount,
      scans: scansCount,
      baseChecklists: checklistsCount,
    };
  }

  // Get all houses with scan counts
  async getAllHouses() {
    return this.prisma.house.findMany({
      select: {
        id: true,
        address: true,
        houseType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        _count: {
          select: { scans: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get all scans with details
  async getAllScans() {
    return this.prisma.scan.findMany({
      select: {
        id: true,
        status: true,
        detectedHouseTypes: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
        house: {
          select: {
            id: true,
            address: true,
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            rooms: true,
            images: true,
            agentRuns: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get all agent runs with costs
  async getAllAgentRuns() {
    return this.prisma.agentsRun.findMany({
      select: {
        id: true,
        agentName: true,
        tokensIn: true,
        tokensOut: true,
        costUsd: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
        scan: {
          select: {
            id: true,
            house: {
              select: {
                address: true,
                user: {
                  select: {
                    email: true,
                  },
                },
              },
            },
          },
        },
        model: {
          select: {
            modelName: true,
            provider: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get all model info
  async getAllModels() {
    return this.prisma.modelInfo.findMany({
      select: {
        id: true,
        provider: true,
        modelName: true,
        version: true,
        pricing: true,
        effectiveFrom: true,
        effectiveTo: true,
        createdAt: true,
        _count: {
          select: { agentRuns: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get all base checklists
  async getAllBaseChecklists() {
    return this.prisma.checklist.findMany({
      where: { isBase: true },
      select: {
        id: true,
        scope: true,
        name: true,
        version: true,
        itemsRaw: true,
        createdAt: true,
      },
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
    });
  }

  // Toggle base checklist
  toggleChecklist(checklistId: string, enable: boolean) {
    return this.checklistsService.setBaseEnabled(checklistId, enable);
  }

  // Update base checklist
  async updateBaseChecklist(
    checklistId: string,
    data: { name?: string; itemsRaw?: any },
  ) {
    return this.prisma.checklist.update({
      where: { id: checklistId, isBase: true },
      data,
      select: {
        id: true,
        scope: true,
        name: true,
        version: true,
        itemsRaw: true,
        createdAt: true,
      },
    });
  }
}
