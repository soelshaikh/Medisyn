import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "@/config";
import { logger } from "@/common/utils/logger";

/* ────────────────────────────────────────────────────────────────────
   Interface
   ──────────────────────────────────────────────────────────────────── */
export interface IFileStorageService {
  /**
   * Upload a file. Returns the storage key (for private files)
   * or a direct public URL (for public files).
   */
  upload(opts: {
    buffer:      Buffer;
    originalName: string;
    mimeType:    string;
    folder:      string;   /* e.g. "products", "private/compounding" */
  }): Promise<{ key: string; url: string }>;

  /** Delete a file by its storage key. */
  delete(key: string): Promise<void>;

  /**
   * Return a URL that grants temporary read access to a private file.
   * For local storage this is just the public path.
   * For S3 this is a presigned GET URL.
   */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;

  /** True if the key is a private (PHI) path that requires a signed URL. */
  isPrivate(key: string): boolean;
}

/* ────────────────────────────────────────────────────────────────────
   Local implementation (development / fallback)
   ──────────────────────────────────────────────────────────────────── */
class LocalFileStorage implements IFileStorageService {
  private readonly baseDir: string;
  private readonly baseUrl: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), "uploads");
    this.baseUrl = `http://localhost:${config.PORT}/uploads`;
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  async upload({ buffer, originalName, folder }: Parameters<IFileStorageService["upload"]>[0]) {
    const ext = path.extname(originalName).toLowerCase();
    const key = `${folder}/${uuid()}${ext}`;
    const flatKey = key.replace(/\//g, "_");
    const dest = path.join(this.baseDir, flatKey);

    fs.writeFileSync(dest, buffer);

    return { key, url: `${this.baseUrl}/${flatKey}` };
  }

  async delete(key: string) {
    const flatKey = key.replace(/\//g, "_");
    const filePath = path.join(this.baseDir, flatKey);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  async getSignedUrl(key: string) {
    const flatKey = key.replace(/\//g, "_");
    return `${this.baseUrl}/${flatKey}`;
  }

  isPrivate(key: string) {
    return key.startsWith("private/");
  }
}

/* ────────────────────────────────────────────────────────────────────
   S3-compatible implementation (AWS S3 / Cloudflare R2 / MinIO / B2)
   ──────────────────────────────────────────────────────────────────── */
class S3FileStorage implements IFileStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string | undefined;

  constructor() {
    if (!config.S3_BUCKET)            throw new Error("S3_BUCKET is required for S3 storage");
    if (!config.S3_ACCESS_KEY_ID)     throw new Error("S3_ACCESS_KEY_ID is required");
    if (!config.S3_SECRET_ACCESS_KEY) throw new Error("S3_SECRET_ACCESS_KEY is required");

    this.bucket    = config.S3_BUCKET;
    this.publicUrl = config.S3_PUBLIC_URL;

    this.client = new S3Client({
      region:      config.S3_REGION,
      ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}),
      credentials: {
        accessKeyId:     config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      },
      /* Cloudflare R2 requires path-style addressing */
      forcePathStyle: !!config.S3_ENDPOINT,
    });
  }

  async upload({ buffer, originalName, mimeType, folder }: Parameters<IFileStorageService["upload"]>[0]) {
    const ext = path.extname(originalName).toLowerCase();
    const key = `${folder}/${uuid()}${ext}`;

    await this.client.send(new PutObjectCommand({
      Bucket:      this.bucket,
      Key:         key,
      Body:        buffer,
      ContentType: mimeType,
    }));

    const isPrivate = this.isPrivate(key);
    const url = isPrivate
      ? await this.getSignedUrl(key)          /* private: presigned read URL */
      : this.buildPublicUrl(key);             /* public: direct CDN URL */

    return { key, url };
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600) {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
  }

  isPrivate(key: string) {
    return key.startsWith("private/");
  }

  private buildPublicUrl(key: string) {
    if (this.publicUrl) return `${this.publicUrl.replace(/\/$/, "")}/${key}`;
    /* Fallback: standard AWS S3 URL */
    return `https://${this.bucket}.s3.${config.S3_REGION}.amazonaws.com/${key}`;
  }
}

/* ────────────────────────────────────────────────────────────────────
   Factory — singleton selected by FILE_STORAGE_PROVIDER
   ──────────────────────────────────────────────────────────────────── */
function createStorageService(): IFileStorageService {
  if (config.FILE_STORAGE_PROVIDER === "s3") {
    logger.info("[FileStorage] Using S3-compatible storage");
    return new S3FileStorage();
  }
  logger.info("[FileStorage] Using local disk storage (uploads/)");
  return new LocalFileStorage();
}

export const storageService: IFileStorageService = createStorageService();
