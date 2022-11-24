# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os
import json
import logging
from S3Functions import S3

logger = logging.getLogger(__name__)

def get_key(pattern: str, files: list) -> str:
    val = [x for x in files if pattern in x]
    return val[0]

def lambda_handler(event, context):
    log_level = os.environ.get('LOG_LEVEL', 'INFO')    
    logger.setLevel(log_level)
    logger.info(json.dumps(event))

    workflow_id = event["workflow_id"]
    retain_docs = event["retain_docs"]
    doc_prefixes = event["doc_prefixes"]
    bucket = event["bucket"]

    s3 = S3(bucket=bucket, log_level=log_level)
    redact_data = []
    for prefix in doc_prefixes:
        try:
            # Get the Comprehend Medical output and Textract JSON output path
            files = s3.list_objects(prefix=prefix, search=[".comp-med", ".json", "/orig-doc/"]) 
            process_dict = dict(comp_med=get_key(pattern='.comp-med',files=files), txtract=get_key(pattern='.json',files=files), doc=get_key(pattern='/orig-doc/',files=files))            

            redact_data.append(process_dict)
        except Exception as e:
            logger.error("Error occured...")
            logger.error(e)

    return dict(workflow_id=workflow_id, bucket=bucket, retain_docs=retain_docs, redact_data=redact_data)
