import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../infra/orm/prisma.module';
import { CryptoUtil } from '../common/utils/crypto.util';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtConfig } from '../config';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const { secret, issuer, audience } =
          configService.getOrThrow<JwtConfig>('jwt');
        return {
          secret,
          signOptions: {
            issuer,
            audience,
          },
        };
      },
    }),
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, CryptoUtil],
  exports: [AuthService],
})
export class AuthModule {}
