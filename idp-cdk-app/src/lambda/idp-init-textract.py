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

def sf_invoked(event, env_vars):
    # Pickup messages from the queue and check the workflow_id and submit Textract Async Jobs    
    try:        
        logger.debug(f"Starting Processing for Workflow ID: {event['workflow_id']}")
        wf_update = f"UPDATE \"{env_vars['IDP_TABLE']}\" SET workflow_token=? WHERE part_key=? AND sort_key=?"
        ddb.execute_statement(Statement=wf_update, Parameters=[
                                                        {'S': event['token']},
                                                        {'S': event['workflow_id']},
                                                        {'S': f"input/{event['workflow_id']}/"}
                                                    ])
        logger.debug("Updated DynamoDB Item with Step Function Callback Token")
        jobs = get_msg_submit(event, env_vars, 10)
        return jobs
    except Exception as error:        
        logger.error(error)
        return event

def lambda_handler(event, context):
    log_level = os.environ.get('LOG_LEVEL', 'INFO')    
    logger.setLevel(log_level)
    logger.info(json.dumps(event))
    
    env_vars = {}
    for name, value in os.environ.items():
        env_vars[name] = value

    # Lambda invoked by Step function state machine first state
    return sf_invoked(event, env_vars)
           