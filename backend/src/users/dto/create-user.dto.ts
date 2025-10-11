import {
  IsEmail,
  IsOptional,
  MinLength,
  IsEnum,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'John',
    description: 'User first name',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiProperty({
    example: 'Doe',
    description: 'User last name',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({
    example: 'password123',
    description: 'User password (minimum 6 characters)',
    minLength: 6,
  })
  @MinLength(6)
  password: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.user,
    description: 'User role',
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
