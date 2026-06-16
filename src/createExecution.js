import { ExecutionApi } from '@sap-ai-sdk/ai-api';

const RESOURCE_GROUP = { 'AI-Resource-Group': 'default' };

export async function createExecution(configurationId) {
  const response = await ExecutionApi.executionCreate(
    { configurationId },
    RESOURCE_GROUP
  ).execute();

  console.log('Execution ID:', response.id);
  console.log('Status:', response.status);
  return response;
}
