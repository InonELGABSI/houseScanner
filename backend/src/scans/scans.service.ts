import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { Prisma, ScanStatus } from '@prisma/client';
import { PrismaService } from '../infra/orm/prisma.service';
import { StorageService } from '../infra/storage/storage.service';
import { SCAN_QUEUE } from '../infra/queue/queues';
import { ScanJobPayload } from '../infra/queue/processors/scan.processor';
import { RoomsService } from '../rooms/rooms.service';
import { SummariesService } from '../summaries/summaries.service';
import { ChecklistMergeService } from '../checklists/checklist-merge.service';
import { ScanQueryDto } from './dto/scan-query.dto';
import { ScansRepository } from './scans.repository';
import { SubmitChecklistDto } from './dto/submit-checklist.dto';
import { ProcessScanDto } from './dto/process-scan.dto';
import { ScansGateway } from './scans.gateway';

@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly scansRepository: ScansRepository,
    private readonly roomsService: RoomsService,
    private readonly summariesService: SummariesService,
    private readonly checklistMergeService: ChecklistMergeService,
    private readonly scansGateway: ScansGateway,
    @InjectQueue(SCAN_QUEUE) private readonly scanQueue: Queue<ScanJobPayload>,
  ) {}

  /**
   * Create a new scan record
   * Automatically creates a house if houseId is not provided
   */
  async createScan(
    userId: string,
    dto: { houseId?: string; address?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      let houseId = dto.houseId;

      // If no houseId provided, create a new house automatically
      if (!houseId) {
        const house = await tx.house.create({
          data: {
            userId,
            address: dto.address,
            status: 'active',
          },
        });
        houseId = house.id;
      } else {
        // Verify ownership if houseId is provided
        const house = await tx.house.findFirst({
          where: { id: houseId, userId },
        });
        if (!house) {
          throw new NotFoundException('House not found');
        }

        // Update house address if provided
        if (dto.address) {
          await tx.house.update({
            where: { id: houseId },
            data: { address: dto.address },
          });
        }
      }

      // Create scan with queued status (ready for upload)
      const scan = await tx.scan.create({
        data: {
          houseId,
          status: 'queued',
          inputsSnapshot: {} as Prisma.InputJsonValue,
        },
      });

      return { scanId: scan.id, houseId, status: scan.status };
    });
  }

  list(userId: string, query: ScanQueryDto) {
    return this.scansRepository.listScans({
      userId,
      houseId: query.houseId,
      status: query.status as ScanStatus | undefined,
    });
  }

  async findOne(userId: string, scanId: string) {
    const scan = await this.scansRepository.findById(scanId, userId);
    if (!scan) {
      throw new NotFoundException('Scan not found');
    }
    return scan;
  }

  async getRooms(scanId: string) {
    return this.roomsService.findByScan(scanId);
  }

  async submitChecklist(
    userId: string,
    scanId: string,
    dto: SubmitChecklistDto,
  ) {
    await this.ensureScanOwnership(userId, scanId);
    await this.summariesService.saveChecklist(scanId, dto);
    return this.summariesService.getByScan(userId, scanId);
  }

  private async ensureHouseOwnership(userId: string, houseId: string) {
    const house = await this.prisma.house.findFirst({
      where: { id: houseId, userId },
    });
    if (!house) {
      throw new NotFoundException('House not found');
    }
  }

  private async ensureScanOwnership(userId: string, scanId: string) {
    const scan = await this.prisma.scan.findFirst({
      where: {
        id: scanId,
        house: {
          userId,
        },
      },
    });
    if (!scan) {
      throw new NotFoundException('Scan not found');
    }
  }

  /**
   * Upload image files to MinIO/S3 and save URLs to database
   * Creates House (if needed), Scan, Rooms, and HouseRoomImage records
   * Room labels are auto-generated (Room 1, Room 2, etc.) - room types discovered by agents
   * Emits 'scan:uploaded' event when complete
   */
  async uploadImages(
    userId: string,
    scanId: string,
    files: Array<{
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    }>,
    dto: { address?: string; rooms?: Array<{ imageIndices: string[] }> },
  ) {
    const { address, rooms: roomsData } = dto;
    if (!files || files.length === 0) {
      throw new BadRequestException('No images provided');
    }

    // Verify scan ownership
    const scan = await this.prisma.scan.findFirst({
      where: {
        id: scanId,
        house: { userId },
      },
      include: {
        house: true,
      },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    // Don't allow upload if already processing or completed
    if (scan.status === 'running' || scan.status === 'succeeded') {
      throw new BadRequestException(
        'Cannot upload images to a scan that is already processing or completed',
      );
    }

    // Capture existing assets so we can overwrite on re-upload
    const previousImages = await this.prisma.houseRoomImage.findMany({
      where: { scanId },
      select: { url: true },
    });

    // Upload files to MinIO/S3 storage
    const imageUrls = await this.uploadFilesToStorage(files, scanId);

    // Save image URLs to database with proper room structure
    return this.prisma.$transaction(async (tx) => {
      // Update house address if provided
      if (address) {
        await tx.house.update({
          where: { id: scan.houseId },
          data: { address },
        });
      }

      // Clean previous room/image artifacts so we replace existing data
      await tx.houseRoomImage.deleteMany({ where: { scanId: scan.id } });
      await tx.agentsRun.deleteMany({ where: { scanId: scan.id } });
      await tx.houseScanSummary.deleteMany({ where: { scanId: scan.id } });
      await tx.room.deleteMany({ where: { scanId: scan.id } });

      let roomsCount = 0;

      // If rooms data is provided, create rooms based on grouping
      if (roomsData && roomsData.length > 0) {
        for (let i = 0; i < roomsData.length; i++) {
          const roomData = roomsData[i];

          // Create room with generic label (room type will be detected by agents)
          const room = await tx.room.create({
            data: {
              scanId: scan.id,
              ordinal: i,
              label: `Room ${i + 1}`,
            },
          });

          // Map image indices to URLs and save images
          const roomImageUrls = roomData.imageIndices
            .map((idx) => {
              const index = parseInt(idx, 10);
              return imageUrls[index];
            })
            .filter(Boolean);

          await tx.houseRoomImage.createMany({
            data: roomImageUrls.map((url) => ({
              scanId: scan.id,
              roomId: room.id,
              url,
            })),
          });

          roomsCount++;
        }
      } else {
        // Default: Create a single room for all images
        const room = await tx.room.create({
          data: {
            scanId: scan.id,
            ordinal: 0,
            label: 'Room 1',
          },
        });

        await tx.houseRoomImage.createMany({
          data: imageUrls.map((url) => ({
            scanId: scan.id,
            roomId: room.id,
            url,
          })),
        });

        roomsCount = 1;
      }

      // Update scan status to queued (ready for processing)
      await tx.scan.update({
        where: { id: scan.id },
        data: {
          status: 'queued',
          detectedHouseTypes: [],
          startedAt: null,
          finishedAt: null,
          inputsSnapshot: Prisma.JsonNull,
        },
      });

      const result = {
        scanId: scan.id,
        roomsCount,
        imagesCount: imageUrls.length,
        message: 'Images uploaded successfully',
      };

      // Emit WebSocket event to notify client
      this.scansGateway.emitImagesUploaded(userId, {
        scanId: scan.id,
        roomsCount,
        imagesCount: imageUrls.length,
        message: result.message,
      });

      return result;
    });

    // Remove previous objects from storage after successful DB commit
    if (previousImages.length > 0) {
      const previousKeys = previousImages
        .map((img) => this.extractStorageKeyFromUrl(img.url))
        .filter((key): key is string => Boolean(key));

      await Promise.all(
        previousKeys.map(async (key) => {
          try {
            await this.storageService.deleteObject(key);
          } catch (error) {
            this.logger.warn(
              `Failed to delete stale object ${key} for scan ${scanId}: ${error instanceof Error ? error.message : error}`,
            );
          }
        }),
      );
    }
  }

  /**
   * Upload files to S3 storage service
   */
  private async uploadFilesToStorage(
    files: Array<{ buffer: Buffer; mimetype: string; originalname: string }>,
    scanId: string,
  ): Promise<string[]> {
    const timestamp = Date.now();

    const uploadPromises = files.map(async (file, index) => {
      const key = `scans/${scanId}/${timestamp}-${index}-${file.originalname}`;
      const url = await this.storageService.uploadObject(
        key,
        file.buffer,
        file.mimetype,
      );
      return url;
    });

    return Promise.all(uploadPromises);
  }

  private extractStorageKeyFromUrl(url: string): string | null {
    if (!url) {
      return null;
    }

    const marker = 'scans/';
    const idx = url.indexOf(marker);
    if (idx === -1) {
      return null;
    }

    const keyWithMarker = url.substring(idx);
    const queryIndex = keyWithMarker.indexOf('?');
    return queryIndex === -1
      ? keyWithMarker
      : keyWithMarker.substring(0, queryIndex);
  }

  /**
   * Step 2: Process the scan by sending to agents-service
   * This triggers the actual AI analysis
   */
  async processScan(userId: string, scanId: string, _dto: ProcessScanDto) {
    const scan = await this.prisma.scan.findFirst({
      where: {
        id: scanId,
        house: {
          userId,
        },
      },
      include: {
        house: true,
        rooms: {
          include: {
            images: true,
          },
        },
        images: true,
      },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    if (scan.status === 'running') {
      throw new BadRequestException('Scan is already processing');
    }

    if (scan.status === 'succeeded') {
      throw new BadRequestException('Scan has already been completed');
    }

    // Verify we have images to process
    if (scan.images.length === 0) {
      throw new BadRequestException('No images found for this scan');
    }

    // Get merged checklists
    const mergedChecklists =
      await this.checklistMergeService.getAllMergedChecklists(userId);

    // Prepare rooms data for agents-service with pre-signed URLs
    const roomsData = await Promise.all(
      scan.rooms.map(async (room) => {
        const signedImageUrls = await Promise.all(
          room.images.map(async (img) => {
            // Extract S3 key from URL
            const key = this.extractStorageKeyFromUrl(img.url);
            if (!key) {
              this.logger.warn(`Could not extract key from URL: ${img.url}`);
              return img.url; // Fallback to original URL
            }
            // Generate pre-signed download URL (valid for 1 hour)
            try {
              return await this.storageService.getSignedDownloadUrl(key, 3600);
            } catch (error) {
              this.logger.error(
                `Failed to generate signed URL for ${key}: ${error instanceof Error ? error.message : error}`,
              );
              return img.url; // Fallback to original URL
            }
          }),
        );

        return {
          room_id: room.id,
          image_urls: signedImageUrls,
        };
      }),
    );

    // Update scan status to running
    await this.prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: 'running',
        startedAt: new Date(),
        inputsSnapshot: {
          house_type: scan.house.houseType,
          address: scan.house.address,
          rooms_count: scan.rooms.length,
          images_count: scan.images.length,
        } as Prisma.InputJsonValue,
      },
    });

    // Queue the scan job with merged checklists
    await this.scanQueue.add('process-scan', {
      scanId: scan.id,
      houseId: scan.houseId,
      userId,
      rooms: roomsData,
      house_checklist: mergedChecklists.house_checklist as Record<
        string,
        unknown
      >,
      rooms_checklist: mergedChecklists.rooms_checklist as Record<
        string,
        unknown
      >,
      products_checklist: mergedChecklists.products_checklist as Record<
        string,
        unknown
      >,
    });

    const result = {
      scanId: scan.id,
      status: 'running' as const,
      message: 'Scan processing started',
    };

    // Emit WebSocket event
    this.scansGateway.emitProcessingStarted(userId, {
      scanId: scan.id,
      message: result.message,
    });

    return result;
  }

  /**
   * Get comprehensive scan details from multiple database sources
   */
  async getScanDetails(userId: string, scanId: string) {
    const scan = await this.prisma.scan.findFirst({
      where: {
        id: scanId,
        house: {
          userId,
        },
      },
      include: {
        house: {
          select: {
            id: true,
            address: true,
            houseType: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        rooms: {
          select: {
            id: true,
            ordinal: true,
            label: true,
            detectedRoomTypes: true,
            images: {
              select: {
                id: true,
                url: true,
                tag: true,
                createdAt: true,
              },
            },
          },
          orderBy: { ordinal: 'asc' },
        },
        images: {
          select: {
            id: true,
            url: true,
            tag: true,
            roomId: true,
            createdAt: true,
          },
        },
        summary: {
          select: {
            id: true,
            summaryJson: true,
            prosConsJson: true,
            costSummary: true,
            derivedAt: true,
          },
        },
        agentRuns: {
          select: {
            id: true,
            agentName: true,
            tokensIn: true,
            tokensOut: true,
            costUsd: true,
            startedAt: true,
            finishedAt: true,
          },
          orderBy: { startedAt: 'desc' },
        },
      },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    // Convert all S3 URLs to pre-signed URLs for client access
    const scanWithSignedUrls = await this.convertScanUrlsToSigned(scan);

    return scanWithSignedUrls;
  }

  /**
   * Convert all S3 URLs in a scan object to pre-signed URLs
   */
  private async convertScanUrlsToSigned(scan: any): Promise<any> {
    const signUrl = async (url: string): Promise<string> => {
      const key = this.extractStorageKeyFromUrl(url);
      if (!key) {
        this.logger.warn(`Could not extract key from URL: ${url}`);
        return url;
      }
      try {
        // Generate pre-signed URL valid for 1 hour
        return await this.storageService.getSignedDownloadUrl(key, 3600);
      } catch (error) {
        this.logger.error(
          `Failed to generate signed URL for ${key}: ${error instanceof Error ? error.message : error}`,
        );
        return url;
      }
    };

    // Convert room image URLs
    if (scan.rooms && Array.isArray(scan.rooms)) {
      scan.rooms = await Promise.all(
        scan.rooms.map(async (room) => {
          if (room.images && Array.isArray(room.images)) {
            room.images = await Promise.all(
              room.images.map(async (image) => ({
                ...image,
                url: await signUrl(image.url),
              })),
            );
          }
          return room;
        }),
      );
    }

    // Convert scan-level image URLs
    if (scan.images && Array.isArray(scan.images)) {
      scan.images = await Promise.all(
        scan.images.map(async (image) => ({
          ...image,
          url: await signUrl(image.url),
        })),
      );
    }

    return scan;
  }

  /**
   * Delete a scan and all its related data (rooms, images, summary)
   * Also deletes all images from storage (MinIO/S3)
   */
  async deleteScan(userId: string, scanId: string) {
    // First verify the scan exists and belongs to the user
    const scan = await this.prisma.scan.findFirst({
      where: {
        id: scanId,
        house: {
          userId,
        },
      },
      include: {
        house: true,
      },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    this.logger.log(
      `Deleting scan ${scanId} for user ${userId} (house: ${scan.houseId})`,
    );

    // Delete from storage first (before DB to maintain references)
    const storagePrefix = `scans/${scanId}/`;
    try {
      const deletedCount =
        await this.storageService.deleteFolder(storagePrefix);
      this.logger.log(
        `Deleted ${deletedCount} objects from storage for scan ${scanId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete storage objects for scan ${scanId}: ${error instanceof Error ? error.message : error}`,
      );
      // Continue with DB deletion even if storage deletion fails
    }

    // Check if this is the last scan for the house
    const remainingScansCount = await this.prisma.scan.count({
      where: {
        houseId: scan.houseId,
        id: { not: scanId }, // Exclude the current scan being deleted
      },
    });

    const isLastScan = remainingScansCount === 0;

    // Delete from database (cascades to rooms, images, summary, agent_runs)
    await this.prisma.scan.delete({
      where: { id: scanId },
    });

    this.logger.log(`Successfully deleted scan ${scanId} from database`);

    // If this was the last scan, delete the house as well
    if (isLastScan) {
      this.logger.log(
        `Deleting house ${scan.houseId} as it has no remaining scans`,
      );
      await this.prisma.house.delete({
        where: { id: scan.houseId },
      });
      this.logger.log(`Successfully deleted house ${scan.houseId}`);
    }

    return {
      message: 'Scan deleted successfully',
      scanId,
      houseDeleted: isLastScan,
      houseId: isLastScan ? scan.houseId : undefined,
    };
  }
}
