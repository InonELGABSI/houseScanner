import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum ScanStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

export class ScanQueryDto {
  @IsOptional()
  @IsUUID('4')
  houseId?: string;

  @IsOptional()
  @IsEnum(ScanStatus)
  status?: ScanStatus;
}
