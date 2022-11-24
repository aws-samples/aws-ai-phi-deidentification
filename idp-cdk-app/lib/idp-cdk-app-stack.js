// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Creates Resources required for the front-end app
 * - Amazon S3 Bucket for Web UI File uploads
 * - Amazon Cognito UserPool and Identity Pool
 * - IAM Roles For the cognito Identity Pool
 */

const {Stack, CfnOutput, RemovalPolicy } = require('aws-cdk-lib');
const cognito = require('aws-cdk-lib/aws-cognito');
const s3 = require('aws-cdk-lib/aws-s3');
const iam = require('aws-cdk-lib/aws-iam');
const UserPoolUser = require("./CognitoUserPoolUser");
class IdpCdkDeidAppStack extends Stack {
  static IDPRootBucket;
  static IDPUserPool;
  static IDPUSerPoolClient;
  static IDPCognitoAuthRole;
  /**
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {    
    super(scope, id, props);
    
    /**
     * Root S3 bucket for the app
     */
    const idp_root_bucket = new s3.Bucket(this, 'idp-pocbox-bucket', {
      bucketName: `${process.env.ROOT_BUCKET}`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      cors: [
              {      
                allowedMethods: [
                        s3.HttpMethods.GET,
                        s3.HttpMethods.HEAD,
                        s3.HttpMethods.POST,
                        s3.HttpMethods.PUT,
                        s3.HttpMethods.DELETE
                      ],
                allowedOrigins: ['*'],
                allowedHeaders: ['*'],
                exposedHeaders: [
                  "x-amz-server-side-encryption",
                  "x-amz-request-id",
                  "x-amz-id-2",
                  "ETag"
                ],
                maxAge: 3000
              }
            ]
    });

    this.IDPRootBucket = idp_root_bucket;

    new CfnOutput(this, 'idp-RootBucket', {
      value: idp_root_bucket.bucketName,
      description: 'IDP Root S3 Bucket',
      exportName: 'idpRootBucket'
    });

    /**
     * Cognito UserPool for the App
     */

     const idp_user_pool = new cognito.UserPool(this, 'idp-user-pool', {
      userPoolName: `${process.env.DOMAIN_COGNITO}-userpool`,
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
        email:{
          required: true,
          mutable: false
        }
      },
      customAttributes:{
        userRole: new cognito.StringAttribute({minLen: 1, maxLen: 255, mutable: true})
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.IDPUserPool = idp_user_pool;

    //export user pool id
    new CfnOutput(this, 'idp-userPoolId', {
      value: idp_user_pool.userPoolId,
      description: 'User Pool ID',
      exportName: 'idp-userPoolId',
    });

    // User Pool Client Attributes
    const standardCognitoAttributes = {       
      email: true,
      familyName: true,
      givenName: true,
      locale: true,
      phoneNumber: true,
      emailVerified: true
    };

    const standardCognitoWriteAttributes = {       
      email: true,
      familyName: true,
      givenName: true,
      locale: true,
      phoneNumber: true
    };

    const clientReadAttributes = new cognito.ClientAttributes()
    .withStandardAttributes(standardCognitoAttributes);

    const clientWriteAttributes = new cognito.ClientAttributes()
    .withStandardAttributes(standardCognitoWriteAttributes);

    const userpool_client = idp_user_pool.addClient('idp-poc-app-client', {
      enableTokenRevocation: true,
      generateSecret: false,
      authFlows:{        
        adminUserPassword: true,
        custom: true,
        userPassword: false,
        userSrp: true
      },      
      readAttributes: clientReadAttributes,
      writeAttributes: clientWriteAttributes,
      oAuth:{
        flows:{
          authorizationCodeGrant: true
        },
        scopes:[cognito.OAuthScope.EMAIL, cognito.OAuthScope.PHONE, cognito.OAuthScope.PROFILE, cognito.OAuthScope.OPENID]
      }
    });
    const clientId = userpool_client.userPoolClientId;
    this.IDPUSerPoolClient = clientId;

    //export web client id
    new CfnOutput(this, 'idp-userPoolWebClientId', {
      value: clientId,
      description: 'User Pool Web Client ID',
      exportName: 'idp-userPoolWebClientId',
    }); 

    //Create a Cognito Identity Pool
    const idp_identity_pool = new cognito.CfnIdentityPool(this, 'idp-poc-identity-pool', {
      identityPoolName: 'idp_poc_identity_pool',
      allowUnauthenticatedIdentities: true,
      cognitoIdentityProviders: [
        {
          clientId: clientId,
          providerName: idp_user_pool.userPoolProviderName,
        },
      ],            
    });

    idp_identity_pool.applyRemovalPolicy(RemovalPolicy.DESTROY)

    //export Identity id
    new CfnOutput(this, 'idp-identityPoolId', {
      value: idp_identity_pool.ref,
      description: 'Identity Pool  ID',
      exportName: 'idp-IdentityPoolId',
    });

    //Create Unauth Role for the identity pool
    const identityUnauthRole = new iam.Role(
      this,
      'idp-deid-cognito-unauth-role',
      {
        roleName: 'idp-deid-cognito-unauth-role',
        description: 'Default role for anonymous users',
        assumedBy: new iam.FederatedPrincipal(
          'cognito-identity.amazonaws.com',
          {
            StringEquals: {
              'cognito-identity.amazonaws.com:aud': idp_identity_pool.ref,
            },
            'ForAnyValue:StringLike': {
              'cognito-identity.amazonaws.com:amr': 'unauthenticated',
            },
          },
          'sts:AssumeRoleWithWebIdentity',
        ),
      },
    );

    identityUnauthRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["mobileanalytics:PutEvents", "cognito-sync:*"],
        resources: ["*"],
    }));

    //Create Auth Role for the identity pool
    const identityAuthRole = new iam.Role(
      this, 
      'idp-deid-cognito-auth-role', 
      {
        roleName: 'idp-deid-cognito-auth-role',
        description: 'Default role for authenticated users',
        assumedBy: new iam.FederatedPrincipal(
          'cognito-identity.amazonaws.com',
          {
            StringEquals: {
              'cognito-identity.amazonaws.com:aud': idp_identity_pool.ref,
            },
            'ForAnyValue:StringLike': {
              'cognito-identity.amazonaws.com:amr': 'authenticated',
            },
          },
          'sts:AssumeRoleWithWebIdentity',
        ),
    });

    identityAuthRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["mobileanalytics:PutEvents",
                  "cognito-sync:*",
                  "cognito-identity:*"],
        resources: ["*"],
    }));

    identityAuthRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ],
        resources: [
          `arn:aws:s3:::${idp_root_bucket.bucketName}/public/*`,
          `arn:aws:s3:::${idp_root_bucket.bucketName}/protected/${"${cognito-identity.amazonaws.com:sub}"}/*`,
          `arn:aws:s3:::${idp_root_bucket.bucketName}/private/${"${cognito-identity.amazonaws.com:sub}"}/*`
        ]
    }));

    identityAuthRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [          
          "s3:PutObject"
        ],
        resources: [
          `arn:aws:s3:::${idp_root_bucket.bucketName}/uploads/*`
        ]
    }));

    identityAuthRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [          
          "s3:GetObject"
        ],
        resources: [
          `arn:aws:s3:::i${idp_root_bucket.bucketName}/protected/*`
        ]
    }))

    identityAuthRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [          
          "s3:ListBucket"
        ],
        resources: [
          `arn:aws:s3:::${idp_root_bucket.bucketName}`
        ],
        conditions: {
          "StringLike": {
            "s3:prefix": [
                "public/",
                "public/*",
                "protected/",
                "protected/*",
                "private/${cognito-identity.amazonaws.com:sub}/",
                "private/${cognito-identity.amazonaws.com:sub}/*"
            ]
          }
        }
    }));

    /**
     * Allow the User to call Lambda Rest Endpoints (Lambda Function URLs) once logged in
     * https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html
     */
    identityAuthRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["lambda:InvokeFunctionUrl"],
      resources: ["*"],
      conditions: {
        "StringEquals":{
          "lambda:FunctionUrlAuthType": "AWS_IAM"
        }
      }
    }));

    this.IDPCognitoAuthRole = identityAuthRole.roleArn;

    // Add IAM Roles to Cognito Identity Pool
    new cognito.CfnIdentityPoolRoleAttachment(
      this,
      'deid-identity-pool-role-attachment',
      {
        identityPoolId: idp_identity_pool.ref,
        roles: {
          authenticated: identityAuthRole.roleArn,
          unauthenticated: identityUnauthRole.roleArn,
        },
      },
    );

    //export User Pool Region
    new CfnOutput(this, 'idp-region', {
      value: process.env.IDP_REGION,
      description: 'User Pool Region',
      exportName: 'idp-region',
    });   

    // this.createUser(ism_user_pool.userPoolId);
    new UserPoolUser(this, 'idp_userpool_admin_user', {
      userPool: idp_user_pool.userPoolId,
      username: process.env.ADMIN_USER,
      password: process.env.ADMIN_PASSWORD
    });
  }
}

module.exports = { IdpCdkDeidAppStack }
