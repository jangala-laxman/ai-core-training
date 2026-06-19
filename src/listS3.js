import './destination.js';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.OBJECT_STORE_REGION || 'us-east-1',
  credentials: {
    accessKeyId:     process.env.OBJECT_STORE_ACCESS_KEY,
    secretAccessKey: process.env.OBJECT_STORE_SECRET_KEY
  }
});

const bucket = process.env.OBJECT_STORE_BUCKET;
const prefix = 'nse-ai-core/';

const response = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
const objects = response.Contents || [];

if (objects.length === 0) {
  console.log(`No objects found under s3://${bucket}/${prefix}`);
} else {
  console.log(`Objects in s3://${bucket}/${prefix}:\n`);
  for (const obj of objects) {
    const kb = (obj.Size / 1024).toFixed(1);
    console.log(`  ${obj.Key}  (${kb} KB)  ${obj.LastModified.toISOString()}`);
  }
}
