import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { existsSync, readFileSync } from 'fs';

function usage() {
  console.log('Usage: bravebird <submit|status|results> [options]');
  console.log('  submit --queue <url> --task <text> --user <id> [--priority high|normal] [--timeout 300]');
  console.log('  status --bucket <name> --job <id>');
  console.log('  results --bucket <name> --job <id>');
  console.log('  .env defaults: HIGH_QUEUE_URL, NORMAL_QUEUE_URL, ARTIFACTS_BUCKET, STATUS_TABLE, RATE_LIMIT_TABLE');
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function loadEnvFile() {
  if (process.env.BRAVEBIRD_SKIP_ENV === 'true') {
    return;
  }

  const envPath = process.env.BRAVEBIRD_ENV_FILE ?? '.env';
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function readStream(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function submit() {
  const queueUrl = getArg('--queue') ?? process.env.HIGH_QUEUE_URL ?? process.env.NORMAL_QUEUE_URL;
  const taskInput = getArg('--task');
  const userId = getArg('--user');
  const priority = (getArg('--priority') ?? 'normal') as 'high' | 'normal';
  const timeoutSeconds = Number(getArg('--timeout') ?? '300');

  if (!queueUrl || !taskInput || !userId) {
    usage();
    process.exit(1);
  }

  await enforceRateLimit(userId);

  const jobId = randomUUID();
  const payload = {
    job_id: jobId,
    task_input: taskInput,
    priority,
    user_id: userId,
    timeout_seconds: timeoutSeconds,
    created_at: new Date().toISOString(),
  };

  const sqs = new SQSClient({});
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(payload),
    })
  );

  console.log(jobId);
}

async function enforceRateLimit(userId: string) {
  const tableName = process.env.RATE_LIMIT_TABLE;
  if (!tableName) {
    return;
  }

  const windowSeconds = Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? '5');
  const nowSeconds = Math.floor(Date.now() / 1000);
  const cutoff = nowSeconds - windowSeconds;

  const dynamo = new DynamoDBClient({});
  try {
    await dynamo.send(
      new UpdateItemCommand({
        TableName: tableName,
        Key: { user_id: { S: userId } },
        UpdateExpression: 'SET last_ts = :now',
        ConditionExpression: 'attribute_not_exists(last_ts) OR last_ts <= :cutoff',
        ExpressionAttributeValues: {
          ':now': { N: String(nowSeconds) },
          ':cutoff': { N: String(cutoff) },
        },
      })
    );
  } catch (err: any) {
    if (err?.name === 'ConditionalCheckFailedException') {
      console.error('Rate limit exceeded. Try again later.');
      process.exit(1);
    }
    throw err;
  }
}

async function fetchMetadata() {
  const bucket = getArg('--bucket') ?? process.env.ARTIFACTS_BUCKET;
  const jobId = getArg('--job');

  if (!bucket || !jobId) {
    usage();
    process.exit(1);
  }

  const statusTable = process.env.STATUS_TABLE;
  if (statusTable) {
    const dynamo = new DynamoDBClient({});
    const response = await dynamo.send(
      new GetItemCommand({
        TableName: statusTable,
        Key: { job_id: { S: jobId } },
      })
    );
    const payload = response.Item?.payload?.S;
    if (payload) {
      console.log(JSON.stringify(JSON.parse(payload), null, 2));
      return;
    }
  }

  const s3 = new S3Client({});
  const obj = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: `jobs/${jobId}/metadata.json`,
    })
  );

  const body = obj.Body;
  if (!body) {
    throw new Error('Metadata missing');
  }

  const text = await readStream(body as Readable);
  const json = JSON.parse(text);
  console.log(JSON.stringify(json, null, 2));
}

async function main() {
  loadEnvFile();
  const cmd = process.argv[2];
  if (!cmd) {
    usage();
    process.exit(1);
  }

  switch (cmd) {
    case 'submit':
      await submit();
      return;
    case 'status':
    case 'results':
      await fetchMetadata();
      return;
    default:
      usage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
