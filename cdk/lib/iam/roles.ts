import { Construct } from 'constructs';
import { Role, ServicePrincipal, ManagedPolicy, PolicyStatement } from 'aws-cdk-lib/aws-iam';

export class IamRoles extends Construct {
  public readonly taskExecutionRole: Role;
  public readonly taskRole: Role;
  public readonly workerRole: Role;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.taskExecutionRole = new Role(this, 'TaskExecutionRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    this.taskRole = new Role(this, 'TaskRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    this.workerRole = new Role(this, 'WorkerRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    this.taskRole.addToPolicy(
      new PolicyStatement({
        actions: ['s3:PutObject'],
        resources: ['*'],
      })
    );

    this.workerRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
          'sqs:GetQueueAttributes',
          'sqs:ChangeMessageVisibility',
        ],
        resources: ['*'],
      })
    );

    this.workerRole.addToPolicy(
      new PolicyStatement({
        actions: ['ecs:RunTask', 'ecs:DescribeTasks', 'ecs:StopTask'],
        resources: ['*'],
      })
    );

    this.workerRole.addToPolicy(
      new PolicyStatement({
        actions: ['iam:PassRole'],
        resources: ['*'],
      })
    );

    this.workerRole.addToPolicy(
      new PolicyStatement({
        actions: ['s3:PutObject'],
        resources: ['*'],
      })
    );

    this.workerRole.addToPolicy(
      new PolicyStatement({
        actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem'],
        resources: ['*'],
      })
    );
  }
}
