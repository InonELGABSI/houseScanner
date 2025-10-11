import { IsOptional, IsString } from 'class-validator';

export class ModelQueryDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  modelName?: string;
}
