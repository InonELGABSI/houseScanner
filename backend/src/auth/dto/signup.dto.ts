import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({
    example: 'John',
    description: 'User first name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({
    example: 'Doe',
    description: 'User last name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'User password (minimum 6 characters)',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}
