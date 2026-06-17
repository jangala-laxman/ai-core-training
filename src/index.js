import './destination.js';
import { fetchNSEData, rowsToCsv } from './fetchData.js';
import { uploadCsvGetPresignedUrl } from './uploadAndRegister.js';
import { createTrainingConfig, createInferenceConfig } from './createConfiguration.js';
import { createExecution } from './createExecution.js';
import { checkExecutionStatus, getExecutionLogs } from './checkStatus.js';
import { getTrainingArtifacts } from './getArtifacts.js';

const TICKERS = 'RELIANCE.NS,TCS.NS,INFY.NS,HDFCBANK.NS,WIPRO.NS,LT.NS,ICICIBANK.NS,SBIN.NS';
const PERIOD  = '30d';
const POLL_INTERVAL_MS = 10000;

async function pollUntilDone(executionId, label) {
  console.log(`\nPolling ${label} execution: ${executionId}`);
  const MAX_POLLS = 60;
  let polls = 0;

  while (polls < MAX_POLLS) {
    const status = await checkExecutionStatus(executionId);

    if (status === 'COMPLETED') {
      console.log(`${label} completed successfully.`);
      return;
    }
    if (status === 'DEAD') {
      await getExecutionLogs(executionId);
      throw new Error(`${label} execution failed (DEAD). Check logs above.`);
    }

    polls++;
    if (polls % 6 === 0) {
      console.log(`Still waiting... (${polls * POLL_INTERVAL_MS / 1000}s elapsed). Check AI Launchpad > Executions for details.`);
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`${label} timed out after ${MAX_POLLS * POLL_INTERVAL_MS / 1000}s.`);
}

async function main() {
  const tickerList = TICKERS.split(',');

  // ── Training config ──────────────────────────────────────────────────────
  let trainingConfigId = process.env.TRAINING_CONFIG_ID;

  if (trainingConfigId) {
    console.log(`\n=== Using existing training config: ${trainingConfigId} ===`);
    console.log('(Skipping data fetch and config creation — using TRAINING_CONFIG_ID from .env)');
  } else {
    console.log('\n=== STEP 0: Fetch NSE data locally & upload to S3 ===');
    const rows = await fetchNSEData(tickerList, PERIOD);
    const csv  = rowsToCsv(rows);
    const dataUrl = await uploadCsvGetPresignedUrl(csv);

    console.log('\n=== STEP 1: Create training configuration ===');
    trainingConfigId = await createTrainingConfig(TICKERS, PERIOD, dataUrl);
    console.log(`\n>> Save this to .env to reuse: TRAINING_CONFIG_ID=${trainingConfigId}`);
  }

  // ── Training execution ───────────────────────────────────────────────────
  console.log('\n=== STEP 2: Trigger training execution ===');
  const trainingExecution = await createExecution(trainingConfigId);
  await pollUntilDone(trainingExecution.id, 'Training');

  // ── Fetch model artifacts ────────────────────────────────────────────────
  console.log('\n=== STEP 3: Fetch training artifacts ===');
  const { modelArtifactId, tickerMapArtifactId } = await getTrainingArtifacts(trainingExecution.id);

  // ── Inference config (always fresh — depends on this run's model) ────────
  console.log('\n=== STEP 4: Create inference configuration ===');
  const inferenceConfigId = await createInferenceConfig(modelArtifactId, tickerMapArtifactId, TICKERS);

  // ── Inference execution ──────────────────────────────────────────────────
  console.log('\n=== STEP 5: Trigger inference execution ===');
  const inferenceExecution = await createExecution(inferenceConfigId);
  await pollUntilDone(inferenceExecution.id, 'Inference');

  console.log('\n=== STEP 6: Fetch inference logs (recommendations) ===');
  await getExecutionLogs(inferenceExecution.id);

  console.log('\nDone. Check AI Launchpad > Executions for full artifact output.');
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  console.error('Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  process.exit(1);
});
