const { Stack, CfnOutput, Duration } = require('aws-cdk-lib');
const { S3EventSource, SnsEventSource } = require('aws-cdk-lib/aws-lambda-event-sources');
const iam = require('aws-cdk-lib/aws-iam');
const s3 = require('aws-cdk-lib/aws-s3');
const lambda = require('aws-cdk-lib/aws-lambda');
const cr = require('aws-cdk-lib/custom-resources');
const path = require('path');

class IDPDeidLambdaStack extends Stack{
    
    static IDPTextractAsync;
    static IDPInitWorkflow;
    static IDPGetWorkflowFn;
    static IDPProcessTextractOp;
    static IDPUpdateWorkflow;
    static IDPTextractAsyncBulk;
    static IDPPhiDetection;
    static IDPPhiStatusCheck;
    static IDPPhiProcessOutput;
    static IDPPrepRedact;
    static IDPRedactDocuments;    

    constructor(scope, id, props){
        super(scope, id, props);
        
        const inputBucketName = props.idpInputBucket.bucketName;

        /**
         * Lambda as S3 trigger to invoke Step Function IDP flow
         */

        const idpInitSMFn = new lambda.DockerImageFunction(this, 'idp-poc-init-state-machine',{
            functionName: 'idp-poc-init-state-machine',
            description: 'IDP Lambda Function set as S3 trigger to invoke AWS Step Function State Machine',
            code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../src/lambda'), {
                        cmd: [ "idp-init-state-machine.lambda_handler" ],
                        entrypoint: ["/lambda-entrypoint.sh"],
                    }),
            role: props.idpLambdaRole,
            timeout: Duration.minutes(1),
            memorySize: 128
        });

        this.IDPInitWorkflow = idpInitSMFn;

        //Add the Lambda as a trigger to the IDP Input bucket prefix public/workflows/
        /**
         * Adding S3 Trigger with the S3 bucket object directly causes cyclic dependency in the stacks
         * as explained here - 
         * https://aws.amazon.com/blogs/mt/resolving-circular-dependency-in-provisioning-of-amazon-s3-buckets-with-aws-lambda-event-notifications/
         * So we will import a bucket using fromBucketName and use that instead
         */

        const inputIDPBucket = s3.Bucket.fromBucketName(this, 'temp-idp-input-bkt', inputBucketName)
        
        idpInitSMFn.addEventSource(new S3EventSource(inputIDPBucket, {
            events: [s3.EventType.OBJECT_CREATED],
            filters: [{ prefix: 'public/workflows/'}]
        }));
        
        
        const initTextractFn = new lambda.DockerImageFunction(this, 'idp-poc-init-textract-process',{
            functionName: 'idp-poc-init-textract-process',
            description: 'IDP Lambda Function to process docs using StartDocumentAnalysis from Step Function',
            code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../src/lambda'), {
                        cmd: [ "idp-init-textract.lambda_handler" ],
                        entrypoint: ["/lambda-entrypoint.sh"],
                    }),
            role: props.idpLambdaRole,
            timeout: Duration.minutes(5),
            memorySize: 128
        });

        this.IDPTextractAsync = initTextractFn;


        /**
         * Lambda function for the UI (client) to get data from DynamoDB table
         */
        const idpGetWorkflowFn = new lambda.DockerImageFunction(this, 'idp-poc-get-workflow',{
            functionName: 'idp-poc-get-workflow',
            description: 'IDP Lambda Function to get workflow records from DynamoDB',
            code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../src/lambda'), {
                        cmd: [ "idp-get-workflows.lambda_handler" ],
                        entrypoint: ["/lambda-entrypoint.sh"],
                    }),
            environment:{
                LOG_LEVEL: 'DEBUG',
                IDP_TABLE: props.idpTable.tableName,                
                IDP_BKT: inputBucketName
            },
            role: props.idpLambdaRole,
            timeout: Duration.seconds(10),
            memorySize: 128
        });        

        const idpGetWorkflowFnURL = idpGetWorkflowFn.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.AWS_IAM,
            cors:{
                allowedOrigins: ['*'],
                allowedMethods: ['GET','POST'],
                allowedHeaders: ['*']
            }
        });

        new CfnOutput(this, 'idp-get-wf-lambda-url', {
            value: idpGetWorkflowFnURL.url,
            description: 'IDP Get Workflows Lambda URL',
            exportName: 'idpGetWfFunctionUrl'
        });

        this.IDPGetWorkflowFn = idpGetWorkflowFn;
        new cr.AwsCustomResource(this, 'update-getwf-url-lambda-permission', {
            onCreate: {
                service: 'Lambda',
                action: 'addPermission',
                parameters: {
                    FunctionName: idpGetWorkflowFn.functionArn,
                    Action: "lambda:InvokeFunctionUrl",
                    Principal: props.idpCognitoAuthRole,
                    StatementId: "lambda-function-url-invoke-policy",
                    FunctionUrlAuthType: "AWS_IAM"
                },
                physicalResourceId: cr.PhysicalResourceId.of(`lambda-getwf-url-update`),
                },
                policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                            resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
                        }),
                installLatestAwsSdk: true
        });

        /**
         * Lambda function to update the workflow Item in Dynamo DB 
         */
         const idpUpdateWorkflowFn = new lambda.DockerImageFunction(this, 'idp-poc-update-workflow',{
            functionName: 'idp-poc-update-workflow',
            description: 'IDP Updates the workflow status in Dynamo db',
            code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../src/lambda'), {
                        cmd: [ "idp-update-wf-status.lambda_handler" ],
                        entrypoint: ["/lambda-entrypoint.sh"],
                    }),
            environment:{
                LOG_LEVEL: 'DEBUG',
                IDP_TABLE: props.idpTable.tableName
            },
            role: props.idpLambdaRole,
            timeout: Duration.minutes(2),
            memorySize: 128
        }); 

        this.IDPUpdateWorkflow = idpUpdateWorkflowFn;

        /**
         * Lambda function to generate textract JSON and Excel report. Called from IDPTextractAsyncBulk asynchronously
         */
        const idpProcessTextractOpFn = new lambda.DockerImageFunction(this, 'idp-poc-process-textract-op',{
            functionName: 'idp-poc-process-textract-op',
            description: 'IDP Lambda Function to to Process Textract outputs',
            code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../src/lambda'), {
                        cmd: [ "idp-process-textract-output.lambda_handler" ],
                        entrypoint: ["/lambda-entrypoint.sh"],
                    }),
            environment:{
                LOG_LEVEL: 'DEBUG',
                IDP_TABLE: props.idpTable.tableName,
                IDP_BKT: inputBucketName
            },
            role: props.idpLambdaRole,
            timeout: Duration.minutes(10),
            memorySize: 256
        }); 

        this.IDPProcessTextractOp = idpProcessTextractOpFn;                

        /**
         * Lambda function subscribes to the Textract SNS topic to get job completion notifications, call the post process lambda to genereate report, and process remaining documents
         * for the workflow (if any)
         */
         const initTextractBulkFn = new lambda.DockerImageFunction(this, 'idp-poc-init-textract-process-bulk',{
            functionName: 'idp-poc-init-textract-process-bulk',
            description: 'IDP Lambda Function to process docs using StartDocumentAnalysis from Step Function and post process output from job completions',
            code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../src/lambda'), {
                        cmd: [ "idp-init-textract-bulk.lambda_handler" ],
                        entrypoint: ["/lambda-entrypoint.sh"],
                    }),
            role: props.idpLambdaRole,
            timeout: Duration.minutes(10),
            memorySize: 128
        });

        this.IDPTextractAsyncBulk = initTextractBulkFn;

        // Subscribe to the SNS Topic where Textract will send notifications
        initTextractBulkFn.addEventSource(new SnsEventSource(props.idpSNSTopic));

        /**
         * Lambda function to detect PHI entities
         */
        const idpPhiDetection = new lambda.DockerImageFunction(this, 'idp-poc-phi-detection', {
            functionName: 'idp-poc-phi-detection',
            description: 'IDP Lambda function to detect PHI using Amazon Comprehend Medical StartPHIDetectionJob async API',
            code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../src/lambda'), {
                        cmd: [ "idp-init-phi-detection.lambda_handler" ],
                        entrypoint: ["/lambda-entrypoint.sh"],
                    }),
            environment:{
                LOG_LEVEL: 'DEBUG',
                IAM_ROLE: props.compMedDataRole.roleArn,
                IDP_TABLE: props.idpTable.tableName
            },
            role: props.idpLambdaRole,
            timeout: Duration.minutes(10),
            memorySize: 128
        });

        this.IDPPhiDetection = idpPhiDetection;

        /**
         * Lambda function to check PHI detection Job status
         */

         const idpPhiStatusCheck = new lambda.DockerImageFunction(this, 'idp-poc-phi-status-check', {
            functionName: 'idp-poc-phi-status-check',
            description: 'IDP Lambda function to check status of Amazon Comprehend Medical PHI Detection Job',
            code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../src/lambda'), {
                        cmd: [ "idp-phi-job-status-check.lambda_handler" ],
                        entrypoint: ["/lambda-entrypoint.sh"],
                    }),
            environment:{
                LOG_LEVEL: 'DEBUG',
                IDP_TABLE: props.idpTable.tableName
            },
            role: props.idpLambdaRole,
            timeout: Duration.minutes(13),
            memorySize: 128
        });

        this.IDPPhiStatusCheck = idpPhiStatusCheck;

        /**
         * Lambda function to process the PHI output files
         */

         const idpPhiProcessOutput = new lambda.DockerImageFunction(this, 'idp-poc-phi-process-output', {
            functionName: 'idp-poc-phi-process-output',
            description: 'IDP Lambda function to process output of Amazon Comprehend Medical PHI Detection Job and copy original documents',
            code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../src/lambda'), {
                        cmd: [ "idp-process-phi-output.lambda_handler" ],
                        entrypoint: ["/lambda-entrypoint.sh"],
                    }),
            environment:{
                LOG_LEVEL: 'DEBUG',
                IDP_TABLE: props.idpTable.tableName
            },
            role: props.idpLambdaRole,
            timeout: Duration.minutes(10),
            memorySize: 128
        });

        this.IDPPhiProcessOutput = idpPhiProcessOutput;


        /**
         * Lambda function to prep documents for redaction
         */

         const idpPrepRedact = new lambda.DockerImageFunction(this, 'idp-poc-prep-redact', {
            functionName: 'idp-poc-prep-redact',
            description: 'IDP Lambda function to prepare documents for redaction and converts TIFF files to PDF (if any)',
            code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../src/lambda'), {
                        cmd: [ "idp-prep-doc-for-redaction.lambda_handler" ],
                        entrypoint: ["/lambda-entrypoint.sh"],
                    }),
            environment:{
                LOG_LEVEL: 'DEBUG'
            },
            role: props.idpLambdaRole,
            timeout: Duration.minutes(15),
            memorySize: 256
        });

        this.IDPPrepRedact = idpPrepRedact;

        /**
         * Lambda function to redact documents
         */

         const idpRedactDocuments = new lambda.DockerImageFunction(this, 'idp-poc-redact-documents', {
            functionName: 'idp-poc-redact-documents',
            description: 'IDP Lambda function that uses PHI entities and Amazon Textract geometry to redact documents',
            code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../src/lambda'), {
                        cmd: [ "idp-phi-redact-doc.lambda_handler" ],
                        entrypoint: ["/lambda-entrypoint.sh"],
                    }),
            environment:{
                LOG_LEVEL: 'DEBUG'
            },
            role: props.idpLambdaRole,
            timeout: Duration.minutes(15),
            memorySize: 256
        });

        this.IDPRedactDocuments = idpRedactDocuments;
        
    }
}

module.exports = { IDPDeidLambdaStack }