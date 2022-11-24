# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import boto3
import os
import json
import logging
import time

comp_med = boto3.client('comprehendmedical')
logger = logging.getLogger(__name__)
ddb = boto3.client('dynamodb')

def update_error_state(env_vars,event):
    logger.debug('Updating de-identification status to failed')
    wf_update = f"UPDATE \"{env_vars['IDP_TABLE']}\" SET de_identification_status=? WHERE part_key=? AND sort_key=?"
    ddb.execute_statement(Statement=wf_update, Parameters=[
                                                    {'S': 'failed'},
                                                    {'S': event['workflow_id']},
                                                    {'S': f"input/{event['workflow_id']}/"}
                                                ])

def lambda_handler(event, context):
    log_level = os.environ.get('LOG_LEVEL', 'INFO')    
    logger.setLevel(log_level)
    logger.info(json.dumps(event))

    workflow_id = event["workflow_id"]
    phi_job_id = event["phi_job_id"]
    phi_output_dir = event["phi_output_dir"]
    bucket = event["bucket"]
    status = None

    env_vars = {}
    for name, value in os.environ.items():
        env_vars[name] = value

    max_time = time.time() + 10*60 # 10 mins

    try:
        while time.time() < max_time:
            logger.info("Checking PHI detection job status")        
            response = comp_med.describe_phi_detection_job(JobId=phi_job_id)
            status = response['ComprehendMedicalAsyncJobProperties']['JobStatus']

            if status == "COMPLETED" or status == 'FAILED' or status == 'STOPPED':
                if status == 'FAILED' or status == 'STOPPED':
                    update_error_state(env_vars=env_vars,event=event)
                break

            time.sleep(2)
    except Exception as e:
        logger.error("Error occured in launching PHI detection job")
        logger.error(e)
        update_error_state(env_vars=env_vars,event=event)
        return dict(workflow_id=workflow_id, status='FAILED', bucket=bucket, phi_job_id=phi_job_id, phi_output_dir=phi_output_dir)

    return dict(workflow_id=workflow_id, status=status, bucket=bucket, phi_job_id=phi_job_id, phi_output_dir=phi_output_dir)    

    