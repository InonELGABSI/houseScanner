import { IsOptional, IsString, IsNumber, IsObject } from 'class-validator';

export class UpdateChecklistDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  version?: number;

  @IsOptional()
  @IsObject()
  itemsRaw?: Record<string, unknown>;
}
