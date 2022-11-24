/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

import React from 'react';
import { IconButton } from 'rsuite'; 
import FileDownloadIcon from '@rsuite/icons/FileDownload';
import { useSignedURL } from 'src/hooks/useSignedURL'

/**
 * 
 * @param {{wfId: string, jobId: string}} param0 
 * @returns Reace.node
 */

const DownloadButtons = ({wfId, jobId, document}) => {

    const { data, isError, isFetching } = useSignedURL(`workflow-rep-${jobId}`, wfId, jobId, document);
    return (
        <React.Fragment>
            <IconButton 
                loading={isFetching}
                href={data?.excelUrl}
                disabled={(!data?.excelUrl || isError)}
                size="xs" 
                icon={<FileDownloadIcon/>} >
                    Download Report
            </IconButton>
            {'  '}                      
            <IconButton 
                loading={isFetching}
                size="xs"
                href={data?.jsonUrl} 
                disabled={(!data?.jsonUrl || isError)}
                icon={<FileDownloadIcon/>} >
                    Download JSON
            </IconButton>
        </React.Fragment>
    )
}

export default DownloadButtons;