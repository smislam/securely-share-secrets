import * as cdk from 'aws-cdk-lib';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Bucket, BucketEncryption, EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import path = require('path');

export class SecurelyShareSecretsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const secret = new Secret(this, 'secret-to-be-shared', {
      secretName: 'client-secret',
      generateSecretString: {
        excludePunctuation: true,        
        passwordLength: 32
      }
    });

    const bucket = new Bucket(this,'client-bucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: BucketEncryption.S3_MANAGED
    });
    
    const topic = new Topic(this, 'secret-sender-topic', {
      topicName: 'secret-sender-topic'
    });
    topic.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    topic.addSubscription(new EmailSubscription(StringParameter.valueForTypedStringParameterV2(this, 'client-email-address')));
    
    const sender = new NodejsFunction(this, 'secret-sender', {
      handler: 'handler',
      runtime: Runtime.NODEJS_LATEST,
      entry: path.join(__dirname, '/../lambda/secret-sender.ts'),   
      environment: {
        MY_SECRET_NAME: secret.secretName,
        BUCKET_NAME: bucket.bucketName,
        FILE_KEY: 'client-one-public.pem',
        TOPIC_ARN: topic.topicArn
      },
      logRetention: RetentionDays.ONE_DAY,
      tracing: Tracing.ACTIVE
    });
    
    const receiver = new NodejsFunction(this, 'secret-receiver', {
      handler: 'handler',
      runtime: Runtime.NODEJS_LATEST,
      entry: path.join(__dirname, '/../lambda/secret-receiver.ts'),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        FILE_KEY: 'client-one-private.pem'
      },
      logRetention: RetentionDays.ONE_DAY,
      tracing: Tracing.ACTIVE
    });

    receiver.addToRolePolicy(new PolicyStatement({
      actions: [
        'secretsmanager:CreateSecret'
      ],
      resources: ['*']      
    }));
    
    bucket.addEventNotification(EventType.OBJECT_CREATED, new LambdaDestination(sender), {
      suffix: 'pem'
    });

    topic.grantPublish(sender);
    secret.grantRead(sender);
    bucket.grantReadWrite(sender);
    bucket.grantRead(receiver);

    const api = new LambdaRestApi(this, 'secret-receiver-api', {
      handler: receiver,
    });
  }
}
