import { ExecutionApi } from '@sap-ai-sdk/ai-api';

const RESOURCE_GROUP = { 'AI-Resource-Group': 'default' };

export async function checkExecutionStatus(executionId) {
  const response = await ExecutionApi.executionGet(
    executionId,
    {},
    RESOURCE_GROUP
  ).execute();

  const status = response.status;
  console.log(`[${executionId}] Status: ${status}`);

  if (status === 'DEAD') {
    console.log('Execution details:');
    console.log(JSON.stringify(response, null, 2));
  }

  return status;
}

export async function getExecutionLogs(executionId) {
  const response = await ExecutionApi.kubesubmitV4ExecutionsGetLogs(
    executionId,
    { $top: 200 },
    RESOURCE_GROUP
  ).execute();

  console.log(`\n--- Logs for execution ${executionId} ---`);
  const entries = response?.data?.result ?? response?.result ?? [];
  entries.forEach(entry => {
    console.log(`[${entry.timestamp}] ${entry.msg}`);
  });
  if (entries.length === 0) {
    console.log('(no log entries returned)');
    console.log('Raw response:', JSON.stringify(response, null, 2));
  }
  console.log('--- End logs ---\n');
}
