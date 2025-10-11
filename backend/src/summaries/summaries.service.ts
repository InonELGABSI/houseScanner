import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infra/orm/prisma.service';
import { mergeAgentOutputs } from './mappers/merge-logic';
import { ScanSummaryResponseDto } from './dto/scan-summary-response.dto';
import { SubmitChecklistDto } from '../scans/dto/submit-checklist.dto';

type ScanWithRelations = Prisma.ScanGetPayload<{
  include: {
    house: true;
    rooms: {
      include: {
        images: true;
      };
      orderBy: {
        ordinal: 'asc';
      };
    };
    images: true;
    summary: true;
  };
}>;

interface SummaryJsonShape {
  overview?: {
    description?: string;
    highlights?: string[];
    recommendations?: string[];
  };
  rooms?: Array<{
    id: string;
    ordinal?: number;
    label?: string;
    detectedRoomTypes?: string[];
    products?: Array<{ name: string; detectedName?: string }>;
  }>;
  products?: unknown;
  checklist?: {
    decisions?: Array<{
      roomId: string;
      productName: string;
      shouldStay: boolean;
    }>;
    tests?: Array<{ name: string; passed: boolean }>;
  };
}

@Injectable()
export class SummariesService {
  constructor(private readonly prisma: PrismaService) {}

  async getByScan(
    userId: string,
    scanId: string,
  ): Promise<ScanSummaryResponseDto> {
    const scan = await this.loadScan(userId, scanId);
    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    const summaryRecord = await this.ensureSummaryRecord(scan);
    return this.mapToResponse(
      scan,
      summaryRecord.summaryJson as SummaryJsonShape,
    );
  }

  async saveChecklist(scanId: string, dto: SubmitChecklistDto) {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        house: true,
        rooms: {
          orderBy: { ordinal: 'asc' },
          include: { images: true },
        },
        images: true,
        summary: true,
      },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    const summaryRecord = await this.ensureSummaryRecord(scan);
    const summaryJson = (summaryRecord.summaryJson ?? {}) as SummaryJsonShape;

    summaryJson.checklist = {
      decisions: dto.decisions.map((decision) => ({
        roomId: decision.roomId,
        productName: decision.productName,
        shouldStay: decision.shouldStay,
      })),
      tests: (dto.tests ?? []).map((test) => ({
        name: test.name,
        passed: test.passed,
      })),
    };

    await this.prisma.houseScanSummary.update({
      where: { scanId },
      data: {
        summaryJson: structuredClone(summaryJson) as Prisma.JsonObject,
      },
    });
  }

  private async loadScan(
    userId: string,
    scanId: string,
  ): Promise<ScanWithRelations | null> {
    return this.prisma.scan.findFirst({
      where: {
        id: scanId,
        house: {
          userId,
        },
      },
      include: {
        house: true,
        rooms: {
          orderBy: { ordinal: 'asc' },
          include: { images: true },
        },
        images: {
          orderBy: { createdAt: 'asc' },
        },
        summary: true,
      },
    });
  }

  private async ensureSummaryRecord(scan: ScanWithRelations) {
    if (scan.summary) {
      return scan.summary;
    }

    const merged = mergeAgentOutputs({
      house: {
        address: scan.house?.address,
        houseType: scan.house?.houseType,
        detectedHouseTypes: scan.detectedHouseTypes,
      },
      rooms: scan.rooms.map((room) => ({
        id: room.id,
        ordinal: room.ordinal,
        label: room.label,
        detectedRoomTypes: room.detectedRoomTypes,
      })),
      products: [],
    });

    return this.prisma.houseScanSummary.create({
      data: {
        scanId: scan.id,
        summaryJson: structuredClone(merged.summary) as Prisma.JsonObject,
        prosConsJson: Prisma.JsonNull,
        costSummary: Prisma.JsonNull,
        schemaVersion: '1.0.0',
      },
    });
  }

  private mapToResponse(
    scan: ScanWithRelations,
    summaryJson: SummaryJsonShape,
  ): ScanSummaryResponseDto {
    const overviewDescription = summaryJson.overview?.description ?? undefined;
    const highlights = summaryJson.overview?.highlights ?? [];
    const recommendations = summaryJson.overview?.recommendations ?? [];
    const checklist = summaryJson.checklist ?? {
      decisions: [],
      tests: [],
    };

    const rooms = scan.rooms.map((room) => {
      const summaryRoom = summaryJson.rooms?.find(
        (item) => item.id === room.id,
      );
      const products = summaryRoom?.products ?? [];

      return {
        id: room.id,
        name: summaryRoom?.label ?? room.label ?? `Room ${room.ordinal + 1}`,
        types: summaryRoom?.detectedRoomTypes ?? room.detectedRoomTypes ?? [],
        images: room.images.map((image) => ({
          id: image.id,
          url: image.url,
          tag: image.tag ?? undefined,
        })),
        products: products.map((product) => ({
          name: product.name ?? product.detectedName ?? 'Item',
          shouldStay:
            checklist.decisions?.find(
              (decision) =>
                decision.roomId === room.id &&
                decision.productName ===
                  (product.name ?? product.detectedName ?? 'Item'),
            )?.shouldStay ?? undefined,
        })),
      };
    });

    const gallery = Array.from(new Set(scan.images.map((image) => image.url)));

    const totalProducts = rooms.reduce(
      (acc, room) => acc + room.products.length,
      0,
    );

    return {
      id: scan.id,
      address: scan.house?.address ?? undefined,
      createdAt: scan.createdAt.toISOString(),
      status: scan.status,
      overview: overviewDescription,
      highlights,
      recommendations,
      gallery,
      totalRooms: rooms.length,
      totalProducts,
      rooms,
      decisions: checklist.decisions ?? [],
      tests: checklist.tests ?? [],
    };
  }
}
