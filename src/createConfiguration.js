import { ConfigurationApi } from '@sap-ai-sdk/ai-api';

const RESOURCE_GROUP = { 'AI-Resource-Group': 'default' };
const SCENARIO_ID = 'nse-stock-scenario';

export async function createTrainingConfig(tickers, period = '30d', dataUrl) {
  const response = await ConfigurationApi.configurationCreate(
    {
      name: `nse-training-config-${Date.now()}`,
      executableId: 'nse-model-trainer',
      scenarioId: SCENARIO_ID,
      inputArtifactBindings: [],
      parameterBindings: [
        { key: 'tickers',  value: tickers  },
        { key: 'period',   value: period   },
        { key: 'data_url', value: dataUrl  }
      ]
    },
    RESOURCE_GROUP
  ).execute();

  console.log('Training config ID:', response.id);
  return response.id;
}

export async function createInferenceConfig(modelS3Key, tickerMapS3Key, tickers, dataUrl) {
  const response = await ConfigurationApi.configurationCreate(
    {
      name: `nse-inference-config-${Date.now()}`,
      executableId: 'nse-model-infer',
      scenarioId: SCENARIO_ID,
      inputArtifactBindings: [],
      parameterBindings: [
        { key: 'tickers',           value: tickers        },
        { key: 'model_s3_key',      value: modelS3Key     },
        { key: 'ticker_map_s3_key', value: tickerMapS3Key },
        { key: 'data_url',          value: dataUrl        }
      ]
    },
    RESOURCE_GROUP
  ).execute();

  console.log('Inference config ID:', response.id);
  return response.id;
}
