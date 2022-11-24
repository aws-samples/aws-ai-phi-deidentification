/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

/**
 * Generates Signed URL for downloadable reports
 */

 import { useQuery } from "@tanstack/react-query";
 import StorageService from 'src/services/storage_services';
 
 const getPhiData = async (doc_url, phi_data_url) => {  
    const storage = new StorageService(); 
    let documentUrl, responseJson;
    try {
                                    
        const docurl = await storage.genSignedURL(doc_url);
        const phiurl = await storage.genSignedURL(phi_data_url);
        
        documentUrl = docurl?.url || undefined;

        let response = await fetch(phiurl);
        responseJson = await response.json();
        // excelUrl = excelresp?.url || undefined;
        
    } catch (error) {        
        throw error;
    }

    return { redacted_file_url: documentUrl, phi_data: responseJson };
 };
 
 export function usePhi(querykey, doc_url, phi_data_url) {  
   return useQuery([querykey, doc_url, phi_data_url], () => getPhiData(doc_url, phi_data_url), {
     refetchOnWindowFocus: false,
     cacheTime: 0
   });
 }