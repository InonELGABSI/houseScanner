import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UploadImagesDto } from './dto/upload-images.dto';
import { ProcessScanDto } from './dto/process-scan.dto';
import { CreateScanDto } from './dto/create-scan.dto';
import { ScansService } from './scans.service';

interface RequestUser {
  userId: string;
}

type IncomingUpload = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@ApiTags('Scans')
@ApiBearerAuth()
@Controller('scans')
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new scan' })
  @ApiResponse({
    status: 201,
    description: 'Scan created successfully, returns scanId',
  })
  createScan(@CurrentUser() user: RequestUser, @Body() dto: CreateScanDto) {
    return this.scansService.createScan(user.userId, dto);
  }

  @Post(':scanId/images')
  @UseInterceptors(FilesInterceptor('images'))
  @ApiOperation({ summary: 'Upload/attach images to a scan' })
  @ApiResponse({ status: 200, description: 'Images uploaded successfully' })
  @ApiResponse({ status: 404, description: 'Scan not found' })
  uploadImages(
    @CurrentUser() user: RequestUser,
    @Param('scanId') scanId: string,
    @Body() dto: UploadImagesDto,
    @UploadedFiles() files: IncomingUpload[],
  ) {
    return this.scansService.uploadImages(user.userId, scanId, files, dto);
  }

  @Post(':scanId/process')
  @ApiOperation({ summary: 'Kick off processing for a scan' })
  @ApiResponse({ status: 200, description: 'Scan processing initiated' })
  @ApiResponse({ status: 404, description: 'Scan not found' })
  processScan(
    @CurrentUser() user: RequestUser,
    @Param('scanId') scanId: string,
    @Body() dto: ProcessScanDto,
  ) {
    return this.scansService.processScan(user.userId, scanId, dto);
  }

  @Get(':scanId')
  @ApiOperation({ summary: 'Get scan details from multiple sources' })
  @ApiResponse({
    status: 200,
    description: 'Scan details including house, rooms, images, and summary',
  })
  @ApiResponse({ status: 404, description: 'Scan not found' })
  getScanDetails(
    @CurrentUser() user: RequestUser,
    @Param('scanId') scanId: string,
  ) {
    return this.scansService.getScanDetails(user.userId, scanId);
  }

  @Delete(':scanId')
  @ApiOperation({ summary: 'Delete a scan and all its related data' })
  @ApiResponse({
    status: 200,
    description: 'Scan deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Scan not found' })
  deleteScan(
    @CurrentUser() user: RequestUser,
    @Param('scanId') scanId: string,
  ) {
    return this.scansService.deleteScan(user.userId, scanId);
  }
}
