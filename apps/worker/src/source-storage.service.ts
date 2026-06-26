import {
  GetObjectCommand,
  HeadBucketCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Injectable, type OnApplicationShutdown } from '@nestjs/common';

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

@Injectable()
export class SourceStorageService implements OnApplicationShutdown {
  private readonly bucket = process.env.S3_BUCKET?.trim() || 'suppline-local';
  private readonly client = new S3Client(storageConfig());
  private checkedBucket = false;

  async readText(key: string): Promise<string> {
    if (!this.checkedBucket) {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.checkedBucket = true;
    }
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body)
      throw new Error('Knowledge source body is unavailable.');
    return response.Body.transformToString('utf-8');
  }

  onApplicationShutdown(): void {
    this.client.destroy();
  }
}
