import './destination.js';
import { ExecutionApi } from '@sap-ai-sdk/ai-api';

const RESOURCE_GROUP = { 'AI-Resource-Group': 'default' };

const response = await ExecutionApi.executionQuery(
  { $top: 50 },
  RESOURCE_GROUP
).execute();

const executions = response.resources || [];
console.log(`Total executions: ${executions.length}\n`);

for (const ex of executions) {
  console.log(`${ex.id}  ${ex.status.padEnd(12)}  ${ex.executableId}  created: ${ex.createdAt}`);
}

const active = executions.filter(e => ['RUNNING', 'PENDING', 'UNKNOWN'].includes(e.status));
console.log(`\nActive (RUNNING/PENDING/UNKNOWN): ${active.length}`);
