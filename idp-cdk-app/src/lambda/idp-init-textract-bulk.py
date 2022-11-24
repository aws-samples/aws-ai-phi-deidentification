# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import botocore.exceptions
import boto3
import json
import logging
import os
from boto3.dynamodb.types import TypeDeserializer
from botocore.config import Config

# Disable Boto3 retries since the message will be processed
# via notification channel
retry_config = Config(
   retries = {
      'max_attempts': 0,
      'mode': 'standard'
   }
)

deserializer = TypeDeserializer()
sfn = boto3.client('stepfunctions')
sqs = boto3.client('sqs')
textract = boto3.client('textract', config=retry_config)
ddb = boto3.client('dynamodb')
s3 = boto3.client('s3')
s3r = boto3.resource('s3')
lambda_client = boto3.client('lambda')
logger = logging.getLogger(__name__)

def get_msg_submit(event, env_vars, num_msgs):
    try:
        logger.debug("Getting messages from SQS Queue")
        sqsresponse = sqs.receive_message(QueueUrl=env_vars['IDP_QUEUE'],
                                          MaxNumberOfMessages=num_msgs,
                                          VisibilityTimeout=10,
                                          WaitTimeSeconds=5)   # Long poll to get as many messages as possible (max 10)
        logger.debug(json.dumps(sqsresponse))

        messages = [{"doc": json.loads(msg['Body']), "ReceiptHandle": msg['ReceiptHandle']} for msg in sqsresponse['Messages']]
        logger.debug(json.dumps(messages))

        jobs=[]
        for message in messages:
            doc = message['doc']
            msg_handle = message['ReceiptHandle']

            logger.debug(f"Starting Async Textract job for workflow: {doc['workflow_id']}, document: {doc['document_name']}")
            try:
                txrct_response = textract.start_document_analysis(
                                        DocumentLocation={
                                            'S3Object': {
                                                'Bucket': env_vars['IDP_INPUT_BKT'],
                                                'Name': f"public/{doc['input_path']}{doc['document_name']}",
                                            }
                                        },
                                        FeatureTypes=['TABLES','FORMS'],
                                        JobTag=doc['workflow_id'],
                                        NotificationChannel={
                                            'SNSTopicArn': env_vars['SNS_TOPIC'],
                                            'RoleArn': env_vars['SNS_ROLE']
                                        },
                                        OutputConfig={
                                            'S3Bucket': env_vars['IDP_INPUT_BKT'],
                                            'S3Prefix': f"public/output/{doc['workflow_id']}"
                                        }
                                    )
                logger.debug(json.dumps(txrct_response))            
                jobs.append(txrct_response['JobId'])                
            except botocore.exceptions.ClientError as error:
                if (error.response['Error']['Code'] == 'LimitExceededException'
                    or error.response['Error']['Code'] == 'ThrottlingException'
                    or error.response['Error']['Code'] == 'ProvisionedThroughputExceededException'
                    ):
                    logger.warn('API call limit exceeded; backing off...')
                    raise error
                else:
                    pass

            # delete SQS Messages here
            sqs.delete_message(QueueUrl=env_vars['IDP_QUEUE'], ReceiptHandle=msg_handle)
            logger.debug(f"Textract Analyze document job submitted with job id : {txrct_response['JobId']}, and SQS Message deleted.")
        
        return jobs
    except Exception as error:
        raise error

def sns_invoked(event, env_vars):
    #sns_invoked function
    message = json.loads(event['Records'][0]['Sns']['Message'])
    jobId = message['JobId']    
    workflow_id = message['JobTag']
    status= message['Status'].lower() # Status of the Async Job      
    bucket = message['DocumentLocation']['S3Bucket']
    root_prefix = message['DocumentLocation']['S3ObjectName'].split("/")[0]
    document = os.path.basename(message['DocumentLocation']['S3ObjectName'])

    try:
        logger.debug(f"Invoking post processing for JobId {jobId} asynchronously")
        lambda_payload = {"workflow_id": workflow_id, "output_path": f"{root_prefix}/output/{workflow_id}/{jobId}", "doc_name": document}
        lambda_client.invoke(FunctionName=env_vars['LAMBDA_POST_PROCESS'], 
                            InvocationType='Event',
                            Payload=json.dumps(lambda_payload))
        
        file_to_process = {}
        file_to_process[document] = {"S":f"{status}:{jobId}"}
              
        s3.put_object(Body=json.dumps(file_to_process),Bucket=bucket,Key=f"{root_prefix}/temp/{workflow_id}/{document}.json")
        logger.debug(f"Updated temp processing file {root_prefix}/temp/{workflow_id}/{document}.json")

        idp_bucket = s3r.Bucket(bucket)
        processed_files = [obj.key for obj in idp_bucket.objects.filter(Prefix=f"{root_prefix}/temp/{workflow_id}") if not obj.key.endswith("/")]
        files = [obj.key for obj in idp_bucket.objects.filter(Prefix=f"{root_prefix}/input/{workflow_id}") if not obj.key.endswith("/")]
        

        # Some documents remain to be submitted to Textract
        if len(processed_files) < len(files):
            # Documents remained to be processed or are being processed
            event["bucket"] = bucket            
            jobs = get_msg_submit(event, env_vars, 10)
            logger.debug(f"Submitted Jobs : {json.dumps(jobs)}")
            return jobs
        else:            
            #Post to state machine that workflow is done
            select = f"SELECT \"workflow_token\" FROM \"{env_vars['IDP_TABLE']}\" WHERE part_key=? AND sort_key=?"
            ddb_response = ddb.execute_statement(Statement=select, Parameters=[
                                                            {'S': workflow_id},
                                                            {'S': f"input/{workflow_id}/"}
                                                        ])
            deserialized_document = {k: deserializer.deserialize(v) for k, v in ddb_response['Items'][0].items()}
            sm_token = deserialized_document['workflow_token']
            smresponse = sfn.send_task_success(taskToken=sm_token, 
                                               output=json.dumps({
                                                                    "Payload": { 
                                                                            "workflow_id": workflow_id, 
                                                                            "bucket": bucket, 
                                                                            "tmp_process_dir": f"{root_prefix}/temp/{workflow_id}",
                                                                            "phi_input_dir": f"{root_prefix}/phi-input/{workflow_id}"
                                                                        }
                                                                }))
            logger.debug(smresponse)

            return smresponse
    except Exception as e:                
        logger.error(e)
        return event


def lambda_handler(event, context):
    log_level = os.environ.get('LOG_LEVEL', 'INFO')    
    logger.setLevel(log_level)
    logger.info(json.dumps(event))
    
    env_vars = {}
    for name, value in os.environ.items():
        env_vars[name] = value

    return sns_invoked(event, env_vars)
           