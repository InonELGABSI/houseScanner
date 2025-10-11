import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class RoomDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsInt()
  @Min(1)
  ordinal!: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  detectedRoomTypes?: string[];
}

export class UpsertRoomsDto {
  @IsUUID('4')
  scanId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomDto)
  rooms!: RoomDto[];
}
