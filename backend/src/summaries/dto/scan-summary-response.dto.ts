import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class SummaryRoomImageDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  url!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tag?: string;
}

export class SummaryRoomProductDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  shouldStay?: boolean;
}

export class SummaryRoomDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ type: () => [String] })
  @IsArray()
  types!: string[];

  @ApiProperty({ type: () => [SummaryRoomImageDto] })
  @IsArray()
  images!: SummaryRoomImageDto[];

  @ApiProperty({ type: () => [SummaryRoomProductDto] })
  @IsArray()
  products!: SummaryRoomProductDto[];
}

export class SummaryDecisionDto {
  @ApiProperty()
  @IsString()
  roomId!: string;

  @ApiProperty()
  @IsString()
  productName!: string;

  @ApiProperty()
  @IsBoolean()
  shouldStay!: boolean;
}

export class SummaryTestDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsBoolean()
  passed!: boolean;
}

export class ScanSummaryResponseDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty()
  @IsDateString()
  createdAt!: string;

  @ApiProperty()
  @IsString()
  status!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  overview?: string;

  @ApiProperty({ type: () => [String] })
  @IsArray()
  highlights!: string[];

  @ApiProperty({ type: () => [String] })
  @IsArray()
  recommendations!: string[];

  @ApiProperty({ type: () => [String] })
  @IsArray()
  gallery!: string[];

  @ApiProperty()
  @IsNumber()
  totalRooms!: number;

  @ApiProperty()
  @IsNumber()
  totalProducts!: number;

  @ApiProperty({ type: () => [SummaryRoomDto] })
  @IsArray()
  rooms!: SummaryRoomDto[];

  @ApiProperty({ type: () => [SummaryDecisionDto] })
  @IsArray()
  decisions!: SummaryDecisionDto[];

  @ApiProperty({ type: () => [SummaryTestDto] })
  @IsArray()
  tests!: SummaryTestDto[];
}
