import { IsBoolean, IsUUID } from 'class-validator';

export class EnableBaseChecklistDto {
  @IsUUID('4')
  checklistId!: string;

  @IsBoolean()
  enable!: boolean;
}
