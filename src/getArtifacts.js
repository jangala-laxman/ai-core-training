import { ArtifactApi } from '@sap-ai-sdk/ai-api';

const RESOURCE_GROUP = { 'AI-Resource-Group': 'default' };

export async function getTrainingArtifacts(executionId) {
  const response = await ArtifactApi.artifactQuery(
    { executionId },
    RESOURCE_GROUP
  ).execute();

  const artifacts = response.resources || [];
  console.log(`Found ${artifacts.length} artifact(s) for execution ${executionId}:`);
  artifacts.forEach(a => console.log(`  - ${a.name}: ${a.id}`));

  const model     = artifacts.find(a => a.name === 'model');
  const tickerMap = artifacts.find(a => a.name === 'ticker-map');

  if (!model)     throw new Error('model artifact not found after training');
  if (!tickerMap) throw new Error('ticker-map artifact not found after training');

  return { modelArtifactId: model.id, tickerMapArtifactId: tickerMap.id };
}
