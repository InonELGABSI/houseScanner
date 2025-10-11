import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Public()
  @ApiOperation({ summary: 'User registration' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'User successfully logged in' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token successfully refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }
}
