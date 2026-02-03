import { Construct } from 'constructs';
import { Queue, DeadLetterQueue } from 'aws-cdk-lib/aws-sqs';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Duration } from 'aws-cdk-lib';

export class Queueing extends Construct {
  public readonly highPriorityQueue: Queue;
  public readonly normalPriorityQueue: Queue;
  public readonly deadLetterQueue: Queue;
  public readonly rateLimitTable: Table;
  public readonly statusTable: Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.deadLetterQueue = new Queue(this, 'DeadLetterQueue', {
      retentionPeriod: Duration.days(14),
    });

    const dlq: DeadLetterQueue = {
      maxReceiveCount: 3,
      queue: this.deadLetterQueue,
    };

    this.highPriorityQueue = new Queue(this, 'HighPriorityQueue', {
      visibilityTimeout: Duration.minutes(10),
      deadLetterQueue: dlq,
    });

    this.normalPriorityQueue = new Queue(this, 'NormalPriorityQueue', {
      visibilityTimeout: Duration.minutes(10),
      deadLetterQueue: dlq,
    });

    this.rateLimitTable = new Table(this, 'RateLimitTable', {
      partitionKey: { name: 'user_id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    this.statusTable = new Table(this, 'JobStatusTable', {
      partitionKey: { name: 'job_id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });
  }
}
