// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { Stack } = require('aws-cdk-lib');
const sfn = require('aws-cdk-lib/aws-stepfunctions');
const cr = require('aws-cdk-lib/custom-resources');
const tasks = require('aws-cdk-lib/aws-stepfunctions-tasks');
const path = require('path');


class IDPDeidStepFunctionStack extends Stack{    
    constructor(scope, id, props){
        super(scope, id, props);
        const inputBucketName = props.idpInputBucket.bucketName;

        /**
         * Step Functions Task Definitions
         */                
        const idpTextractAsyncStep = new tasks.LambdaInvoke(this, "idp-textract-async-sm", {
          comment: "Process Docs Textract Async",
          lambdaFunction: props.initTextractSM1,
          integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
          payload: sfn.TaskInput.fromObject({
              // SNS Notification must contain this task token, workflow id (part_key) and document ID (sort_key). We will use AsyncJobs ClientRequestToken and JobTag
              // The job tag will be included in the SNS notification message
              token: sfn.JsonPath.taskToken,  
              // the lambda function is invoked with json { 'data': { 'workflow_id': 'xxxx', 'bucket': 'xxx' } 
              // which is the payload used to invoke the state machine       
              workflow_id: sfn.JsonPath.stringAt('$.workflow_id'),
              bucket: sfn.JsonPath.stringAt('$.bucket')
          }),
          outputPath: '$.Payload',                                            
        });

        const idpTextractAsyncStatusUpdateStep = new tasks.LambdaInvoke(this, "idp-update-workflow-status", {
          comment: "Update workflow status",
          lambdaFunction: props.updateWorkflow,
          payload: sfn.TaskInput.fromObject({                                              
            workflow_id: sfn.JsonPath.stringAt('$.workflow_id'),
            bucket: sfn.JsonPath.stringAt('$.bucket'),
            tmp_process_dir: sfn.JsonPath.stringAt('$.tmp_process_dir'),
            phi_input_dir: sfn.JsonPath.stringAt('$.phi_input_dir')
          }),
          outputPath: '$.Payload'
        });

        const phiDetectionStep = new tasks.LambdaInvoke(this, "idp-phi-detection", {
          comment: "Start PHI detection Job",
          lambdaFunction: props.phiDetection,
          payload: sfn.TaskInput.fromObject({                                              
            workflow_id: sfn.JsonPath.stringAt('$.workflow_id'),
            bucket: sfn.JsonPath.stringAt('$.bucket'),
            de_identify: sfn.JsonPath.stringAt('$.de_identify'),
            phi_input_dir: sfn.JsonPath.stringAt('$.phi_input_dir')
          }),
          outputPath: '$.Payload'
        });

        const phiStatusCheckStep = new tasks.LambdaInvoke(this, "idp-phi-detection-status-check", {                                                                            
          comment: "idp-phi-detection-status-check",
          lambdaFunction: props.phiStatusCheck,
          payload: sfn.TaskInput.fromObject({                                              
            workflow_id: sfn.JsonPath.stringAt('$.workflow_id'),
            phi_job_id: sfn.JsonPath.stringAt('$.phi_job_id'),
            phi_output_dir: sfn.JsonPath.stringAt('$.phi_output_dir'),
            bucket: sfn.JsonPath.stringAt('$.bucket')
          }),
          outputPath: '$.Payload'
        });

        const phiPostProcess = new tasks.LambdaInvoke(this, "idp-phi-post-process", {                                                                            
          comment: "idp-phi-post-process",
          lambdaFunction: props.phiProcessOutput,
          payload: sfn.TaskInput.fromObject({                                              
            bucket: sfn.JsonPath.stringAt('$.bucket'),
            workflow_id: sfn.JsonPath.stringAt('$.workflow_id'),
            phi_output_dir: sfn.JsonPath.stringAt('$.phi_output_dir')
          }),
          outputPath: '$.Payload'
        });

        //prep documents for redact
        const prepRedactDocuments = new tasks.LambdaInvoke(this, "idp-prep-documents-for-redaction", {                                                                            
          comment: "idp-prep-documents-for-redaction",
          lambdaFunction: props.prepRedact,
          payload: sfn.TaskInput.fromObject({                                              
            bucket: sfn.JsonPath.stringAt('$.bucket'),
            workflow_id: sfn.JsonPath.stringAt('$.workflow_id'),
            retain_docs: sfn.JsonPath.stringAt('$.retain_docs'),
            doc_prefixes: sfn.JsonPath.stringAt('$.doc_prefixes'),
          }),
          outputPath: '$.Payload'
        });

        //redactDocuments
        const redactDocuments = new tasks.LambdaInvoke(this, "idp-redact-documents", {                                                                            
          comment: "idp-redact-documents",
          lambdaFunction: props.redactDocuments,
          payload: sfn.TaskInput.fromObject({                                              
            bucket: sfn.JsonPath.stringAt('$.bucket'),
            workflow_id: sfn.JsonPath.stringAt('$.workflow_id'),
            retain_docs: sfn.JsonPath.stringAt('$.retain_docs'),
            redact_data: sfn.JsonPath.stringAt('$.redact_data'),
          }),
          outputPath: '$.Payload'
        });

        const phiStatusUpdate = new tasks.DynamoUpdateItem(this, 'idp-phi-status-finalize', {                    
          key:{
            part_key: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.workflow_id')),
            sort_key: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.input_prefix'))
          },
          table: props.idpTable,
          expressionAttributeValues: {
            ':status': tasks.DynamoAttributeValue.fromString('processed')
          },
          updateExpression: 'SET de_identification_status = :status'
        });

        const finalStep = new sfn.Succeed(this, "processSuccess", {comment: "End Flow"});

        /**
         * Failure steps
         */
        const phiJobFailed =  new sfn.Fail(this, 'PhiJobFailed', {
                                  error: 'PHIJobFailure',
                                  cause: "Amazon Comprehend Medical Detect PHI Job failed or stopped",
                                  });
        

        const phiJobLaunchFail= new sfn.Fail(this, 'PhiJobLaunchFail', {
                                                          error: 'PHIJobLaunchFailure',
                                                          cause: "Unable to Launch PHI detection Job",
                                                        });

        const phiPostProcessFail= new sfn.Fail(this, 'PhiPostProcessFail', {
                                                                error: 'PhiPostProcessFail',
                                                                cause: "PHI Output Post-processing failed",
                                                              });

        /**
         * Step Functions flow definitions
         */
        const redactionChain = sfn.Chain.start(prepRedactDocuments)
                               .next(redactDocuments);

        const redactMap = new sfn.Map(this, 'redact-documents', {
                                                  inputPath: sfn.JsonPath.stringAt('$'),
                                                  itemsPath: sfn.JsonPath.stringAt('$.doc_list'),                                                  
                                                  parameters:{
                                                    "workflow_id": sfn.JsonPath.stringAt('$.workflow_id'),
                                                    "retain_docs": sfn.JsonPath.stringAt('$.retain_docs'),
                                                    "bucket": sfn.JsonPath.stringAt('$.bucket'),
                                                    "doc_prefixes": sfn.JsonPath.stringAt("$$.Map.Item.Value")                                                    
                                                  },
                                                  // DISCARD sends the Map Task input to its Output which goes as input to next state i.e. phiStatusUpdate
                                                  resultPath: sfn.JsonPath.DISCARD 
                                                });
        redactMap.iterator(redactionChain);

        const redactMapChain = sfn.Chain.start(redactMap)
                               .next(phiStatusUpdate)
                               .next(finalStep);

        const postProcessChain = sfn.Chain.start(phiPostProcess)
                                 .next(new sfn.Choice(this, "Post-processing successful?")
                                       .when(sfn.Condition.isPresent('$.error'), phiPostProcessFail)
                                       .otherwise(redactMapChain));

        const phiStatusCheckChain = sfn.Chain.start(phiStatusCheckStep)
                                    .next(new sfn.Choice(this, "Job in-progress?")
                                          .when(sfn.Condition.or(sfn.Condition.stringEquals('$.status', 'IN_PROGRESS'), 
                                                                  sfn.Condition.stringEquals('$.status', 'SUBMITTED'), 
                                                                  sfn.Condition.stringEquals('$.status', 'STOP_REQUESTED')), 
                                                phiStatusCheckStep)
                                          .when(sfn.Condition.or(sfn.Condition.stringEquals('$.status', 'FAILED'), 
                                                                  sfn.Condition.stringEquals('$.status', 'STOPPED')), 
                                                phiJobFailed)
                                          .otherwise(postProcessChain));

        const phiProcessChain = sfn.Chain.start(phiDetectionStep)
                                .next(new sfn.Choice(this, "Job launched successfully?")
                                      .when(sfn.Condition.isNull('$.phi_job_id'),
                                            phiJobLaunchFail)
                                      .otherwise(phiStatusCheckChain));
                                  

        const sfDefinitions = idpTextractAsyncStep                                       
                              .next(idpTextractAsyncStatusUpdateStep)
                              .next(new sfn.Choice(this, "De-identify documents?")
                                    .when(sfn.Condition.booleanEquals('$.de_identify', true), phiProcessChain)
                                    .otherwise(finalStep));

        /**
         * Define Step Function
         * Step 1 : props.initTextractSM1 Lambda
         */

        const idpStateMachine = new sfn.StateMachine(this, 'idp-workflow-state-machine', {
                                            stateMachineName: 'idp-workflow-state-machine',                        
                                            definition: sfDefinitions
                                        });


        /**
         * Following sections updates some of the AWS Lambda function environment ariables using custom resources
         */
        
        /**
         * Update Init Workflow Lambda Function environment variables
         */
        const physicalResourcePolicy = cr.AwsCustomResourcePolicy.fromSdkCalls({
                                            resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
                                        });
        const sdkAction1 = {
            service: 'Lambda',
            action: 'updateFunctionConfiguration',
            parameters: {
              FunctionName: props.initWorkflow.functionArn,
              Environment: {
                Variables: {
                    LOG_LEVEL: 'DEBUG',
                    IDP_QUEUE: props.idpSQSQueue,
                    IDP_TABLE: props.idpTable.tableName,
                    STATE_MACHINE: idpStateMachine.stateMachineArn,
                },
              },
            },
            physicalResourceId: cr.PhysicalResourceId.of(`lambda-initWorkflow-update`),
          };
        new cr.AwsCustomResource(this, 'update-init-lambda-environ', {
            onCreate: sdkAction1,
            onUpdate: sdkAction1,
            policy: physicalResourcePolicy,
            installLatestAwsSdk: true
        });

        /**
         * Update Textract Async Lambda Function environment variables 
         */
        const sdkAction2 = {
            service: 'Lambda',
            action: 'updateFunctionConfiguration',
            parameters: {
              FunctionName: props.initTextractSM1.functionArn,
              Environment: {
                Variables: {
                    LOG_LEVEL: 'DEBUG',
                    IDP_QUEUE: props.idpSQSQueue,
                    IDP_TABLE: props.idpTable.tableName,
                    IDP_INPUT_BKT: inputBucketName,
                    SNS_TOPIC: props.idpSNSTopic.topicArn,
                    SNS_ROLE: props.idpSNSRole.roleArn
                },
              },
            },
            physicalResourceId: cr.PhysicalResourceId.of(`lambda-textractasync-update`),
          };
        
        new cr.AwsCustomResource(this, 'update-textractasync-lambda-environ', {
                onCreate: sdkAction2,
                onUpdate: sdkAction2,
                policy: physicalResourcePolicy,
                installLatestAwsSdk: true
        });

        /**
         * Update Textract Async Lambda Function environment variables 
         */
         const sdkAction3 = {
          service: 'Lambda',
          action: 'updateFunctionConfiguration',
          parameters: {
            FunctionName: props.textractAsyncBulk.functionArn,
            Environment: {
              Variables: {
                  LOG_LEVEL: 'DEBUG',
                  IDP_QUEUE: props.idpSQSQueue,
                  IDP_TABLE: props.idpTable.tableName,
                  IDP_INPUT_BKT: inputBucketName,
                  SNS_TOPIC: props.idpSNSTopic.topicArn,
                  SNS_ROLE: props.idpSNSRole.roleArn,
                  LAMBDA_POST_PROCESS: props.processTextractOp.functionName
              },
            },
          },
          physicalResourceId: cr.PhysicalResourceId.of(`lambda-textractasyncbulk-update`),
        };
      
      new cr.AwsCustomResource(this, 'update-textractasyncbulk-lambda-environ', {
              onCreate: sdkAction3,
              onUpdate: sdkAction3,
              policy: physicalResourcePolicy,
              installLatestAwsSdk: true
      });

      /**
       * Update Textract Async bulk Lambda with invoke Function permission
       */
       const sdkAction4 = {
        service: 'Lambda',
        action: 'addPermission',
        parameters: {
          FunctionName: props.processTextractOp.functionArn,
          StatementId: "invoke-permission-for-post-process",
          Action: "lambda:InvokeFunction",
          Principal: "lambda.amazonaws.com",
          SourceArn: props.textractAsyncBulk.functionArn 
        },
        physicalResourceId: cr.PhysicalResourceId.of(`lambda-textractasyncbulk-update`),
      };

      new cr.AwsCustomResource(this, 'update-textractasyncbulk-lambda-invoke', {
        onCreate: sdkAction4,
        onUpdate: sdkAction4,
        policy: physicalResourcePolicy,
        installLatestAwsSdk: true
      });
    }
}

module.exports = { IDPDeidStepFunctionStack }