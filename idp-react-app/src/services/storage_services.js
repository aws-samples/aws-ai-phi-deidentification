/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

import { Storage } from 'aws-amplify';
import { SetS3Config } from 'src/services/aws_services';

export default class storage_service{
    constructor(props){       
        const setBucket = (props)?props.bucket: window.authdata.Auth.idpRootBucket, 
              setScope = (props)?props.scope: 'public';

        SetS3Config(setBucket, setScope);
        this.actionPromise = undefined;
    }

    async list(key){
        try {            
            this.actionPromise = Storage.list(key);
            const files = await this.actionPromise;
            return files;
        } catch (error) {
            throw(error)
        }
    }

    upload(file, prefix = "", progressUpdate){
        const promise = Storage.put(`${prefix}${file.name}`, file,{
            contentType: file.type,
            progressCallback: (progress) => {                    
                const total = (progress.loaded/progress.total)*100;
                if(progressUpdate) {                    
                    progressUpdate({filename: file.name, progressValue: Math.trunc(total)})
                };
            }
        });
                                   
        return promise;
    }

    uploadFile(file, prefix = "", progressUpdate){
        const promise = Storage.put(prefix,file,{
            contentType: file.type,
            progressCallback(progress) {                    
                const total = (progress.loaded/progress.total)*100;
                if(progressUpdate) progressUpdate(Math.trunc(total));
            }
        });
                                    
        return promise;
    }

    writeFile(text, filename="data.txt"){
        const promise = Storage.put(filename,text);
        return promise;
    }

    /**
     * 
     * @param {*} srcPrefix 
     * @param {*} destPrefix      
     * Given a list of source and destination prefixes, copies all files from
     * srcPrefix to destPrefix within /Public access level. This action is not
     * cancellable since cancelling may cause unintented / partial contents to
     * be published.
     * WARNING!!! This is specifically built for vision and blog articles to 
     * support "Save as Draft" and "Publish" functionality. Copies all assets
     * from drafts/ prefix to published content prefix at the root
     */
    async copyAll(srcPrefix, destPrefix){
        let sourceFiles;
        try {
            sourceFiles = await Storage.list(srcPrefix);
            if(sourceFiles.length > 0){
                for(const file of sourceFiles){
                    if(!file.key.includes('manifest.json')){
                        const filename = file.key.split('\\').pop().split('/').pop(); //get file object name out of the full prefix key
                        await Storage.copy({ key: file.key, level: 'public' }, { key: `${destPrefix}/${filename}`, level: 'public' });
                    }                    
                }
            }            
        } catch (error) {
            throw error;
        }
    }

    async readFile(key){
        try {
            const result = await Storage.get(key, { contentType: 'text/plain', download: true, expires: 20000, cacheControl: 'no-cache' });
            // data.Body is a Blob, .text() is a promise
             return result.Body.text();
        } catch (error) {
            return "";
        }        
    }

    async genSignedURL(key, download){
        try {
            const file = await Storage.list(key);
            if(file.length > 0){
                const result = await Storage.get(key, { download: download, expires: 7200, cacheControl: 'no-cache' });                                 
                const {ContentType} = await Storage.get(key, { download: true});
                
                return {
                    url: result,
                    contentType: ContentType
                }          
            }else{
                return undefined;
            }
        } catch (error) {            
            throw error;
        }  
    }

    async delete(filename, prefix=""){
        const promise = Storage.remove(`${prefix}${filename}`);
        return promise;
    }

    cancel(promise){
        Storage.cancel(promise, "Cancelled");
    }
}