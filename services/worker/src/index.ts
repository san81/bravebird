import { ECSClient, RunTaskCommand, DescribeTasksCommand, waitUntilTasksStopped } from '@aws-sdk/client-ecs';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const requiredEnv = [
  'HIGH_QUEUE_URL',
  'NORMAL_QUEUE_URL',
  'CLUSTER_ARN',
  'TASK_DEF_ARN',
  'SUBNETS',
  'SECURITY_GROUPS',
  'ARTIFACT_BUCKET',
  'STATUS_TABLE',
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const highQueueUrl = process.env.HIGH_QUEUE_URL as string;
const normalQueueUrl = process.env.NORMAL_QUEUE_URL as string;
const clusterArn = process.env.CLUSTER_ARN as string;
const taskDefArn = process.env.TASK_DEF_ARN as string;
const subnets = (process.env.SUBNETS as string).split(',');
const securityGroups = (process.env.SECURITY_GROUPS as string).split(',');
const artifactBucket = process.env.ARTIFACT_BUCKET as string;
const statusTable = process.env.STATUS_TABLE as string;
const jobTimeoutSeconds = Number(process.env.JOB_TIMEOUT_SECONDS ?? '600');

const sqs = new SQSClient({});
const ecs = new ECSClient({});
const s3 = new S3Client({});
const dynamo = new DynamoDBClient({});

type JobMessage = {
  job_id: string;
  task_input: string | Record<string, unknown>;
  priority: 'high' | 'normal';
  user_id: string;
  timeout_seconds?: number;
  created_at: string;
};

async function writeMetadata(jobId: string, payload: Record<string, unknown>) {
  const body = JSON.stringify(payload, null, 2);
  await s3.send(
    new PutObjectCommand({
      Bucket: artifactBucket,
      Key: `jobs/${jobId}/metadata.json`,
      Body: body,
      ContentType: 'application/json',
    })
  );
}

async function writeStatus(jobId: string, payload: Record<string, unknown>) {
  await dynamo.send(
    new PutItemCommand({
      TableName: statusTable,
      Item: {
        job_id: { S: jobId },
        payload: { S: JSON.stringify(payload) },
      },
    })
  );
}

async function handleMessage(messageBody: string) {
  const job: JobMessage = JSON.parse(messageBody);
  const startedAt = Date.now();

  await writeMetadata(job.job_id, {
    job_id: job.job_id,
    status: 'running',
    started_at: new Date().toISOString(),
  });
  await writeStatus(job.job_id, {
    job_id: job.job_id,
    status: 'running',
    started_at: new Date().toISOString(),
  });

  const runTask = await ecs.send(
    new RunTaskCommand({
      cluster: clusterArn,
      taskDefinition: taskDefArn,
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets,
          securityGroups,
          assignPublicIp: 'DISABLED',
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: 'agent',
            environment: [
              { name: 'JOB_ID', value: job.job_id },
              { name: 'TASK_INPUT', value: JSON.stringify(job.task_input) },
              { name: 'ARTIFACT_BUCKET', value: artifactBucket },
            ],
          },
        ],
      },
    })
  );

  const taskArn = runTask.tasks?.[0]?.taskArn;
  if (!taskArn) {
    await writeMetadata(job.job_id, {
      job_id: job.job_id,
      status: 'failed',
      error_message: 'Failed to start ECS task',
      completed_at: new Date().toISOString(),
    });
    await writeStatus(job.job_id, {
      job_id: job.job_id,
      status: 'failed',
      error_message: 'Failed to start ECS task',
      completed_at: new Date().toISOString(),
    });
    return;
  }

  await waitUntilTasksStopped(
    { client: ecs, maxWaitTime: job.timeout_seconds ?? jobTimeoutSeconds },
    { cluster: clusterArn, tasks: [taskArn] }
  );

  const describe = await ecs.send(
    new DescribeTasksCommand({ cluster: clusterArn, tasks: [taskArn] })
  );

  const task = describe.tasks?.[0];
  const exitCode = task?.containers?.[0]?.exitCode ?? -1;
  const status = exitCode === 0 ? 'succeeded' : 'failed';

  await writeMetadata(job.job_id, {
    job_id: job.job_id,
    status,
    exit_code: exitCode,
    duration_ms: Date.now() - startedAt,
    completed_at: new Date().toISOString(),
    artifact_urls: [
      `s3://${artifactBucket}/jobs/${job.job_id}/artifacts/`
    ],
  });
  await writeStatus(job.job_id, {
    job_id: job.job_id,
    status,
    exit_code: exitCode,
    duration_ms: Date.now() - startedAt,
    completed_at: new Date().toISOString(),
    artifact_urls: [
      `s3://${artifactBucket}/jobs/${job.job_id}/artifacts/`
    ],
  });
}

async function receive(queueUrl: string) {
  return sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 10,
    })
  );
}

async function poll() {
  const high = await receive(highQueueUrl);
  const message = high.Messages?.[0] ?? null;
  if (message && message.Body && message.ReceiptHandle) {
    await handleMessage(message.Body);
    await sqs.send(
      new DeleteMessageCommand({
        QueueUrl: highQueueUrl,
        ReceiptHandle: message.ReceiptHandle,
      })
    );
    return;
  }

  const normal = await receive(normalQueueUrl);
  const normalMessage = normal.Messages?.[0] ?? null;
  if (!normalMessage || !normalMessage.Body || !normalMessage.ReceiptHandle) {
    return;
  }

  await handleMessage(normalMessage.Body);
  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: normalQueueUrl,
      ReceiptHandle: normalMessage.ReceiptHandle,
    })
  );
}

async function main() {
  while (true) {
    try {
      await poll();
    } catch (err) {
      console.error('Job failed:', err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
