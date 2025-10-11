import {
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpsertModelInfoDto {
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @IsString()
  @IsNotEmpty()
  modelName!: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsObject()
  pricing!: Record<string, unknown>;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
