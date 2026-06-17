import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function uploadCsvGetPresignedUrl(csvContent) {
  const bucket = process.env.OBJECT_STORE_BUCKET;
  const region = process.env.OBJECT_STORE_REGION || 'us-east-1';
  const s3Key  = `nse-ai-core/datasets/training_data_${Date.now()}.csv`;

  if (!bucket)                            throw new Error('OBJECT_STORE_BUCKET env var not set');
  if (!process.env.OBJECT_STORE_ACCESS_KEY) throw new Error('OBJECT_STORE_ACCESS_KEY env var not set');

  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId:     process.env.OBJECT_STORE_ACCESS_KEY,
      secretAccessKey: process.env.OBJECT_STORE_SECRET_KEY
    }
  });

  console.log(`Uploading training data → s3://${bucket}/${s3Key}`);
  await s3.send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         s3Key,
    Body:        csvContent,
    ContentType: 'text/csv'
  }));
  console.log('S3 upload complete.');

  // Presigned URL valid 24 h — enough time for training execution to download it
  const presignedUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: s3Key }),
    { expiresIn: 86400 }
  );
  console.log('Presigned download URL generated (valid 24 h).');
  return presignedUrl;
}
