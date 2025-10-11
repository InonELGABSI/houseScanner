import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateScanDto {
  @IsOptional()
  @IsUUID('4')
  houseId?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
