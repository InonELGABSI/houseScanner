import {
  IsEmail,
  IsOptional,
  MinLength,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: 'newpassword123',
    description: 'New password (minimum 6 characters)',
    minLength: 6,
    required: false,
  })
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiProperty({
    example: 'John',
    description: 'Updated first name',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Updated last name',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}
