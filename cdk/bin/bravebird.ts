#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BravebirdStack } from '../lib/app-stack';

const app = new cdk.App();

new BravebirdStack(app, 'BravebirdStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
