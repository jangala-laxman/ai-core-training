import { ConfigurationApi } from '@sap-ai-sdk/ai-api';

const RESOURCE_GROUP = { 'AI-Resource-Group': 'default' };
const SCENARIO_ID = 'nse-stock-scenario';

export async function createTrainingConfig(tickers, period = '30d', dataArtifactId) {
  const response = await ConfigurationApi.configurationCreate(
    {
      name: `nse-training-config-${Date.now()}`,
      executableId: 'nse-model-trainer',
      scenarioId: SCENARIO_ID,
      inputArtifactBindings: [
        { key: 'data', artifactId: dataArtifactId }
      ],
      parameterBindings: [
        { key: 'tickers', value: tickers },
        { key: 'period',  value: period  }
      ]
    },
    RESOURCE_GROUP
  ).execute();

  console.log('Training config ID:', response.id);
  return response.id;
}

export async function createInferenceConfig(modelArtifactId, tickerMapArtifactId, tickers) {
  const response = await ConfigurationApi.configurationCreate(
    {
      name: `nse-inference-config-${Date.now()}`,
      executableId: 'nse-model-infer',
      scenarioId: SCENARIO_ID,
      inputArtifactBindings: [
        { key: 'model',      artifactId: modelArtifactId     },
        { key: 'ticker-map', artifactId: tickerMapArtifactId }
      ],
      parameterBindings: [
        { key: 'tickers', value: tickers }
      ]
    },
    RESOURCE_GROUP
  ).execute();

  console.log('Inference config ID:', response.id);
  return response.id;
}
