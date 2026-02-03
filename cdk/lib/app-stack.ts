import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Network } from './network/vpc';
import { Queueing } from './queueing/queues';
import { Artifacts } from './storage/artifacts';
import { Observability } from './observability/logs';
import { IamRoles } from './iam/roles';
import { Compute } from './compute/ecs';

export class BravebirdStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const network = new Network(this, 'Network');
    const queueing = new Queueing(this, 'Queueing');
    const artifacts = new Artifacts(this, 'Artifacts');
    const alarmsContext = (this.node.tryGetContext('alarms') ?? {}) as Record<string, number>;
    const observability = new Observability(this, 'Observability', {
      highPriorityQueue: queueing.highPriorityQueue,
      normalPriorityQueue: queueing.normalPriorityQueue,
      deadLetterQueue: queueing.deadLetterQueue,
      highQueueThreshold: alarmsContext.highQueueThreshold ?? 50,
      normalQueueThreshold: alarmsContext.normalQueueThreshold ?? 200,
      dlqThreshold: alarmsContext.dlqThreshold ?? 1,
    });
    const iam = new IamRoles(this, 'Iam');

    const compute = new Compute(this, 'Compute', {
      vpc: network.vpc,
      taskExecutionRole: iam.taskExecutionRole,
      taskRole: iam.taskRole,
      workerRole: iam.workerRole,
      workerLogs: observability.workerLogs,
      taskLogs: observability.taskLogs,
      highPriorityQueueUrl: queueing.highPriorityQueue.queueUrl,
      normalPriorityQueueUrl: queueing.normalPriorityQueue.queueUrl,
      artifactBucketName: artifacts.bucket.bucketName,
      statusTableName: queueing.statusTable.tableName,
    });

    new cdk.CfnOutput(this, 'HighPriorityQueueUrl', {
      value: queueing.highPriorityQueue.queueUrl,
    });

    new cdk.CfnOutput(this, 'NormalPriorityQueueUrl', {
      value: queueing.normalPriorityQueue.queueUrl,
    });

    new cdk.CfnOutput(this, 'ArtifactsBucketName', {
      value: artifacts.bucket.bucketName,
    });

    new cdk.CfnOutput(this, 'RateLimitTableName', {
      value: queueing.rateLimitTable.tableName,
    });

    new cdk.CfnOutput(this, 'JobStatusTableName', {
      value: queueing.statusTable.tableName,
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: compute.cluster.clusterName,
    });
  }
}
