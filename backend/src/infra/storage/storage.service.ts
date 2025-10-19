import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageConfig } from '../../config';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl?: string;
  private readonly endpoint: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly configService: ConfigService) {
    const storage = this.configService.getOrThrow<StorageConfig>('storage', {
      infer: true,
    });

    this.bucket = storage.bucket;
    this.publicUrl = storage.publicUrl;
    this.endpoint = storage.endpoint;
    this.client = new S3Client({
      region: storage.region,
      endpoint: storage.endpoint || undefined,
      forcePathStyle: true,
      credentials: {
        accessKeyId: storage.accessKey,
        secretAccessKey: storage.secretKey,
      },
    });
  }

  async uploadObject(
    key: string,
    body: Buffer | Uint8Array | string,
    contentType?: string,
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    this.logger.debug(`Uploaded object ${key}`);

    return this.buildPublicUrl(key);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    this.logger.debug(`Deleted object ${key}`);
  }

  /**
   * Delete all objects under a prefix (folder)
   * Uses individual delete commands to avoid Content-MD5 header issues
   */
  async deleteFolder(prefix: string): Promise<number> {
    let deletedCount = 0;
    let continuationToken: string | undefined;

    do {
      // List objects with the prefix
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const listResponse = await this.client.send(listCommand);

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        // Delete objects individually (avoids Content-MD5 requirement)
        const deletePromises = listResponse.Contents.map(async (obj) => {
          if (obj.Key) {
            try {
              await this.deleteObject(obj.Key);
              return true;
            } catch (error) {
              this.logger.warn(
                `Failed to delete object ${obj.Key}: ${error instanceof Error ? error.message : error}`,
              );
              return false;
            }
          }
          return false;
        });

        const results = await Promise.all(deletePromises);
        const successCount = results.filter((r) => r).length;
        deletedCount += successCount;

        this.logger.debug(
          `Deleted ${successCount}/${listResponse.Contents.length} objects from ${prefix}`,
        );
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    this.logger.log(`Deleted ${deletedCount} total objects from ${prefix}`);
    return deletedCount;
  }

  async getSignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async getDownloadUrlForClient(key: string, expiresInSeconds = 3600): Promise<string> {
    if (this.shouldUsePublicAccess()) {
      return this.buildPublicUrl(key);
    }

    return this.getSignedDownloadUrl(key, expiresInSeconds);
  }

  private buildPublicUrl(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    }
    const normalizedEndpoint = this.endpoint.replace(/\/$/, '');
    if (normalizedEndpoint) {
      return `${normalizedEndpoint}/${this.bucket}/${key}`;
    }
    return `/${this.bucket}/${key}`;
  }

  private shouldUsePublicAccess(): boolean {
    if (!this.publicUrl) {
      return false;
    }

    try {
      const url = new URL(this.publicUrl);
      return ['localhost', '127.0.0.1'].includes(url.hostname);
    } catch (error) {
      this.logger.warn(
        `Invalid STORAGE_PUBLIC_URL; falling back to signed URLs: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return false;
    }
  }
}
