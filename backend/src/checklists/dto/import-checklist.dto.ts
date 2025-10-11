import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { ChecklistScopeDto } from './create-custom-item.dto';

export class ImportChecklistDto {
  @IsEnum(ChecklistScopeDto)
  scope!: ChecklistScopeDto;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsObject()
  itemsRaw!: Record<string, unknown>;
}
