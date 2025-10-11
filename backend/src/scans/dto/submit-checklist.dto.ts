import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ChecklistDecisionDto {
  @IsUUID('4')
  roomId!: string;

  @IsString()
  productName!: string;

  @IsBoolean()
  shouldStay!: boolean;
}

export class ChecklistTestDto {
  @IsString()
  name!: string;

  @IsBoolean()
  passed!: boolean;
}

export class SubmitChecklistDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ChecklistDecisionDto)
  decisions!: ChecklistDecisionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistTestDto)
  tests?: ChecklistTestDto[];
}
