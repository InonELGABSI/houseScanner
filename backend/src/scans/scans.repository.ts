import { Injectable } from '@nestjs/common';
import { Prisma, ScanStatus } from '@prisma/client';
import { PrismaService } from '../infra/orm/prisma.service';

interface ListScansParams {
  userId: string;
  houseId?: string;
  status?: ScanStatus;
}

interface CreateScanParams {
  houseId: string;
  inputsSnapshot: Prisma.JsonObject;
  detectedHouseTypes?: string[];
}

interface CreateImagesParams {
  scanId: string;
  images: Array<{
    roomId?: string;
    url: string;
    tag?: string;
  }>;
}

@Injectable()
export class ScansRepository {
  constructor(private readonly prisma: PrismaService) {}

  createScan(params: CreateScanParams) {
    return this.prisma.scan.create({
      data: {
        houseId: params.houseId,
        status: 'queued',
        inputsSnapshot: params.inputsSnapshot,
        detectedHouseTypes: params.detectedHouseTypes,
      },
    });
  }

  listScans(params: ListScansParams) {
    return this.prisma.scan.findMany({
      where: {
        house: {
          userId: params.userId,
        },
        houseId: params.houseId,
        status: params.status,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string, userId: string) {
    return this.prisma.scan.findFirst({
      where: {
        id,
        house: {
          userId,
        },
      },
      include: {
        rooms: {
          orderBy: { ordinal: 'asc' },
          include: {
            images: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        images: {
          orderBy: { createdAt: 'asc' },
        },
        house: true,
        agentRuns: true,
        summary: true,
      },
    });
  }

  async createImages(params: CreateImagesParams) {
    if (!params.images.length) {
      return;
    }

    await this.prisma.houseRoomImage.createMany({
      data: params.images.map((image) => ({
        scanId: params.scanId,
        roomId: image.roomId,
        url: image.url,
        tag: image.tag,
      })),
    });
  }

  updateStatus(
    scanId: string,
    status: ScanStatus,
    timestamps?: { startedAt?: Date; finishedAt?: Date },
  ) {
    return this.prisma.scan.update({
      where: { id: scanId },
      data: {
        status,
        startedAt: timestamps?.startedAt,
        finishedAt: timestamps?.finishedAt,
      },
    });
  }
}
