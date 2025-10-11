import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../infra/orm/prisma.service';
import { CryptoUtil } from '../common/utils/crypto.util';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoUtil: CryptoUtil,
  ) {}

  // Admin only - get all users
  async findAll(requestingUserRole: string) {
    if (requestingUserRole !== UserRole.admin) {
      throw new ForbiddenException('Only admins can view all users');
    }

    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            houses: true,
            customChecklists: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Admin only - create user
  async create(dto: CreateUserDto, requestingUserRole: string) {
    if (requestingUserRole !== UserRole.admin) {
      throw new ForbiddenException('Only admins can create users');
    }

    const passwordHash = await this.cryptoUtil.hashPassword(dto.password);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role || UserRole.user,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Get current user profile with all related data
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        houses: {
          select: {
            id: true,
            address: true,
            houseType: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: { scans: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
        customChecklists: {
          select: {
            id: true,
            scope: true,
            name: true,
            version: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // Get user's checklists
  async getMyChecklists(userId: string) {
    return this.prisma.checklist.findMany({
      where: {
        userId,
        isBase: false,
      },
      select: {
        id: true,
        scope: true,
        name: true,
        version: true,
        itemsRaw: true,
        createdAt: true,
      },
      orderBy: [{ scope: 'asc' }, { name: 'asc' }, { version: 'desc' }],
    });
  }

  // Get user's scan history with full details
  async getMyScanHistory(userId: string) {
    const scans = await this.prisma.scan.findMany({
      where: {
        house: { userId },
      },
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
            houseType: true,
          },
        },
        rooms: {
          select: {
            id: true,
            ordinal: true,
            label: true,
            detectedRoomTypes: true,
            images: {
              select: {
                id: true,
                url: true,
                tag: true,
                createdAt: true,
              },
            },
          },
          orderBy: { ordinal: 'asc' },
        },
        images: {
          select: {
            id: true,
            url: true,
            tag: true,
            createdAt: true,
          },
        },
        summary: {
          select: {
            id: true,
            summaryJson: true,
            prosConsJson: true,
            costSummary: true,
            derivedAt: true,
          },
        },
        agentRuns: {
          select: {
            id: true,
            agentName: true,
            tokensIn: true,
            tokensOut: true,
            costUsd: true,
            startedAt: true,
            finishedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return scans;
  }

  // Get specific user (admin only)
  async findOne(id: string, requestingUserRole: string) {
    if (requestingUserRole !== UserRole.admin) {
      throw new ForbiddenException('Only admins can view user details');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        houses: {
          select: {
            id: true,
            address: true,
            houseType: true,
            status: true,
            createdAt: true,
            _count: { select: { scans: true } },
          },
        },
        customChecklists: {
          select: {
            id: true,
            scope: true,
            name: true,
            version: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // Update current user
  async updateMe(userId: string, dto: UpdateUserDto) {
    const data: Record<string, unknown> = {};
    if (dto.email) {
      data.email = dto.email;
    }
    if (dto.password) {
      data.passwordHash = await this.cryptoUtil.hashPassword(dto.password);
    }
    if (dto.firstName !== undefined) {
      data.firstName = dto.firstName;
    }
    if (dto.lastName !== undefined) {
      data.lastName = dto.lastName;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  // Update user (admin only)
  async update(id: string, dto: UpdateUserDto, requestingUserRole: string) {
    if (requestingUserRole !== UserRole.admin) {
      throw new ForbiddenException('Only admins can update users');
    }

    const data: Record<string, unknown> = {};
    if (dto.email) {
      data.email = dto.email;
    }
    if (dto.password) {
      data.passwordHash = await this.cryptoUtil.hashPassword(dto.password);
    }
    if (dto.firstName !== undefined) {
      data.firstName = dto.firstName;
    }
    if (dto.lastName !== undefined) {
      data.lastName = dto.lastName;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  // Delete user (admin only)
  async remove(id: string, requestingUserRole: string) {
    if (requestingUserRole !== UserRole.admin) {
      throw new ForbiddenException('Only admins can delete users');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }
}
