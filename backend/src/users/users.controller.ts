import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

interface RequestUser {
  userId: string;
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  getMe(@CurrentUser() user: RequestUser) {
    return this.usersService.getMe(user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user.userId, dto);
  }

  @Get('me/scans')
  @ApiOperation({ summary: 'Get current user scan history' })
  @ApiResponse({ status: 200, description: 'User scan history' })
  getMyScanHistory(@CurrentUser() user: RequestUser) {
    return this.usersService.getMyScanHistory(user.userId);
  }

  @Get('me/checklists')
  @ApiOperation({ summary: 'List user checklists' })
  @ApiResponse({
    status: 200,
    description: 'User checklists (house, room, product)',
  })
  getMyChecklists(@CurrentUser() user: RequestUser) {
    return this.usersService.getMyChecklists(user.userId);
  }
}
