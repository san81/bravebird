import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const jobId = process.env.JOB_ID;
const taskInput = process.env.TASK_INPUT;
const artifactBucket = process.env.ARTIFACT_BUCKET;
const blockMetadata = process.env.BLOCK_METADATA === 'true';

if (!jobId || !artifactBucket) {
  throw new Error('Missing required env vars: JOB_ID or ARTIFACT_BUCKET');
}

const s3 = new S3Client({});

async function main() {
  if (blockMetadata) {
    const reachable = await isMetadataReachable();
    if (reachable) {
      throw new Error('Metadata endpoint is reachable. Aborting for safety.');
    }
  }

  const content = [
    'Placeholder agent ran successfully.',
    `job_id: ${jobId}`,
    `task_input: ${taskInput ?? ''}`,
  ].join('\n');

  await s3.send(
    new PutObjectCommand({
      Bucket: artifactBucket,
      Key: `jobs/${jobId}/artifacts/output.txt`,
      Body: content,
      ContentType: 'text/plain',
    })
  );

  console.log('Agent completed.');
}

async function isMetadataReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);
    const res = await fetch('http://169.254.169.254/latest/meta-data/', {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
