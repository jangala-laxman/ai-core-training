import fs from 'fs';
import path from 'path';
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
const ENV_PATH = path.resolve(process.cwd(), '.env');

function saveToEnv(key, value) {
  let content = '';
  try { content = fs.readFileSync(ENV_PATH, 'utf8'); } catch {}
  const regex = new RegExp(`^${key}=.*$`, 'm');
  content = regex.test(content)
    ? content.replace(regex, `${key}=${value}`)
    : content + `\n${key}=${value}`;
  fs.writeFileSync(ENV_PATH, content);
  process.env[key] = value;
  console.log(`  Saved ${key} to .env`);
}

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
      console.log('Waiting 15s for logs to propagate...');
      await new Promise(r => setTimeout(r, 15000));
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
    console.log(`\n=== Reusing training config: ${trainingConfigId} ===`);
  } else {
    console.log('\n=== STEP 0: Fetch NSE data locally & upload to S3 ===');
    const rows = await fetchNSEData(tickerList, PERIOD);
    const csv  = rowsToCsv(rows);
    const dataUrl = await uploadCsvGetPresignedUrl(csv);

    console.log('\n=== STEP 1: Create training configuration ===');
    trainingConfigId = await createTrainingConfig(TICKERS, PERIOD, dataUrl);
    saveToEnv('TRAINING_CONFIG_ID', trainingConfigId);
  }

  // ── Training execution ───────────────────────────────────────────────────
  let trainingExecutionId = process.env.TRAINING_EXECUTION_ID;
  if (trainingExecutionId) {
    console.log(`\n=== Reusing training execution: ${trainingExecutionId} ===`);
    console.log('(Skipping re-training — using cached model artifacts)');
  } else {
    console.log('\n=== STEP 2: Trigger training execution ===');
    const trainingExecution = await createExecution(trainingConfigId);
    await pollUntilDone(trainingExecution.id, 'Training');
    trainingExecutionId = trainingExecution.id;
    saveToEnv('TRAINING_EXECUTION_ID', trainingExecutionId);
  }

  // ── Fetch model artifacts ────────────────────────────────────────────────
  console.log('\n=== STEP 3: Fetch training artifacts ===');
  const { modelArtifactId, tickerMapArtifactId } = await getTrainingArtifacts(trainingExecutionId);

  // ── Inference config ─────────────────────────────────────────────────────
  let inferenceConfigId = process.env.INFERENCE_CONFIG_ID;
  if (inferenceConfigId) {
    console.log(`\n=== Reusing inference config: ${inferenceConfigId} ===`);
  } else {
    console.log('\n=== STEP 4: Create inference configuration ===');
    inferenceConfigId = await createInferenceConfig(modelArtifactId, tickerMapArtifactId, TICKERS);
    saveToEnv('INFERENCE_CONFIG_ID', inferenceConfigId);
  }

  // ── Inference execution (always fresh — gets latest recommendations) ─────
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
