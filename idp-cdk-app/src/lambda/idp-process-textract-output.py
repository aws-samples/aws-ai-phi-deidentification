# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import boto3
import os
import json
import logging
from trp import Document
from textractprettyprinter.t_pretty_print import Textract_Pretty_Print, get_string
from textractcaller import get_full_json_from_output_config
from textractcaller.t_call import OutputConfig
import xlsxwriter

s3 = boto3.client('s3')
s3_resource = boto3.resource('s3')
logger = logging.getLogger(__name__)
bucket = os.environ.get('IDP_BKT')


# Find Textract Async ouputs and merge them together into 1 json
def get_textract_json(event):    
    prefix = event['output_path']
    doc_name = event["doc_name"]
    dirs = event['output_path'].split("/")
    job_id = dirs.pop()
    s3Prefix = "/".join(dirs)
    # keys=[]
    result={}
    try:
        logger.debug(f"Merging Amazon Textract output JSON")
        op_config = OutputConfig(s3_bucket=bucket, s3_prefix=s3Prefix)
        result = get_full_json_from_output_config(output_config=op_config, job_id=job_id, s3_client=s3)        

        if(result):
            logger.debug(f"Merging json Done...")
            logger.debug(json.dumps(result))
            """
            Write json to S3. This JSON file will be of naming convention <document_name>.json.
            For example, for document my_doc.pdf the corresponding JSON file will be named my_doc.pdf.json
            """            
            logger.debug(f"Writing JSON to S3")
            s3.put_object(
                    Body=json.dumps(result),
                    Bucket=bucket,
                    Key=f'{prefix}/{doc_name}.json'
                )
        else:
            logger.debug("Unable to process Textract Output JSON...")
        return result
    except Exception as e:
        logger.error(e)
        raise e

def get_textract_features(textract_j):
    doc = Document(textract_j)
    lines, forms, tables = [], [], []     
    for page in doc.pages:
        # lines and words
        logger.debug("Writing Lines...")
        for line in page.lines:
            lines.append([line.text, line.confidence])

        # tables
        logger.debug("Writing Tables...")
        for table in page.tables:
            for r, row in enumerate(table.rows):
                for c, cell in enumerate(row.cells):
                    tables.append([f'[{r}][{c}]', cell.text, cell.confidence])

        # forms
        logger.debug("Writing K-V Pairs (forms)...")
        for field in page.form.fields:
            if(field.key and field.value):
                forms.append([field.key.text, field.key.confidence, field.value.text, field.value.confidence])
            elif(field.key and not field.value):
                forms.append([field.key.text, field.key.confidence, '', ''])
            elif(not field.key and field.value):
                forms.append(['', '', field.value.text, field.value.confidence])
    return lines, forms, tables

def gen_excel(textract_j, event):    
    # idp_table = os.environ.get('IDP_TABLE')
    prefix = event['output_path']
    doc_name = event["doc_name"]
    try:
        lines, forms, tables = get_textract_features(textract_j)    
        #Generate an Excel report for LINES, FORMS, and TABLES
        logger.debug("Writing Excel report /tmp/output_report.xlsx...")
        workbook = xlsxwriter.Workbook('/tmp/output_report.xlsx')
        bold = workbook.add_format({'bold': True})

        if(lines):
            logger.debug("Writing Excel report for lines...")
            row = 1
            col = 0
            ws_line = workbook.add_worksheet('LINES')
            ws_line.write('A1', 'Line', bold)
            ws_line.write('B1', 'Confidence Score', bold)
            
            for text, confidence in lines:            
                ws_line.write(row, col,     text)
                ws_line.write(row, col + 1, f'{confidence:.2f}%')
                row += 1
            
        if(forms):
            logger.debug("Writing Excel report for forms...")
            logger.debug(forms)
            row = 1
            col = 0
            ws_forms = workbook.add_worksheet('FORMS')
            ws_forms.write('A1', 'Form Key', bold)
            ws_forms.write('B1', 'Form Key Confidence Score', bold)
            ws_forms.write('C1', 'Form Value', bold)
            ws_forms.write('D1', 'Form Value Confidence Score', bold)
            for key, key_confidence, value, value_confidence in forms:
                ws_forms.write(row, col,     key)
                key_conf = key_confidence if key_confidence else 0
                ws_forms.write(row, col + 1, f'{key_conf:.2f}%')
                ws_forms.write(row, col + 2, value)
                val_conf = value_confidence if value_confidence else 0
                ws_forms.write(row, col + 3, f'{val_conf:.2f}%')
                row += 1
        
        if(tables):
            logger.debug("Writing Excel report for tables...")
            logger.debug(tables)
            row = 1
            col = 0
            ws_tables = workbook.add_worksheet('TABLES')
            ws_tables.write('A1', 'Table Cell Position', bold)
            ws_tables.write('B1', 'Cell Text', bold)
            ws_tables.write('C1', 'Confidence Score', bold)
            for cell, text, confidence in tables:
                ws_tables.write(row, col,     cell)
                ws_tables.write(row, col + 1, text)
                ws_tables.write(row, col + 2, f'{confidence:.2f}%')
                row += 1
                
        workbook.close()
        logger.debug("Excel report generation complete...")
    
        """
        Write the excel report from /tmp local memmory to S3. This excel file will be of naming convention <document_name>-report.xlsx.
        For example, for document my_doc.pdf the corresponding Excel file will be named my_doc.pdf-report.xlsx
        """
        logger.debug(f"Writing Excel report {doc_name}-report.xlsx to S3...")
        s3_resource.meta.client.upload_file('/tmp/output_report.xlsx', bucket, f'{prefix}/{doc_name}-report.xlsx')
        logger.debug("Upload Excel report to S3 complete...")
        return {"Payload": "done"}
    except Exception as e:
        logger.error(e)
        raise e
    
def gen_plain_text(textract_j, event):
    dirs = event['output_path'].split("/")
    root_dir = dirs[0]
    job_id = dirs[-1]
    doc_name = event["doc_name"]
    wf_id = event["workflow_id"]

    logger.debug("Generating text file...")
    text = get_string(textract_json=textract_j, output_type=[Textract_Pretty_Print.LINES])    

    logger.debug(f"Writing plaintext file to S3...")
    try:
        """
        Write plain Text file to S3. This plaintext file will be of naming convention <document_name>.txt.
        For example, for document my_doc.pdf the corresponding txt file will be named my_doc.pdf.txt.

        !!!CAUTION!!!
        This plain text file will be ultimately used to detect PHI entities using Amazon Comprehend Medical StartPHIDetection async job.
        (https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/comprehendmedical.html#ComprehendMedical.Client.start_phi_detection_job)
        The maximum individual file size this job can handle is 40Kb, and maximum number of files per batch job is 50 million. Refer to -
        https://docs.aws.amazon.com/comprehend-medical/latest/dev/comprehendmedical-quotas.html for more. In it's current form, this code can handle PHI entity
        detection for roughly upto 6 to 8 pages per document. However, for larger documents, exceeding 40kb of text, you can use the code linked below for splitting 
        the text into 40kb chunks - https://docs.aws.amazon.com/comprehend-medical/latest/dev/samples/segment.py.zip. In case of segmented text files, be sure to 
        update the post processing logic in idp-process-phi-output.py Lambda function
        """        
        s3.put_object(
                Body=text,
                Bucket=bucket,
                Key=f'{root_dir}/phi-input/{wf_id}/{job_id}/{doc_name}.txt'
            )
    except Exception as e:
        logger.error(e)
        raise e

    return True

def lambda_handler(event, context):
    log_level = os.environ.get('LOG_LEVEL', 'INFO')    
    logger.setLevel(log_level)
    logger.info(json.dumps(event))

    path = event['output_path']    
    final_response = {}
    
    try:
        logger.debug(f"Merging JSON in {path}...")
        textract_j = get_textract_json(event)
        
        if(not textract_j):
            logger.debug(f"Textract JSON processing failed for {path}...")
            final_response['message'] = f"Textract JSON processing failed for {path}"
        else:            
            # write plaintext file
            gen_plain_text(textract_j, event)

            # lines, forms, tables = get_textract_features(textract_j)            
            final_response = gen_excel(textract_j, event)
        logger.debug(f"Textract Output JSON processed and report created {path}...")   
    except Exception as e:
        logger.error(e)
        raise e

    return final_response