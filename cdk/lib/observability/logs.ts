import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Alarm, ComparisonOperator, Metric, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';

export interface ObservabilityProps {
  highPriorityQueue: Queue;
  normalPriorityQueue: Queue;
  deadLetterQueue: Queue;
  highQueueThreshold: number;
  normalQueueThreshold: number;
  dlqThreshold: number;
}

export class Observability extends Construct {
  public readonly workerLogs: LogGroup;
  public readonly taskLogs: LogGroup;
  public readonly alarms: Alarm[];

  constructor(scope: Construct, id: string, props: ObservabilityProps) {
    super(scope, id);

    this.workerLogs = new LogGroup(this, 'WorkerLogs', {
      retention: RetentionDays.ONE_WEEK,
    });

    this.taskLogs = new LogGroup(this, 'TaskLogs', {
      retention: RetentionDays.ONE_WEEK,
    });

    const highBacklog = new Metric({
      namespace: 'AWS/SQS',
      metricName: 'ApproximateNumberOfMessagesVisible',
      dimensionsMap: { QueueName: props.highPriorityQueue.queueName },
      statistic: 'Sum',
      period: cdk.Duration.minutes(1),
    });

    const normalBacklog = new Metric({
      namespace: 'AWS/SQS',
      metricName: 'ApproximateNumberOfMessagesVisible',
      dimensionsMap: { QueueName: props.normalPriorityQueue.queueName },
      statistic: 'Sum',
      period: cdk.Duration.minutes(1),
    });

    const dlqBacklog = new Metric({
      namespace: 'AWS/SQS',
      metricName: 'ApproximateNumberOfMessagesVisible',
      dimensionsMap: { QueueName: props.deadLetterQueue.queueName },
      statistic: 'Sum',
      period: cdk.Duration.minutes(1),
    });

    this.alarms = [
      new Alarm(this, 'HighPriorityQueueBacklog', {
        metric: highBacklog,
        threshold: props.highQueueThreshold,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      }),
      new Alarm(this, 'NormalPriorityQueueBacklog', {
        metric: normalBacklog,
        threshold: props.normalQueueThreshold,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      }),
      new Alarm(this, 'DLQBacklog', {
        metric: dlqBacklog,
        threshold: props.dlqThreshold,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      }),
    ];
  }
}
