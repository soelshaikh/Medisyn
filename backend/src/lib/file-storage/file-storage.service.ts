import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';
import type { FileStorageConfig } from './file-storage.types';

class FileStorageService {
  private readonly client: S3Client;
  private readonly config: FileStorageConfig;

  constructor() {
    const bucket = process.env.AWS_S3_BUCKET ?? '';
    const endpoint = process.env.AWS_S3_ENDPOINT?.trim() || undefined;

    this.config = {
      region: process.env.AWS_S3_REGION ?? 'auto',
      bucket,
      endpoint,
      accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY ?? '',
      signedUrlExpiry: Number(process.env.FILE_SIGNED_URL_EXPIRY_SECONDS ?? 900),
      maxFileSizeBytes: Number(process.env.FILE_MAX_SIZE_BYTES ?? 10_485_760),
    };

    this.client = new S3Client({
      region: this.config.region,
      ...(endpoint ? { endpoint } : {}),
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  async uploadFile(
    buffer: Buffer,
    mimeType: string,
    folder: string,
    ext: string,
  ): Promise<string> {
    if (!this.config.bucket) {
      throw new AppError('STORAGE_UNAVAILABLE', 'File storage is not configured', 503);
    }
    const fileKey = `${folder}/${uuidv4()}${ext}`;
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: fileKey,
          Body: buffer,
          ContentType: mimeType,
        }),
      );
    } catch (err: unknown) {
      throw this.storageError(err);
    }
    return fileKey;
  }

  async getSignedUrl(fileKey: string, expirySeconds?: number): Promise<string> {
    try {
      const url = await awsGetSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.config.bucket, Key: fileKey }),
        { expiresIn: expirySeconds ?? this.config.signedUrlExpiry },
      );
      return url;
    } catch (err: unknown) {
      throw this.storageError(err);
    }
  }

  async deleteFile(fileKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.config.bucket, Key: fileKey }),
      );
    } catch (err: unknown) {
      throw this.storageError(err);
    }
  }

  get signedUrlExpiry(): number {
    return this.config.signedUrlExpiry;
  }

  private storageError(err: unknown): AppError {
    const msg = err instanceof Error ? err.message : String(err);
    const isConnErr =
      msg.includes('ECONNREFUSED') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('NetworkingError') ||
      msg.includes('getaddrinfo');
    if (isConnErr) {
      return new AppError('STORAGE_UNAVAILABLE', 'File storage is temporarily unavailable', 503);
    }
    return new AppError('STORAGE_ERROR', `File storage error: ${msg}`, 502);
  }
}

export const fileStorage = new FileStorageService();
