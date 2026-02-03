import { Construct } from 'constructs';
import { Cluster, FargateService, FargateTaskDefinition, LogDrivers, ContainerImage } from 'aws-cdk-lib/aws-ecs';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { Vpc, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Role } from 'aws-cdk-lib/aws-iam';
import { LogGroup } from 'aws-cdk-lib/aws-logs';

export interface ComputeProps {
  vpc: Vpc;
  taskExecutionRole: Role;
  taskRole: Role;
  workerRole: Role;
  workerLogs: LogGroup;
  taskLogs: LogGroup;
  highPriorityQueueUrl: string;
  normalPriorityQueueUrl: string;
  artifactBucketName: string;
  statusTableName: string;
}

export class Compute extends Construct {
  public readonly cluster: Cluster;
  public readonly agentTask: FargateTaskDefinition;
  public readonly workerService: FargateService;
  public readonly taskSecurityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props: ComputeProps) {
    super(scope, id);

    this.cluster = new Cluster(this, 'Cluster', {
      vpc: props.vpc,
    });

    this.taskSecurityGroup = new SecurityGroup(this, 'TaskSecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: true,
    });

    this.agentTask = new FargateTaskDefinition(this, 'AgentTask', {
      taskRole: props.taskRole,
      executionRole: props.taskExecutionRole,
      cpu: 512,
      memoryLimitMiB: 1024,
    });

    this.agentTask.addContainer('agent', {
      image: ContainerImage.fromAsset('../services/agent', {
        platform: Platform.LINUX_AMD64,
      }),
      logging: LogDrivers.awsLogs({
        logGroup: props.taskLogs,
        streamPrefix: 'agent',
      }),
      environment: {
        ARTIFACT_BUCKET: props.artifactBucketName,
        BLOCK_METADATA: 'true',
        AWS_EC2_METADATA_DISABLED: 'true',
      },
    });

    const workerTask = new FargateTaskDefinition(this, 'WorkerTask', {
      taskRole: props.workerRole,
      executionRole: props.taskExecutionRole,
      cpu: 512,
      memoryLimitMiB: 1024,
    });

    workerTask.addContainer('worker', {
      image: ContainerImage.fromAsset('../services/worker', {
        platform: Platform.LINUX_AMD64,
      }),
      logging: LogDrivers.awsLogs({
        logGroup: props.workerLogs,
        streamPrefix: 'worker',
      }),
      environment: {
        HIGH_QUEUE_URL: props.highPriorityQueueUrl,
        NORMAL_QUEUE_URL: props.normalPriorityQueueUrl,
        CLUSTER_ARN: this.cluster.clusterArn,
        TASK_DEF_ARN: this.agentTask.taskDefinitionArn,
        SUBNETS: props.vpc.selectSubnets({ subnetGroupName: 'private' }).subnetIds.join(','),
        SECURITY_GROUPS: this.taskSecurityGroup.securityGroupId,
        ARTIFACT_BUCKET: props.artifactBucketName,
        STATUS_TABLE: props.statusTableName,
      },
    });

    this.workerService = new FargateService(this, 'WorkerService', {
      cluster: this.cluster,
      taskDefinition: workerTask,
      desiredCount: 1,
      assignPublicIp: false,
      securityGroups: [this.taskSecurityGroup],
      vpcSubnets: props.vpc.selectSubnets({ subnetGroupName: 'private' }),
    });
  }
}
