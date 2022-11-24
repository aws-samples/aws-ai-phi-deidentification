// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Deploys the React app to Amplify front end hosting via
 * Amazon S3 assets.
 */

const {Stack, CfnOutput} = require('aws-cdk-lib');
const amplify = require('@aws-cdk/aws-amplify-alpha');
const assets = require('aws-cdk-lib/aws-s3-assets');
const path = require('path');

class IDPDeidWebDeployStack extends Stack{

    constructor(scope, id, props){
        super(scope, id, props);

        /**
         * Create amplify web app (front end) using the CodeCommit repo
         */                
         const idp_web_amplify_app = new amplify.App(this, "idp-react-app", {
                                                            appName: "idp-react-poc-app"
                                                        });
        idp_web_amplify_app.addCustomRule(amplify.CustomRule.SINGLE_PAGE_APPLICATION_REDIRECT);

        idp_web_amplify_app.addBranch("main",{                                        
                                        asset: new assets.Asset(this, 'webapp-asset',{
                                            path: path.join(__dirname,'../../idp-react-app/build')
                                        })
                                    });

        new CfnOutput(this, 'idp-web-app-domain', {
            value: idp_web_amplify_app.defaultDomain,
            description: 'IDP Web App Domain',
            exportName: 'idpWebAppDomain'
        });
    }
}

module.exports = { IDPDeidWebDeployStack }
