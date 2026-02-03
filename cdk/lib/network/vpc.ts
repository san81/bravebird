import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc, SubnetType } from 'aws-cdk-lib/aws-ec2';

export interface NetworkProps {
  maxAzs?: number;
}

export class Network extends Construct {
  public readonly vpc: Vpc;

  constructor(scope: Construct, id: string, props: NetworkProps = {}) {
    super(scope, id);

    this.vpc = new Vpc(this, 'Vpc', {
      maxAzs: props.maxAzs ?? 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: SubnetType.PUBLIC },
        { name: 'private', subnetType: SubnetType.PRIVATE_WITH_EGRESS }
      ],
    });

    // Placeholder for VPC flow logs and additional network hardening.
    void Duration.seconds(0);
  }
}
