# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os
import json
import pdfplumber
import logging
import filetype
import string
from S3Functions import S3
from PIL import Image , ImageDraw, ImageSequence
from textractoverlayer.t_overlay import DocumentDimensions, get_bounding_boxes
from textractcaller.t_call import Textract_Types

logger = logging.getLogger(__name__)

def detect_file_type(doc_path: str) -> str:
    """Function gets the mime type of the file 
    """
    try:
        kind = filetype.guess(doc_path)
        if kind is None:
            raise Exception('Unable to determine mime type for file: {doc_path}')

        logger.debug('File extension: %s' % kind.extension)
        logger.debug('File MIME type: %s' % kind.mime)
        return kind.mime
    except Exception as e:        
        logger.error(e)
        raise e

def redacted_file_name(file_path: str) -> str:
    """Function gets a list of Pillow images from PDF/PNG/JPG files 
    """
    path_tuple = os.path.splitext(file_path)    
    local_redacted_path = f"{path_tuple[0]}-redacted{path_tuple[1]}"
    logger.debug(f"Local path for redacted file: {local_redacted_path}")
    return local_redacted_path

def get_pil_img(file_path: str) -> tuple[str, list[Image.Image]]:
    try:
        file_mime = detect_file_type(file_path)
        images = []
        if file_mime == "application/pdf":
            # gets an array of Pillow images from PDF file
            logger.debug("Converting PDF file to Pillow Images")
            # images = pdf2image.convert_from_path(file_path)
            with pdfplumber.open(file_path) as pdf:
                images = [page.to_image(resolution=150).original for page in pdf.pages]                              
        elif file_mime in ['image/jpeg', 'image/png', 'image/tiff']:
            logger.debug(f"Converting {file_mime} Image file to Pillow Images")
            im = Image.open(file_path)
            images = [img for img in ImageSequence.Iterator(im)]
        logger.debug(f"File type: {file_mime}, Total Pages: {len(images)}")
        return file_mime, images
    except Exception as e:
        logger.error("Failed to convert file to Pillow images")
        logger.error(e)
        raise e

def redact_doc(temp_file: str, textract_json: dict, comprehend_json: dict) -> str:
    """Function that redacts PDF/PNG/JPG files given Amazon Comprehend PHI entities and Textract OCR JSON    
    """
    try:        
        file_mime, images = get_pil_img(file_path=temp_file)
        logger.debug(f"Getting local redacted file name from path {temp_file}")
        local_path = redacted_file_name(file_path=temp_file)

        if len(images) == 0:
            raise Exception(f'Unable to redact. No images returned from file, images : {len(images)}')        

        logger.debug("Getting document dimensions")
        document_dimension = [DocumentDimensions(doc_width=img_sample.size[0], doc_height=img_sample.size[1]) for img_sample in images]
        logger.debug("Setting overlay")
        overlay=[Textract_Types.LINE]
        logger.debug("Getting bounding boxes")
        bounding_box_list = get_bounding_boxes(textract_json=textract_json, document_dimensions=document_dimension, overlay_features=overlay)
        
        entities = []
        for entity in comprehend_json['Entities']:            
            entities.append(entity['Text'])

        logger.debug("PHI Entities found...")    
        logger.debug(entities)

        redactions = []
        #collect the bounding boxes for the custom entities
        for entity in entities:            
            for bbox in bounding_box_list:
                if entity.lower() in bbox.text.lower():                    
                    redactions.append(bbox)
                elif bbox.text.lower() in entity.lower():
                    redactions.append(bbox)
        logger.debug(redactions)

        for idx,img in enumerate(images):
            draw = ImageDraw.Draw(img)
            page_num = idx + 1
            for box in redactions:
                if box.page_number == page_num:                    
                    draw.rectangle(xy=[box.xmin, box.ymin, box.xmax, box.ymax], fill="Black")

        if len(images) == 1:
            images[0].save(local_path)
            logger.info(f"Redaction complete. Redacted file saved as {local_path}")
            return file_mime, local_path
        else:
            images[0].save(local_path, save_all=True,append_images=images[1:])
            logger.info(f"Redaction complete. Redacted file saved as {local_path}")
            return file_mime, local_path
    except Exception as e:
        logger.error(e)
        raise e

def clean_up(local_paths: list[str], s3_keys: list[str], s3_retain_docs: bool, s3: S3) -> bool:
    """Function cleans up local temporary files under /tmp/ 
    """
    logger.debug(f"Cleaning up local files {local_paths}")
    for path in local_paths:
        if(os.path.isfile(path)):
            #os.remove() function to remove the file
            os.remove(path)
            #Printing the confirmation message of deletion
            logger.info(f"Temp File {path} Deleted successfully")
        else:
            logger.info(f"Temp File {path} does not exist")

    # clean up files in S3       
    if not s3_retain_docs:
        logger.info(f"Retain documents is set to {s3_retain_docs}. Deleting un-redacted original file from S3")
        s3.delete_objects(objects=s3_keys)

    return True

def lambda_handler(event, context):
    log_level = os.environ.get('LOG_LEVEL', 'INFO')    
    logger.setLevel(log_level)
    logger.debug(json.dumps(event))

    retain_docs = event["retain_docs"]
    doc_prefixes = event["redact_data"]
    bucket = event["bucket"]

    s3 = S3(bucket=bucket, log_level=log_level)

    for doc in doc_prefixes:
        logger.debug(doc)
        try:
            # Read Textract response JSON
            textract_op_content = s3.get_object_content(key=doc['txtract'])
            textract_op = json.loads(textract_op_content)
            logger.info("Loaded Textract JSON")
            logger.debug(textract_op)
            # Read comprehend medical PHI output JSON
            comp_med_content = s3.get_object_content(key=doc['comp_med'])
            comp_med = json.loads(comp_med_content)
            logger.info("Loaded Comprehend Medical JSON")
            logger.debug(comp_med)

            document = doc['doc']
            filename = os.path.basename(document)
            temp_file = f'/tmp/{filename}'
            logger.info("Downloading document to /tmp/")
            s3.download_file(source_object=document, destination_file=temp_file)

            logger.info("Redacting document in /tmp/")
            file_mime, redacted_file = redact_doc(temp_file= temp_file, textract_json=textract_op, comprehend_json=comp_med)

            redacted_prefix = os.path.dirname(document).replace('/orig-doc','/redacted-doc')
            s3_redacted_key = f"{redacted_prefix}/{filename}"

            if redacted_file and os.path.exists(redacted_file):
                logger.debug(f"Redaction complete. Saving {redacted_file} to S3")
                s3.upload_file(source_file=redacted_file, destination_object=s3_redacted_key, ExtraArgs={'ContentType': file_mime})
                if clean_up(local_paths=[temp_file, redacted_file],s3_keys=[document], s3_retain_docs=retain_docs, s3=s3):
                    logger.info("Cleanup complete...")
            else:
                logger.error(f"Redaction un-successful for file {document}. See logs for more details.")
        except Exception as e:
            logger.error(f"Error occured in redacting {doc['doc']}")
            logger.error(e)

    return dict(status="done")