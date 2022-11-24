/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

import {Amplify, Storage} from 'aws-amplify';

/**
 * This function configures AWS Amplify for the Application
 */

export function configureAmplify() {  
    // Amplify.configure(awsExports);
    Amplify.configure(window.authdata);
}

/**
 * This function helps configure S3 bucket for the Amplify Storage module singleton on demand
 * @param {String} bucket - Name of the S3 bucket
 * @param {String} level - Optional Protection level public, private or protected (defaults to protected)
 * @param {String} region - Optional AWS Region for the bucket (defaults to us-east-1)
 */
export function SetS3Config(bucket, level) {
    const config = window.authdata;
    Storage.configure({
        bucket: bucket,
        level: (level !== undefined ? level : 'protected'),
        region: config.Auth.region,
        identityPoolId: config.Auth.identityPoolId
    });
}


