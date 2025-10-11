import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ListAgentRunsDto {
  @IsUUID('4')
  scanId!: string;

  @IsOptional()
  @IsString()
  agentName?: string;
}
