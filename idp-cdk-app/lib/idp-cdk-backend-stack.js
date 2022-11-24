// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * Deploys resources required for the backend orchestration
 * - Amazon SQS Queue for job submission
 * - Amazon SNS Topic for Async Job completion notification
 * - IAM Role that is assumable by Textract and Comprehend for SNS
 * - IAM Role for Lambda Function
 * - Amazon DynamoDB table required to keep track of the workflow
 */

const { Stack, RemovalPolicy, Duration } = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const iam = require('aws-cdk-lib/aws-iam');
const sqs = require('aws-cdk-lib/aws-sqs');
const sns = require('aws-cdk-lib/aws-sns');

class IDPDeidBackendStack extends Stack{

    static IDPDynamoTable;    
    static IDPSQSQueue;
    static IDPSNSTopic;
    static IDPSNSRole;
    static IDPLambdaRole;
    static CompMedDataRole;

    constructor(scope, id, props){
        super(scope, id, props);

        /******
         * DynamoDB Table
         *****/
        const idpTable = new dynamodb.Table(this, `idp-poc-${process.env.DOMAIN_NAME}`, {
                                                removalPolicy: RemovalPolicy.DESTROY,
                                                tableName: `idp-poc-${process.env.DOMAIN_NAME}`,
                                                partitionKey: {
                                                    name: 'part_key',
                                                    type: dynamodb.AttributeType.STRING
                                                },
                                                sortKey:{
                                                    name: 'sort_key',
                                                    type: dynamodb.AttributeType.STRING
                                                },
                                                encryption: dynamodb.TableEncryption.AWS_MANAGED,
                                                writeCapacity: 5
                                            });
                                            
        const readScaling = idpTable.autoScaleReadCapacity({minCapacity: 5, maxCapacity: 100});
        readScaling.scaleOnUtilization({ targetUtilizationPercent: 50 });

        const writeScaling = idpTable.autoScaleWriteCapacity({ minCapacity: 5, maxCapacity: 100});
        writeScaling.scaleOnUtilization({ targetUtilizationPercent: 50 });
        this.IDPDynamoTable = idpTable;

        /******
         * SNS Topic
         *****/    
        const idpSnsTopic = new sns.Topic(this, `idp-poc-sns-${process.env.DOMAIN_NAME}`, {
                                            topicName: `idp-poc-sns-${process.env.DOMAIN_NAME}`                                            
                                        });
        this.IDPSNSTopic = idpSnsTopic;

        // This role will be used in calls to Textract or Comprehend APIs
        // so that async jobs can send job status notifications to SNS

        const aiSNSRole = new iam.Role(this, 'idp-deid-ai-service-sns-role', {
                                            roleName: 'idp-deid-ai-sns-role',
                                            assumedBy: new iam.CompositePrincipal(
                                                        new iam.ServicePrincipal('textract.amazonaws.com'),
                                                        new iam.ServicePrincipal('comprehend.amazonaws.com'))               
                                        });

        aiSNSRole.addToPolicy(new iam.PolicyStatement({
                                            effect: iam.Effect.ALLOW,
                                            resources: [idpSnsTopic.topicArn],
                                            actions: ["sns:Publish"]
                                        }));
        this.IDPSNSRole = aiSNSRole;
        /******
         * SQS Queues
         *****/

        //SQS Queue for Textract Async Job Submission
        const idpSqsQueue = new sqs.Queue(this, `idp-poc-sqs-${process.env.DOMAIN_NAME}`, {
                                            queueName: `idp-poc-sqs-${process.env.DOMAIN_NAME}`,
                                            visibilityTimeout: Duration.seconds(30),
                                            retentionPeriod: Duration.seconds(1209600),
                                            encryption: sqs.QueueEncryption.KMS_MANAGED
                                        });
        this.IDPSQSQueue = idpSqsQueue.queueUrl;

        /**
         * IAM Data access role for Comprehend Medical
         * 
         */
        // IAM Roles    
        const comprehendMedDataRole = new iam.Role(this, 'idp-comp-med-data-role',{
            roleName: 'idp-comp-med-data-role',
            assumedBy: new iam.ServicePrincipal('comprehendmedical.amazonaws.com'),
            inlinePolicies: {
                "s3-access-policies": new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            sid: "CompMedS3Access",
                            effect: iam.Effect.ALLOW,
                            actions: [
                                "s3:GetObject",
                                "s3:ListBucket",
                                "s3:PutObject"
                            ],
                            resources: ["*"]
                        })
                    ]
                })
            }
        });

        this.CompMedDataRole = comprehendMedDataRole;

        /******
         * IAM Role for Lambda Functions
         *****/
        // Custom IAM Role for Lambda Functions
        const lambdaRole = new iam.Role(this, 'idp-deid-poc-lambda-execution-role',{
            roleName: 'idp-deid-poc-lambda-execution-role',
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"),
                                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
                                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonCognitoPowerUser"),                                
                                // iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonTextractFullAccess"),
                                // iam.ManagedPolicy.fromAwsManagedPolicyName("ComprehendFullAccess"),
                                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaSQSQueueExecutionRole")
                            ],
            inlinePolicies:{
                "idp-ai-policy": new iam.PolicyDocument({
                    statements: [                    
                        new iam.PolicyStatement({
                            sid: "IDPAiServicesAccess",
                            effect: iam.Effect.ALLOW,
                            actions: [
                                "textract:AnalyzeDocument",
                                "textract:DetectDocumentText",
                                "textract:GetDocumentAnalysis",
                                "textract:GetDocumentTextDetection",
                                "textract:StartDocumentAnalysis",
                                "textract:StartDocumentTextDetection",
                                "comprehendmedical:DetectPHI",
                                "comprehendmedical:StartPHIDetectionJob",
                                "comprehendmedical:StopPHIDetectionJob",
                                "comprehendmedical:ListPHIDetectionJobs",
                                "comprehendmedical:DescribePHIDetectionJob"
                            ],
                            resources: ["*"]
                        })
                    ]
                }),
                "idp-lambda-dynamodb-policy": new iam.PolicyDocument({
                    statements: [                    
                        new iam.PolicyStatement({
                            sid: "DynamoDBTableAccess",
                            effect: iam.Effect.ALLOW,
                            actions: [
                                "dynamodb:PartiQLInsert",
                                "dynamodb:PartiQLUpdate",
                                "dynamodb:PartiQLDelete",
                                "dynamodb:PartiQLSelect"
                            ],
                            resources: ["*"]
                        })
                    ]
                }),
                "idp-lambda-s3-policy": new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            sid: "LambdaS3Access",
                            effect: iam.Effect.ALLOW,
                            actions: [
                                "s3:ListBucket",
                                "s3:DeleteObject",
                                "s3:GetObject",
                                "s3:PutObject",
                                "s3:PutObjectAcl"
                            ],
                            resources: ["*"]
                        })
                    ]
                }),
                "idp-lambda-sqs-sf-policy": new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            sid: "LambdaSQSSFAccess",
                            effect: iam.Effect.ALLOW,
                            actions: [
                                "sqs:SendMessage",
                                "sqs:ListQueues",
                                "states:ListStateMachines",
                                "states:ListActivities",
                                "states:DescribeStateMachine",
                                "states:StartExecution",
                                "states:SendTaskSuccess",
                                "states:ListExecutions",
                                "states:StopExecution",
                                "states:GetExecutionHistory",
                                "lambda:InvokeAsync",
                                "lambda:InvokeFunction"
                            ],
                            resources: ["*"]
                        })
                    ]
                })
            }
        });

        lambdaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["iam:PassRole"],
            resources: [comprehendMedDataRole.roleArn],
        }))

        this.IDPLambdaRole = lambdaRole;        
    }
}

module.exports = { IDPDeidBackendStack }