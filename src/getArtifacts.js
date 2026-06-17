const S3_PREFIX = 'nse-ai-core/models';

export function getTrainingArtifacts(executionId) {
  const prefix = `${S3_PREFIX}/${executionId}`;
  console.log(`Model artifacts at s3://[bucket]/${prefix}/`);
  return {
    modelS3Key:      `${prefix}/nse_model.pkl`,
    tickerMapS3Key:  `${prefix}/ticker_map.json`
  };
}
