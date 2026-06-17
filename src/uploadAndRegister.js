import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ArtifactApi } from '@sap-ai-sdk/ai-api';

const RESOURCE_GROUP = { 'AI-Resource-Group': 'default' };
const SCENARIO_ID = 'nse-stock-scenario';

export async function uploadCsvAndRegisterArtifact(csvContent) {
  const bucket = process.env.OBJECT_STORE_BUCKET;
  const region = process.env.OBJECT_STORE_REGION || 'us-east-1';
  const s3Key = `nse-ai-core/datasets/training_data_${Date.now()}.csv`;

  if (!bucket) throw new Error('OBJECT_STORE_BUCKET env var not set');
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

  const url = `s3://${bucket}/${s3Key}`;
  const artifact = await ArtifactApi.artifactCreate(
    {
      name:        `nse-training-data-${Date.now()}`,
      kind:        'dataset',
      url,
      scenarioId:  SCENARIO_ID,
      description: 'NSE stock historical OHLCV data'
    },
    RESOURCE_GROUP
  ).execute();

  console.log(`Artifact registered: ${artifact.id} → ${url}`);
  return artifact.id;
}
