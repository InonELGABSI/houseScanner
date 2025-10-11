import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../infra/orm/prisma.service';
import { JwtConfig } from '../config';
import { CryptoUtil } from '../common/utils/crypto.util';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cryptoUtil: CryptoUtil,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password and create user
    const passwordHash = await this.cryptoUtil.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: UserRole.user, // Default role for signup
      },
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await this.cryptoUtil.verifyPassword(
      dto.password,
      user.passwordHash,
    );
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        role: string;
      }>(refreshToken, {
        secret: this.getJwtConfig().secret,
      });
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: payload.sub },
      });
      return this.buildAuthResponse(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async createTokens(
    userId: string,
    role: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const config = this.getJwtConfig();
    const payload = { sub: userId, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: config.accessTokenTtl,
        issuer: config.issuer,
        audience: config.audience,
        secret: config.secret,
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: config.refreshTokenTtl,
        issuer: config.issuer,
        audience: config.audience,
        secret: config.secret,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private getJwtConfig(): JwtConfig {
    return this.configService.getOrThrow<JwtConfig>('jwt');
  }

  private async buildAuthResponse(user: User): Promise<AuthResponse> {
    const tokens = await this.createTokens(user.id, user.role);
    return {
      ...tokens,
      user: this.toAuthUser(user),
    };
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
