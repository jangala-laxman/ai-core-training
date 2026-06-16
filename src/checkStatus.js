import { ExecutionApi } from '@sap-ai-sdk/ai-api';

const RESOURCE_GROUP = { 'AI-Resource-Group': 'default' };

export async function checkExecutionStatus(executionId) {
  const response = await ExecutionApi.executionGet(
    executionId,
    {},
    RESOURCE_GROUP
  ).execute();

  console.log(`[${executionId}] Status: ${response.status}`);
  return response.status;
}

export async function getExecutionLogs(executionId) {
  const response = await ExecutionApi.executionGetLogs(
    executionId,
    {},
    RESOURCE_GROUP
  ).execute();

  console.log(`\n--- Logs for execution ${executionId} ---`);
  (response.data?.result || []).forEach(entry => {
    console.log(`[${entry.timestamp}] ${entry.msg}`);
  });
  console.log('--- End logs ---\n');
}
