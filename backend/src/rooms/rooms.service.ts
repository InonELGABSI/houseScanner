import { Injectable } from '@nestjs/common';
import { PrismaService } from '../infra/orm/prisma.service';
import { UpsertRoomsDto } from './dto/upsert-rooms.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByScan(scanId: string) {
    return this.prisma.room.findMany({
      where: { scanId },
      orderBy: { ordinal: 'asc' },
    });
  }

  async upsertRooms(dto: UpsertRoomsDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.room.deleteMany({ where: { scanId: dto.scanId } });
      await tx.room.createMany({
        data: dto.rooms.map((room) => ({
          scanId: dto.scanId,
          ordinal: room.ordinal,
          label: room.label,
          detectedRoomTypes: room.detectedRoomTypes,
        })),
        skipDuplicates: true,
      });
      return tx.room.findMany({
        where: { scanId: dto.scanId },
        orderBy: { ordinal: 'asc' },
      });
    });
  }
}
