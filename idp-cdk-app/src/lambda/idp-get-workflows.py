# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import boto3
import os
import json
import logging
import decimal
from S3Functions import S3
from boto3.dynamodb.types import TypeDeserializer

ddb = boto3.client('dynamodb')
deserializer = TypeDeserializer()
logger = logging.getLogger(__name__)

class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, decimal.Decimal):
            return str(o)
        return super(DecimalEncoder, self).default(o)

def lambda_handler(event, context):
    log_level = os.environ.get('LOG_LEVEL', 'INFO')    
    logger.setLevel(log_level)
    logger.info(json.dumps(event))
    idpTable = os.environ.get('IDP_TABLE')
    bucket = os.environ.get('IDP_BKT')

    param = event['queryStringParameters']    
    if param['fetch'] == 'all':
        start = param['startdt']
        end = param['enddt']
        stmt = f"SELECT * FROM \"{idpTable}\" WHERE submit_ts >= {start} AND submit_ts <= {end}"

        try:            
            ddbresponse = ddb.execute_statement(Statement=stmt)
            logger.debug(json.dumps(ddbresponse))
            # Deserialize the DynamoDB Item Response by Un-wiring it
            all_docs = []
            for doc in ddbresponse['Items']:
                deserialized_document = {k: deserializer.deserialize(v) for k, v in doc.items()}
                all_docs.append(deserialized_document)

            payload = {
                "statusCode": 200, 
                "body": {                    
                    "data": all_docs
                }
            }

            if 'NextToken' in ddbresponse:
                logger.debug(f"Next Token found...{ddbresponse['NextToken']}")    
                payload['body']['nextKey'] = f"{ddbresponse['NextToken']}"
            
            print(payload)
            return payload
        except Exception as e:
            logger.error(e)
            return event
    else:
        s3 = S3(bucket=bucket, log_level=log_level)        
        stmt = f"SELECT * FROM \"{idpTable}\" WHERE part_key=? AND sort_key=?"
        workflow_id = param['fetch']
        part_key = f"input/{param['fetch']}/"
        ddbresponse = ddb.execute_statement(Statement=stmt, Parameters=[                                                            
                                                            {'S': workflow_id},
                                                            {'S': part_key}
                                                        ])

        deserialized_document = {k: deserializer.deserialize(v) for k, v in ddbresponse['Items'][0].items()}
        des_doc = deserialized_document
        des_doc['workflow_id'] = des_doc.pop('part_key')
        des_doc.pop('sort_key')
        des_doc.pop('workflow_token')     

        # if des_doc["retain_orig_docs"]:
        #     documents   = [{"document": k, "doc_path": f"output/{workflow_id}/{v.split(':')[1]}/orig-doc/{k}", "status": v.split(':')[0], "jobid": v.split(':')[1]} for k,v in des_doc['docs'].items()]           
        #     des_doc["documents"] = documents
        # else:
        
        documents   = [{"document": k, "status": v.split(':')[0], "jobid": v.split(':')[1]} for k,v in des_doc['docs'].items()]           
        des_doc["documents"] = documents
        des_doc.pop('docs')   

        if des_doc["de_identification_status"] == "processed":
            redacted_docs = s3.list_objects(prefix=f"public/output/{workflow_id}/", search=["/redacted-doc/"])
            manifest_content = s3.get_object_content(key=f"public/output/{workflow_id}/Manifest")            

            if redacted_docs and len(redacted_docs) >0:   
                des_doc["redacted_documents"] = [ {"document": os.path.basename(k),"doc_path":k.replace("public/",""), "phi_json": f"{os.path.dirname(k).replace('/redacted-doc','').replace('public/','')}/{os.path.splitext(os.path.basename(k))[0]}.comp-med"} for k in redacted_docs]
            if manifest_content:
                des_doc["phi_manifest"] = json.loads(manifest_content)

        logger.debug(json.dumps(des_doc, cls=DecimalEncoder))

        payload = {
            "statusCode": 200, 
            "body": {                    
                "data": des_doc
            }
        }
        return payload
