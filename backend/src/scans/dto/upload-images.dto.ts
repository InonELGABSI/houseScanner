import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';

type RoomUploadInput = {
  imageIndices?: unknown;
};

function isRoomUploadInput(value: unknown): value is RoomUploadInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class RoomUpload {
  @IsArray()
  @IsString({ each: true })
  imageIndices: string[]; // Array of indices mapping to uploaded files (e.g., ["0", "1", "2"])
}

export class UploadImagesDto {
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    let raw: unknown;
    if (typeof value === 'string') {
      try {
        raw = JSON.parse(value);
      } catch {
        return undefined;
      }
    } else {
      raw = value;
    }

    if (!Array.isArray(raw)) {
      return undefined;
    }

    return raw.map((item) => {
      if (isRoomUploadInput(item) && Array.isArray(item.imageIndices)) {
        const roomUpload = new RoomUpload();
        roomUpload.imageIndices = item.imageIndices.map((idx) => String(idx));
        return roomUpload;
      }
      const roomUpload = new RoomUpload();
      roomUpload.imageIndices = [];
      return roomUpload;
    });
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomUpload)
  rooms?: RoomUpload[]; // Optional: group images into rooms (labels auto-generated as Room 1, Room 2, etc.)
}
