import './destination.js';
import { createTrainingConfig, createInferenceConfig } from './createConfiguration.js';
import { createExecution } from './createExecution.js';
import { checkExecutionStatus, getExecutionLogs } from './checkStatus.js';
import { getTrainingArtifacts } from './getArtifacts.js';

const TICKERS = 'RELIANCE.NS,TCS.NS,INFY.NS,HDFCBANK.NS,WIPRO.NS,LT.NS,ICICIBANK.NS,SBIN.NS';
const PERIOD  = '30d';
const POLL_INTERVAL_MS = 10000;

async function pollUntilDone(executionId, label) {
  console.log(`\nPolling ${label} execution: ${executionId}`);
  while (true) {
    const status = await checkExecutionStatus(executionId);

    if (status === 'COMPLETED') {
      console.log(`${label} completed successfully.`);
      return;
    }
    if (status === 'DEAD') {
      await getExecutionLogs(executionId);
      throw new Error(`${label} execution failed (DEAD). Check logs above.`);
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

async function main() {
  // Step 1: Train
  console.log('\n=== STEP 1: Create training configuration ===');
  const trainingConfigId = await createTrainingConfig(TICKERS, PERIOD);

  console.log('\n=== STEP 2: Trigger training execution ===');
  const trainingExecution = await createExecution(trainingConfigId);
  await pollUntilDone(trainingExecution.id, 'Training');

  console.log('\n=== STEP 3: Fetch training artifacts ===');
  const { modelArtifactId, tickerMapArtifactId } = await getTrainingArtifacts(trainingExecution.id);

  // Step 2: Infer
  console.log('\n=== STEP 4: Create inference configuration ===');
  const inferenceConfigId = await createInferenceConfig(modelArtifactId, tickerMapArtifactId, TICKERS);

  console.log('\n=== STEP 5: Trigger inference execution ===');
  const inferenceExecution = await createExecution(inferenceConfigId);
  await pollUntilDone(inferenceExecution.id, 'Inference');

  console.log('\n=== STEP 6: Fetch inference logs (recommendations) ===');
  await getExecutionLogs(inferenceExecution.id);

  console.log('\nDone. Check AI Launchpad > Executions for full artifact output.');
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
