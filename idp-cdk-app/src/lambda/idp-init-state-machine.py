# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import urllib.parse
import boto3
import json
import logging
import os

s3 = boto3.client('s3')
ddb = boto3.client('dynamodb')
sqs = boto3.client('sqs')
sfn = boto3.client('stepfunctions')

logger = logging.getLogger(__name__)

def lambda_handler(event, context):
    log_level = os.environ.get('LOG_LEVEL', 'INFO')    
    logger.setLevel(log_level)
    logger.info(json.dumps(event))
    
    idpTable = os.environ.get('IDP_TABLE')
    sqsUrl = os.environ.get('IDP_QUEUE')
    sfnArn = os.environ.get('STATE_MACHINE')

    # Get the object from the event and show its content type
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'], encoding='utf-8')
    # root_prefix = event['Records'][0]['s3']['object']['key'].split("/")[0]
    try:
        response = s3.get_object(Bucket=bucket, Key=key)        
        content = response['Body']
        jsonObject = json.loads(content.read())
        logger.debug(json.dumps(jsonObject))

        # Log data to Dynamodb
        stmt = f"INSERT INTO \"{idpTable}\" VALUE {{'part_key' : ?, 'sort_key' : ?, 'status': ?, 'docs': ?, 'submit_ts': ?, 'total_files': ?, 'de_identify': ?, 'retain_orig_docs': ?, 'de_identification_status': ?}}"
        logger.debug(stmt)
        ddresponse = ddb.execute_statement(Statement=stmt, Parameters=jsonObject);
        logger.debug(json.dumps(ddresponse))

        workflow_id=jsonObject[0]['S']
        input_path=jsonObject[1]['S']
        docs=jsonObject[3]['M']

        #Send messages per doc to SQS
        logger.debug("Sending messages to SQS")
        for doc in docs.keys():
            msg = dict(workflow_id= workflow_id, input_path= input_path, document_name= doc)
            logger.debug(json.dumps(msg))
            sqsresponse = sqs.send_message(QueueUrl=sqsUrl, MessageBody=json.dumps(msg))            
            logger.debug(sqsresponse)

            # logger.debug(f"Creating temp processing file {root_prefix}/temp/{workflow_id}/{doc}.json")
            # obj = {doc: {"S": "ready"}}
            # s3.put_object(Body=json.dumps(obj),Bucket=bucket,Key=f'{root_prefix}/temp/{workflow_id}/{doc}.json')
            
        # Step function payload
        sfnPayload = dict(workflow_id=workflow_id, bucket=bucket)
        
        # Start Step function state machine
        logger.debug("Starting Step function state machine")
        logger.debug(sfnPayload)
        sfnResponse = sfn.start_execution(
                            stateMachineArn=sfnArn,
                            name=f'idp-workflow-{workflow_id}',
                            input=json.dumps(sfnPayload)
                        )
        logger.debug(sfnResponse)
        logger.debug("Done...")

        return dict(Success=True)
    except Exception as e:        
        logger.error('Error: {}'.format(e))
        raise e
              