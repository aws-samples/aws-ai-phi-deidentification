/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

/**
 * Maintains state at app level via react-query using query caching
 */

 import { useQuery } from "@tanstack/react-query";
 import {Auth, Signer} from 'aws-amplify';
 
 const getWorkflows = async (modality,token) => {  
    // console.log(`Hook: ${token['startDt']},${token['endDt']}`)  
    let ocrdata = [], phidata = {}, workflows;    
    const essentialCred = Auth.essentialCredentials(await Auth.currentCredentials());                
    const params = { 
                    method: "GET", 
                    url: (modality === "all")
                        ? `${window.authdata['FunctionUrls']['idpGetWfFunctionUrl']}?fetch=${modality}&startdt=${token['startDt']}&enddt=${token['endDt']}`
                        : `${window.authdata['FunctionUrls']['idpGetWfFunctionUrl']}?fetch=${modality}`
                    };

    const credentials = {
        secret_key: essentialCred.secretAccessKey,
        access_key: essentialCred.accessKeyId,
        session_token: essentialCred.sessionToken,
    };  
    // set your region and service here. service should be "lambda"
    const serviceInfo = {region: window.authdata["Auth"]["region"], service: "lambda"};// Signer.sign takes care of all other steps of Signature V4
    const signedReq = Signer.sign(params, credentials, serviceInfo);
    
    try {
        const response = await fetch(`${signedReq.url}`, {
            method: "GET",
            mode: "cors",
            cache: "no-cache",
            headers: {
                'Content-Type': 'application/json',
                ...signedReq.headers
            },
            referrer: "client",            
        });
        const content = await response.json();
        // console.log(content['data'])
        if (response.ok) {   
            if(modality !== "all"){                        
                // data['data'] = data['data']['documents']
                ocrdata = content['data']['documents']
                if(content['data']['de_identification_status'] === "processed"){
                    phidata = { 
                        de_identification_status: content['data']['de_identification_status'],
                        de_identify: content['data']['de_identify'],
                        retain_orig_docs: content['data']['retain_orig_docs'],
                        status: content['data']['phi_manifest']['Summary']['Status'],
                        totalFiles: content['data']['phi_manifest']['Summary']['InputFileCount'],
                        successfulFilesCount: content['data']['phi_manifest']['Summary']['SuccessfulFilesCount'],
                        failedFilesCount: content['data']['phi_manifest']['Summary']['UnprocessedFilesCount'],
                        documents: content['data']['redacted_documents']
                    }
                }else{
                    phidata = { 
                        de_identification_status: content['data']['de_identification_status'],
                        de_identify: content['data']['de_identify'],
                        retain_orig_docs: content['data']['retain_orig_docs']
                    }
                }            
            }else{            
                workflows = content['data'].sort((a,b) => b.submit_ts - a.submit_ts)            
            }                    
            // ocrdata = data['data'];
        } 
    } catch (error) {
        console.log(error);
        throw error;
    }

    return { "ocr_data": ocrdata, "phi_data": phidata, "workflows": workflows };
 };
 
 export function useWorkflows(querykey, modality, token=undefined) {  
   return useQuery([querykey, modality, token], () => getWorkflows(modality, token), {
     refetchOnWindowFocus: false, //(modality === "all")?true:false,
     refetchInterval: (modality === "all")? 15000:undefined,
     cacheTime: 0
   });
 }