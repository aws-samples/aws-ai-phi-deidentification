#!/usr/bin/env node

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

require('dotenv').config()
const cdk = require('aws-cdk-lib');
const { IdpCdkDeidAppStack } = require('../lib/idp-cdk-app-stack');
const { IDPDeidWebDeployStack } = require('../lib/idp-cdk-web-stack');
const { IDPDeidBackendStack } = require('../lib/idp-cdk-backend-stack');
const { IDPDeidLambdaStack } = require('../lib/idp-cdk-lambda-stack');
const { IDPDeidStepFunctionStack } = require('../lib/idp-cdk-stepfunctions-stack');

const app = new cdk.App();

const deployEnv = {account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.IDP_REGION}
console.log(deployEnv)

/**
 * Creates Cognito, S3 Buckets, IAM Roles for Cognito for the React Web App
 */
const idpStack = new IdpCdkDeidAppStack(app, 'IdpCdkDeidAppStack', { env: deployEnv });



/**
 * Creates an Amplify Web App and deploys the React app as front end deployment.
 */
const webappStack = new IDPDeidWebDeployStack(app, 'IDPDeidWebDeployStack', { env: deployEnv });


/**
 * Creates S3 Buckets, SQS Queue, SNS Topic, DynamoDB Table, IAM Role for Lambda, IAM Role for AI Services to publish to SNS Topic
 */
const backendStack = new IDPDeidBackendStack(app, 'IDPDeidBackendStack', { env: deployEnv });
// backendStack.addDependency(idpStack);

/**
 * Defines and deploys all the Lambda functions used in this application. Adds Lambda as trigger to the input bucket in S3
 */

const lambdaStack = new IDPDeidLambdaStack(app, 'IDPDeidLambdaStack', {    
    env: deployEnv,
    idpInputBucket: idpStack.IDPRootBucket,
    idpLambdaRole: backendStack.IDPLambdaRole,
    compMedDataRole: backendStack.CompMedDataRole,
    idpSNSTopic: backendStack.IDPSNSTopic,
    idpCognitoAuthRole: idpStack.IDPCognitoAuthRole,
    idpTable: backendStack.IDPDynamoTable,
    idpInputBucket: idpStack.IDPRootBucket
});
lambdaStack.addDependency(backendStack);

/**
 * Creates Step Functions state machine for the IDP Wrkflow
 */

const sfnStack = new IDPDeidStepFunctionStack(app, 'IDPDeidStepFunctionStack', {
    env: deployEnv,
    // Lambda functions
    initTextractSM1: lambdaStack.IDPTextractAsync,
    textractAsyncBulk: lambdaStack.IDPTextractAsyncBulk,
    initWorkflow: lambdaStack.IDPInitWorkflow,
    getWorkflow: lambdaStack.IDPGetWorkflowFn,
    processTextractOp:lambdaStack.IDPProcessTextractOp,
    updateWorkflow :lambdaStack.IDPUpdateWorkflow,
    phiDetection: lambdaStack.IDPPhiDetection,
    phiStatusCheck: lambdaStack.IDPPhiStatusCheck,
    phiProcessOutput: lambdaStack.IDPPhiProcessOutput,
    prepRedact: lambdaStack.IDPPrepRedact,
    redactDocuments: lambdaStack.IDPRedactDocuments,
    //Shared resources
    idpInputBucket: idpStack.IDPRootBucket,
    idpTable: backendStack.IDPDynamoTable,
    idpSQSQueue: backendStack.IDPSQSQueue,    
    idpSNSTopic: backendStack.IDPSNSTopic,
    idpSNSRole: backendStack.IDPSNSRole
});
sfnStack.addDependency(lambdaStack);