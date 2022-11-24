// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Generates Amplify Auth config for the react app with the Cognito resources created by the 
 * CDK Application and places it in the React Applications config directory
 */

const fs = require('fs');
const data = require('./cdk-outputs.json');
const optargs = process.argv.slice(2);

if(optargs[0] === 'app'){
    const config = {
        "Auth": {
            "region": data["IdpCdkDeidAppStack"]["idpregion"],
            "userPoolId": data["IdpCdkDeidAppStack"]["idpuserPoolId"],
            "identityPoolId": data["IdpCdkDeidAppStack"]["idpidentityPoolId"],
            "userPoolWebClientId": data["IdpCdkDeidAppStack"]["idpuserPoolWebClientId"],
            "idpRootBucket": data["IdpCdkDeidAppStack"]["idpRootBucket"]
        },
        "FunctionUrls":{
            "idpGetWfFunctionUrl" : data["IDPDeidLambdaStack"]["idpgetwflambdaurl"]
        }
    };
    
    fs.writeFileSync("../idp-react-app/public/amplify.js", "window.authdata="+JSON.stringify(config));   
    fs.writeFileSync("../idp-react-app/build/amplify.js", "window.authdata="+JSON.stringify(config));
}

if(optargs[0] === 'web'){
    console.log("IDP Proof of Concept Application deployed and accessible at url → https://main."+data['IDPDeidWebDeployStack']['idpwebappdomain']);
}
