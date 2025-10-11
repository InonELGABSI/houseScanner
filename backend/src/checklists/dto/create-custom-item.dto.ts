import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export enum ChecklistScopeDto {
  HOUSE = 'house',
  ROOM = 'room',
  PRODUCT = 'product',
}

export class CreateCustomItemDto {
  @IsEnum(ChecklistScopeDto)
  scope!: ChecklistScopeDto;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsObject()
  itemsRaw!: Record<string, unknown>;
}
