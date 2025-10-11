import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum HouseStatus {
  IDLE = 'idle',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export class CreateHouseDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  houseType?: string;

  @IsOptional()
  @IsEnum(HouseStatus)
  status?: HouseStatus;
}
