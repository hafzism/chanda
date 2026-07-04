import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Injectable, type OnApplicationShutdown } from '@nestjs/common';

import type { ObjectStorage } from './storage.types';

function storageConfig(): S3ClientConfig {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.S3_SECRET_KEY?.trim();

  return {
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
    region: process.env.S3_REGION?.trim() || 'us-east-1',
  };
}

function isMissingBucket(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const namedError = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    namedError.name === 'NotFound' ||
    namedError.name === 'NoSuchBucket' ||
    namedError.$metadata?.httpStatusCode === 404
  );
}

@Injectable()
export class ObjectStorageService
  implements ObjectStorage, OnApplicationShutdown
{
  private readonly bucket = process.env.S3_BUCKET?.trim() || 'suppline-local';
  private readonly client = new S3Client(storageConfig());
  private bucketReady: Promise<void> | null = null;

  async putText(input: {
    content: string;
    contentHash: string;
    key: string;
  }): Promise<void> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Body: Buffer.from(input.content, 'utf8'),
        Bucket: this.bucket,
        ContentType: 'text/markdown; charset=utf-8',
        Key: input.key,
        Metadata: { sha256: input.contentHash },
      }),
    );
  }

  async putBytes(input: {
    content: Uint8Array;
    contentHash: string;
    contentType: string;
    key: string;
  }): Promise<void> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Body: input.content,
        Bucket: this.bucket,
        ContentType: input.contentType,
        Key: input.key,
        Metadata: { sha256: input.contentHash },
      }),
    );
  }

  async getText(key: string): Promise<string> {
    await this.ensureBucket();
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body) throw new Error('Stored object body is unavailable.');
    return response.Body.transformToString('utf-8');
  }

  async delete(key: string): Promise<void> {
    await this.ensureBucket();
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  onApplicationShutdown(): void {
    this.client.destroy();
  }

  private ensureBucket(): Promise<void> {
    this.bucketReady ??= this.checkOrCreateBucket();
    return this.bucketReady;
  }

  private async checkOrCreateBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'production' || !isMissingBucket(error)) {
        throw error;
      }

      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }
}
