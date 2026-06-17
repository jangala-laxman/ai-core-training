import './destination.js';
import { ExecutableApi } from '@sap-ai-sdk/ai-api';

const RESOURCE_GROUP = { 'AI-Resource-Group': 'default' };

const response = await ExecutableApi.executableQuery(
  'nse-stock-scenario',
  {},
  RESOURCE_GROUP
).execute();

const executables = response.resources || [];
console.log(`Found ${executables.length} executable(s):\n`);

for (const ex of executables) {
  console.log(`Name: ${ex.name}  ID: ${ex.id}  Version: ${ex.versionId}`);

  const params = ex.parameters || [];
  const artifacts = ex.inputArtifacts || [];

  console.log(`  Parameters: ${params.map(p => p.name).join(', ') || '(none)'}`);
  console.log(`  Input artifacts: ${artifacts.map(a => a.name).join(', ') || '(none)'}`);
  console.log();
}
