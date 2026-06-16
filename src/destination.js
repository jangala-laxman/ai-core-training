import dotenv from 'dotenv';
dotenv.config();

if (!process.env.AICORE_SERVICE_KEY) {
  throw new Error('AICORE_SERVICE_KEY environment variable is not set');
}

let serviceKey;
try {
  serviceKey = JSON.parse(process.env.AICORE_SERVICE_KEY);
} catch {
  throw new Error('AICORE_SERVICE_KEY is not valid JSON');
}

process.env.VCAP_SERVICES = JSON.stringify({
  aicore: [{
    label: 'aicore',
    name: 'aicore-instance',
    credentials: serviceKey
  }]
});
