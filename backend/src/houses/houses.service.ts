import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../infra/orm/prisma.service';
import { CreateHouseDto } from './dto/create-house.dto';
import { UpdateHouseDto } from './dto/update-house.dto';

@Injectable()
export class HousesService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateHouseDto) {
    return this.prisma.house.create({
      data: {
        userId,
        address: dto.address,
        houseType: dto.houseType,
        status: dto.status ?? 'idle',
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.house.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const house = await this.prisma.house.findFirst({
      where: { id, userId },
    });
    if (!house) {
      throw new NotFoundException('House not found');
    }
    return house;
  }

  async update(userId: string, id: string, dto: UpdateHouseDto) {
    await this.ensureOwnership(userId, id);
    return this.prisma.house.update({
      where: { id },
      data: {
        address: dto.address,
        houseType: dto.houseType,
        status: dto.status,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.ensureOwnership(userId, id);
    await this.prisma.house.delete({ where: { id } });
    return { success: true };
  }

  private async ensureOwnership(userId: string, id: string) {
    const exists = await this.prisma.house.findFirst({ where: { id, userId } });
    if (!exists) {
      throw new NotFoundException('House not found');
    }
  }
}
