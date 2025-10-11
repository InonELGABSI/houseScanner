import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class RoomImageDto {
  @IsOptional()
  @IsString()
  roomId?: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  tag?: string;
}

export class RequestScanDto {
  @IsUUID('4')
  houseId!: string;

  @IsObject()
  @IsNotEmpty()
  inputsSnapshot!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  detectedHouseTypes?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomImageDto)
  images?: RoomImageDto[];
}
