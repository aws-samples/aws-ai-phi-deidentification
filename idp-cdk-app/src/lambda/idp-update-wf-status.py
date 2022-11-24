# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import boto3
import os
import json
import logging
from boto3.dynamodb.types import TypeDeserializer
from S3Functions import S3

# s3 = boto3.client('s3')
# s3r = boto3.resource('s3')
ddb = boto3.client('dynamodb')
logger = logging.getLogger(__name__)
deserializer = TypeDeserializer()

def lambda_handler(event, context):
    log_level = os.environ.get('LOG_LEVEL', 'INFO')    
    logger.setLevel(log_level)
    logger.info(json.dumps(event))

    workflow_id = event["workflow_id"]
    tmp_process_dir = event["tmp_process_dir"]
    phi_input_dir = event["phi_input_dir"]
    bucket = event["bucket"]
    env_vars = {}
    for name, value in os.environ.items():
        env_vars[name] = value

    s3 = S3(bucket=bucket, log_level=log_level)

    try:
        logger.info("Getting temp files to process")        
        processed_files = s3.list_objects(prefix=tmp_process_dir)
        processed_docs = {}
        for file in processed_files:            
            content = s3.get_object_content(key=file)
            logger.debug(content)            
            obj = json.loads(content)
            logger.debug(obj)
            processed_docs = {**processed_docs, **obj}
            logger.debug(processed_docs)

        logger.info("Updating workflow status...")
        update = f"UPDATE \"{env_vars['IDP_TABLE']}\" SET docs=? SET status=? set phi_input=? WHERE part_key=? AND sort_key=? RETURNING ALL NEW *"
        ddbresponse = ddb.execute_statement(Statement=update, Parameters=[
                                                                {'M': processed_docs},
                                                                {'S': "complete"},
                                                                {'S': phi_input_dir},
                                                                {'S': workflow_id},
                                                                {'S': f"input/{workflow_id}/"}
                                                            ])
        logger.debug(ddbresponse)
        wf = ddbresponse['Items'][0]
        deserialized_document = {k: deserializer.deserialize(v) for k, v in wf.items()}
        logger.debug(deserialized_document)
        de_identify = deserialized_document['de_identify']

        logger.debug(json.dumps(ddbresponse))

        logger.info("Deleting temp files")
        s3.delete_objects(objects=processed_files)
        
    except Exception as e:
        logger.error(e)

    return dict(workflow_id=workflow_id, bucket=bucket, phi_input_dir=phi_input_dir, de_identify=de_identify)