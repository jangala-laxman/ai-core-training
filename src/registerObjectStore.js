import './destination.js';
import { ObjectStoreSecretApi } from '@sap-ai-sdk/ai-api';

const RESOURCE_GROUP = { 'AI-Resource-Group': 'default' };

const SECRET_DATA = {
  AWS_ACCESS_KEY_ID:     process.env.OBJECT_STORE_ACCESS_KEY,
  AWS_SECRET_ACCESS_KEY: process.env.OBJECT_STORE_SECRET_KEY,
  endpoint:              's3.amazonaws.com',
  bucket:                process.env.OBJECT_STORE_BUCKET,
  region:                process.env.OBJECT_STORE_REGION || 'us-east-1'
};

async function register() {
  console.log('Registering object store secret...');

  try {
    const response = await ObjectStoreSecretApi
      .kubesubmitV4ObjectStoreSecretsCreate(
        {
          name:       'default',
          type:       'S3',
          pathPrefix: 'nse-ai-core/',
          data:       SECRET_DATA
        },
        RESOURCE_GROUP
      )
      .execute();

    console.log('Success:', JSON.stringify(response, null, 2));
  } catch (err) {
    console.error('Failed:', err.message);
    console.error('Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  }
}

register();
