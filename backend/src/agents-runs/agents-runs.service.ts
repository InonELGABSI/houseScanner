import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../infra/orm/prisma.service';
import { ListAgentRunsDto } from './dto/list-agent-runs.dto';

@Injectable()
export class AgentsRunsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, dto: ListAgentRunsDto) {
    const scan = await this.prisma.scan.findFirst({
      where: {
        id: dto.scanId,
        house: {
          userId,
        },
      },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    return this.prisma.agentsRun.findMany({
      where: {
        scanId: dto.scanId,
        agentName: dto.agentName,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
