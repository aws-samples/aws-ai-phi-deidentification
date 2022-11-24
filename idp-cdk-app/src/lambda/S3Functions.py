# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import boto3
import logging
import os

s3 = boto3.client('s3')
s3_resource = boto3.resource('s3')
logger = logging.getLogger(__name__)

class S3:
    def __init__(self, bucket: str, log_level: str ='INFO'):
        self.bucket=bucket
        logger.setLevel(log_level)
    
    def list_objects(self, prefix: str, filters: list = None, search: list = None) -> list:
        try:
            logger.info(f"Attempting file listing for bucket: {self.bucket}, prefix: {prefix}, filters: {filters}, searches: {search}")
            obj_bucket = s3_resource.Bucket(self.bucket)
            logger.debug(obj_bucket)
            
            processed_files = None
            
            if filters and not search:
                processed_files = [obj.key for obj in obj_bucket.objects.filter(Prefix=prefix) if not obj.key.endswith("/") and not any(x in obj.key for x in filters)]
            elif search and not filters:
                processed_files = [obj.key for obj in obj_bucket.objects.filter(Prefix=prefix) if not obj.key.endswith("/") and any(x in obj.key for x in search)]
            elif search and filters:
                processed_files = [obj.key for obj in obj_bucket.objects.filter(Prefix=prefix) if not obj.key.endswith("/") and any(x in obj.key for x in search)]
                processed_files = [key for key in processed_files if not any(x in key for x in filters)]
            else:
                processed_files = [obj.key for obj in obj_bucket.objects.filter(Prefix=prefix) if not obj.key.endswith("/")]
            logger.debug(processed_files)
            
            return processed_files
        except Exception as e:
            logger.error(e)
            raise e
    
    def list_prefixes(self, prefix: str) -> list:
        try:
            logger.info(f"Attempting prefix listing for bucket: {self.bucket}, prefix: {prefix}")
            obj_bucket = s3.list_objects_v2(Bucket=self.bucket, Delimiter="/", Prefix=prefix.rstrip("/")+"/")
            prefixes = obj_bucket['CommonPrefixes']
            processed_files = [obj['Prefix'] for obj in prefixes if obj['Prefix'].endswith("/")]
            logger.debug(processed_files)
            
            return processed_files
        except Exception as e:
            logger.error(e)
            raise e
            
    def get_object_content(self, key: str) -> bytes:
        try:
            logger.info(f"Attempting file reading object: {key} in bucket: {self.bucket}")
            
            s3_response = s3.get_object(Bucket=self.bucket, Key=key)
            logger.debug(s3_response)
            
            content_stream = s3_response['Body']
            content = content_stream.read()
            logger.debug(f"Content from object {key}")
            logger.debug(content)
            
            return content
        except Exception as e:
            logger.error(e)
            raise e
        
    def copy_object(self, source_object: str, destination_object: str) -> bool:
        try:
            logger.info(f"Attempting copy {source_object} to {destination_object} within bucket: {self.bucket}")
            copy_source = {'Bucket': self.bucket, 'Key': source_object }
            
            response = s3_resource.Object(self.bucket, destination_object).copy(copy_source)
            logger.debug(response)
            return True
        except Exception as e:
            logger.error(e)
            raise e
            
    def copy_objects(self, source_prefix: str, destination_prefix: str, filters: list = None, search: list = None) -> bool:
        try:
            logger.info(f"Attempting copy objects from {source_prefix} to {destination_prefix} within bucket: {self.bucket} and filter: {filters}")            
            source_objects = self.list_objects(prefix=source_prefix, filters=filters, search=search)
            logger.debug(source_objects)
            for source_object in source_objects:                
                file_name = os.path.basename(source_object)
                destination_object = f"{destination_prefix.rstrip('/')}/{file_name}"                
                self.copy_object(source_object=source_object, destination_object=destination_object)
            return True
        except Exception as e:
            logger.error(e)
            raise e
            
    def move_object(self, source_object: str, destination_object: str) -> dict:
        try:
            logger.info(f"Attempting move object {source_object} to {destination_object} within bucket: {self.bucket}")
            if self.copy_object(source_object=source_object, destination_object=destination_object):
                logger.info(f"Attempting move delete source object {source_object} in bucket: {self.bucket}")
                response = s3.delete_object(Bucket=self.bucket,Key=source_object)
                
                logger.debug(response)
                return response
        except Exception as e:
            logger.error(e)
            raise e
    
    def move_objects(self, source_prefix: str, destination_prefix: str, filters: list=None, search: list = None) -> bool:
        try:
            logger.info(f"Attempting move objects from {source_prefix} to {destination_prefix} within bucket: {self.bucket} and filter: {filters}")            
            source_objects = self.list_objects(prefix=source_prefix, filters=filters, search=search)
            logger.debug(source_objects)
            for source_object in source_objects:                
                file_name = os.path.basename(source_object)
                destination_object = f"{destination_prefix.rstrip('/')}/{file_name}"                
                self.move_object(source_object=source_object, destination_object=destination_object)
                
            return True
        except Exception as e:
            logger.error(e)
            raise e
    
    def delete_objects(self, objects: list) -> dict:
        try:
            logger.info(f"Attempting to delete {len(objects)} objects from bucket: {self.bucket}")
            delete_us = dict(Objects=[])
            
            for item in objects:
                delete_us['Objects'].append(dict(Key=item))
            
            logger.debug(delete_us)
            response = s3.delete_objects(Bucket=self.bucket, Delete=delete_us)
            logger.debug(response)
            
            return response
        except Exception as e:
            logger.error(e)
            raise e
    
    def delete_prefix(self, prefix: str, filters: list = None) -> dict:
        try:
            logger.info(f"Attempting to delete {len(objects)} objects from bucket: {self.bucket}")
            delete_us = dict(Objects=[])
            
            objects = self.list_objects(prefix=prefix, filters=filters)
            
            for item in objects:
                delete_us['Objects'].append(dict(Key=item))
            
            logger.debug(delete_us)
            response = s3.delete_objects(Bucket=self.bucket, Delete=delete_us)
            logger.debug(response)
            
            return response
        except Exception as e:
            logger.error(e)
            raise e
            
    def upload_file(self, source_file: str, destination_object: str, ExtraArgs: dict = None) -> bool:
        try:
            logger.info(f"Attempting to upload file {source_file} to bucket: {self.bucket}, destination: {destination_object}")
            if ExtraArgs:
                s3_resource.Bucket(self.bucket).upload_file(source_file, destination_object, ExtraArgs=ExtraArgs)
            else:    
                s3_resource.Bucket(self.bucket).upload_file(source_file, destination_object)
            return True
        except Exception as e:
            logger.error(e)
            raise e
    
    def download_file(self, source_object: str, destination_file: str) -> bool:
        try:
            logger.info(f"Attempting to download file {source_object} from bucket: {self.bucket}, to : {destination_file}")
            s3_resource.Bucket(self.bucket).download_file(source_object, destination_file)
            return True
        except Exception as e:
            logger.error(e)
            raise e