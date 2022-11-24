# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import boto3
import os
import json
import logging

comp_med = boto3.client('comprehendmedical')
logger = logging.getLogger(__name__)
role = os.environ.get('IAM_ROLE')
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

    env_vars = {}
    for name, value in os.environ.items():
        env_vars[name] = value

    workflow_id = event["workflow_id"]
    phi_input_dir = event["phi_input_dir"]
    bucket = event["bucket"]
    phi_output_dir = f'public/phi-output/{workflow_id}'
    phi_job_id = None

    try:
        logger.info("Starting PHI detection job")
        """
        Documentation: https://docs.aws.amazon.com/comprehend-medical/latest/dev/textanalysis-phi.html
        See: https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/comprehendmedical.html#ComprehendMedical.Client.start_phi_detection_job
        """
        response = comp_med.start_phi_detection_job(
                        InputDataConfig={
                            'S3Bucket': bucket,
                            'S3Key': phi_input_dir
                        },
                        OutputDataConfig={
                            'S3Bucket': bucket,
                            'S3Key': phi_output_dir
                        },
                        DataAccessRoleArn=role,
                        JobName=f'phi-job-{workflow_id}',
                        LanguageCode='en'
                    )
        logger.debug(response)
        phi_job_id = response['JobId']
    except Exception as e:
        logger.error("Error occured in launching PHI detection job")
        logger.error(e)
        update_error_state(env_vars=env_vars,event=event)

    return dict(workflow_id=workflow_id, bucket=bucket, phi_job_id=phi_job_id, phi_output_dir=phi_output_dir)    

    