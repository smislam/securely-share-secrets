#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SecurelyShareSecretsStack } from '../lib/securely-share-secrets-stack';

const app = new cdk.App();
new SecurelyShareSecretsStack(app, 'SecurelyShareSecretsStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});