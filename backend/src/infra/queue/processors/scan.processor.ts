import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { PythonAgentsClient } from '../../http/python-agents.client';
import { PrismaService } from '../../orm/prisma.service';
import { SCAN_QUEUE } from '../queues';
import { ScansGateway } from '../../../scans/scans.gateway';

export interface RoomDataPayload {
  room_id: string;
  image_urls: string[];
}

export interface ScanJobPayload {
  scanId: string;
  houseId: string;
  userId: string;
  rooms: RoomDataPayload[];
  house_checklist: Record<string, unknown>;
  rooms_checklist: Record<string, unknown>;
  products_checklist: Record<string, unknown>;
  inputsSnapshot?: Record<string, unknown>;
}

@Injectable()
@Processor(SCAN_QUEUE)
export class ScanProcessor extends WorkerHost {
  private readonly logger = new Logger(ScanProcessor.name);

  constructor(
    private readonly pythonAgentsClient: PythonAgentsClient,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ScansGateway))
    private readonly scansGateway: ScansGateway,
  ) {
    super();
  }

  async process(job: Job<ScanJobPayload>): Promise<void> {
    const { scanId, userId } = job.data;

    try {
      this.logger.log(`Processing scan job ${job.id} for scan ${scanId}`);

      await job.updateProgress(10);
      this.scansGateway?.emitProgress?.(userId, {
        scanId,
        progress: 10,
        stage: 'Preparing request',
      });

      // Prepare request for agents-service /v1/scan/run endpoint
      const agentsRequest = {
        rooms: job.data.rooms,
        house_checklist: job.data.house_checklist,
        rooms_checklist: job.data.rooms_checklist,
        products_checklist: job.data.products_checklist,
      };

      this.logger.log(
        `Sending scan request to agents-service: ${job.data.rooms.length} rooms, ${job.data.rooms.reduce((sum, r) => sum + r.image_urls.length, 0)} images`,
      );

      this.logger.debug(
        `Agents-service request payload for scan ${scanId}: ${JSON.stringify(agentsRequest, null, 2)}`,
      );

      await job.updateProgress(20);
      this.scansGateway?.emitProgress?.(userId, {
        scanId,
        progress: 20,
        stage: 'Analyzing images',
      });

      // Call agents-service
      const response = await this.pythonAgentsClient.request({
        method: 'POST',
        url: '/v1/scan/run',
        data: agentsRequest,
      });

      this.logger.log(`Agents-service completed scan ${scanId}`);
      this.logger.debug(
        `Raw agents-service response for scan ${scanId}: ${JSON.stringify(response, null, 2)}`,
      );

      await job.updateProgress(90);
      this.scansGateway?.emitProgress?.(userId, {
        scanId,
        progress: 90,
        stage: 'Saving results',
      });

      // Store the response in the database
      await this.saveScanResults(scanId, job.data.houseId, response);

      await job.updateProgress(100);
      this.scansGateway?.emitProgress?.(userId, {
        scanId,
        progress: 100,
        stage: 'Complete',
      });

      // Emit completion event with full results
      this.scansGateway?.emitCompleted?.(userId, {
        scanId,
        message: 'Scan completed successfully',
        result: response, // Include full agents-service response
      });

      this.logger.log(`Successfully processed scan ${scanId}`);
    } catch (error) {
      this.logger.error(`Failed to process scan ${scanId}`, error);

      // Emit failure event
      this.scansGateway?.emitFailed?.(userId, {
        scanId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Save scan results from agents-service to database
   */
  private async saveScanResults(
    scanId: string,
    houseId: string,
    agentsResponse: any,
  ): Promise<void> {
    try {
      this.logger.log(`Saving results for scan ${scanId}`);

      // Extract data from agents-service response
      const result = agentsResponse.result || {};
      const clientSummary = agentsResponse.client_summary || {};
      const costInfo = agentsResponse.cost_info || {};
      const agentExecutions = agentsResponse.agent_executions || [];
      const metadata = agentsResponse.metadata || {};

      // Start a transaction to save all related data
      await this.prisma.$transaction(async (tx) => {
        // 1. Update House with detected types
        if (result.house_types && result.house_types.length > 0) {
          await tx.house.update({
            where: { id: houseId },
            data: {
              houseType: result.house_types[0], // Primary house type
            },
          });
          this.logger.debug(
            `Updated house ${houseId} with type: ${result.house_types[0]}`,
          );
        }

        // 2. Update Rooms with detected types
        if (result.rooms && Array.isArray(result.rooms)) {
          for (const roomData of result.rooms) {
            if (roomData.room_id && roomData.room_types) {
              await tx.room.update({
                where: { id: roomData.room_id },
                data: {
                  detectedRoomTypes: roomData.room_types,
                },
              });
              this.logger.debug(
                `Updated room ${roomData.room_id} with types: ${roomData.room_types.join(', ')}`,
              );
            }
          }
        }

        // 3. Update Scan status and metadata
        await tx.scan.update({
          where: { id: scanId },
          data: {
            status: 'succeeded',
            finishedAt: new Date(),
            detectedHouseTypes: result.house_types || [],
          },
        });
        this.logger.debug(`Updated scan ${scanId} status to succeeded`);

        // 4. Save AgentsRun records with full input/output data
        if (agentExecutions && agentExecutions.length > 0) {
          const agentsDetailed = costInfo.agents_detailed || {};
          const totalCostUsd = costInfo.costs?.total_estimated_usd || 0;
          const totalTokens = costInfo.tokens?.total_tokens || 1;

          this.logger.log(
            `Saving ${agentExecutions.length} agent execution records for scan ${scanId}`,
          );

          for (const execution of agentExecutions) {
            const agentName = execution.agent_name;

            // Get token details for this agent
            const agentDetailed = agentsDetailed[agentName] || {};
            const promptTokens = agentDetailed.prompt_tokens || 0;
            const completionTokens = agentDetailed.completion_tokens || 0;
            const agentTotalTokens = agentDetailed.total_tokens || 0;

            // Calculate per-agent cost as proportional to their token usage
            const agentCostRatio = agentTotalTokens / totalTokens;
            const agentCostUsd = totalCostUsd * agentCostRatio;

            // Use the raw input/output data from execution tracker
            const inputJson = execution.input_data;
            const outputJson = execution.output_data;

            await tx.agentsRun.create({
              data: {
                scanId,
                agentName: agentName,
                tokensIn: promptTokens,
                tokensOut: completionTokens,
                costUsd: agentCostUsd,
                inputJson: inputJson, 
                outputJson: outputJson,
                startedAt: execution.timestamp
                  ? new Date(execution.timestamp)
                  : new Date(),
                finishedAt: new Date(),
              },
            });
          }

          this.logger.log(
            `Created ${agentExecutions.length} agent run records for scan ${scanId} (total cost: $${totalCostUsd.toFixed(4)})`,
          );
        }

        // 5. Create or update HouseScanSummary
        await tx.houseScanSummary.upsert({
          where: { scanId },
          create: {
            scanId,
            summaryJson: clientSummary,
            prosConsJson: result.pros_cons || {},
            costSummary: costInfo,
            schemaVersion: metadata.pipeline_version || '2.0.0',
          },
          update: {
            summaryJson: clientSummary,
            prosConsJson: result.pros_cons || {},
            costSummary: costInfo,
            schemaVersion: metadata.pipeline_version || '2.0.0',
          },
        });
        this.logger.debug(`Created/updated summary for scan ${scanId}`);
      });

      this.logger.log(
        `Successfully saved all results for scan ${scanId} to database`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save scan results for ${scanId}`,
        error.stack,
      );
    }
  }
}
