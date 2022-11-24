const { Form, Input, Select } = require('enquirer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const chalk = require('chalk');
const { exec } = require('child_process');
const id = uuidv4();

let ACCOUNT_ID = undefined;
const log = console.log;

const strvalidate = (value, state, item, index) => {
    if (/^[A-Za-z0-9\-]*$/.test(value)){
        return true;
    }else{        
        return 'Error: may only contain alphanumeric characters and hyphens (-)';
    }
};

const emailvalidate = (value, state, item, index) => {
    const emailFormat = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
    if (value.match(emailFormat)){
        return true;
    }else{        
        return 'Error: email must be of the format user@email.com';
    }
};

const pwdvalidate = (value, state, item, index) => {
    const pwdFormat = /^(?=.*\p{Ll})(?=.*\p{Lu})(?=.*[\d|@#$!%*?&])[\p{L}\d@#$!%*?&]{8,99}$/gmu;
    if (pwdFormat.test(value)){
        return true;
    }else{        
        return 'Error: Password must be at least 8 characters and contain at least 1 uppercase, 1 lowercase, 1 digit and 1 special character @#$!%*?&';
    }
};

const input = (name, message, initial, validate, required=false) => {
    return prompt => {
      let p = new Input({ name, message, initial, validate, required });
      return p.run().then(value => ({ name, message, initial: value, value }));
    };
  };

const choice = (name, message, choices, initial) => {
    return prompt => {
      let p = new Select({ name, message, choices, initial });
      return p.run().then(value => ({ name, message, initial: value, value }));
    };
  };

const choices = [
    input('bucket', `Enter S3 Bucket name [default: idp-deid-${id}]`, `idp-deid-${id}`, strvalidate),
    input('cognitoDomain', `Enter Cognito domain name [default: idp-cognito-${id}]`, `idp-cognito-${id}`, strvalidate),
    choice('region', 'Choose an AWS region [default: us-east-1]', [
                    'us-east-1',
                    'us-east-2',            
                    'us-west-2',
                    'ap-south-1',
                    'ap-southeast-2',
                    'ca-central-1',
                    'eu-west-1',
                    'eu-west-2'
                  ], 0),
    input('username', 'Email address (to access UI)', undefined, emailvalidate),
    input('userpwd', 'Password (to access UI)', undefined, pwdvalidate)
];

exec('aws sts get-caller-identity --query Account --output text', (err, stdout, stderr) => {
    if (!err) {
        if(stdout){
            ACCOUNT_ID = stdout;
            choices.push(input('awsAccount', 'AWS Account ID [this account]', ACCOUNT_ID.trim(), undefined, true));
            choices.push(input('accessKey', 'AWS Access Key ID (optional)', undefined, undefined, false));
            choices.push(input('secretKey', 'AWS Secret access key (optional)', undefined, undefined, false));
            // log(chalk.green(`AWS Account ID Detected: ${ACCOUNT_ID}, will be used to deploy this project`))
        }
    }else{
        choices.push(input('awsAccount', 'AWS Account ID (where this application will be deployed)', undefined, undefined, true));
        choices.push(input('accessKey', 'AWS Access Key ID (credential to deploy)', undefined, undefined, true));
        choices.push(input('secretKey', 'AWS Secret access key (credential to deploy)', undefined, undefined, true));
    }
    log(chalk.bgCyan.bold(' ==== Please enter the required values ==== '));
    console.log('\n')
    setupApp();
});


const setupApp = () => {
    const prompt = new Form({
        name: 'config',
        message: 'Review and confirm entries:',
        choices: choices
    });
  
    prompt.run()
        .then(answers => {
            let env_config;
            env_config = `ROOT_BUCKET=${answers['bucket']}\n`;
            env_config = env_config+`DOMAIN_COGNITO=${answers['cognitoDomain']}\n`;
            env_config = env_config+`DOMAIN_NAME=${id}\n`;
            env_config = env_config+`IDP_REGION=${answers['region']}\n`;
            env_config = env_config+`ADMIN_USER=${answers['username']}\n`;
            env_config = env_config+`ADMIN_PASSWORD='${answers['userpwd']}'`;
            
            fs.writeFileSync('./.env', env_config);    
            
            if(!answers?.awsAccount){
                answers['awsAccount'] = ACCOUNT_ID.trim();
            }
            
            const env= {};
            if(answers?.accessKey && answers?.secretKey){
                env['env'] = {
                    'AWS_ACCESS_KEY_ID': answers['accessKey'],
                    'AWS_SECRET_ACCESS_KEY': answers['secretKey'],
                    'AWS_IDP_ACCOUNT_ID': answers['awsAccount'],
                    'AWS_IDP_REGION': answers['region'],
                    ...process.env
                };
                log(chalk.green("✔ Set up credentials complete"));
            }else{
                env['env'] = {
                    'AWS_IDP_ACCOUNT_ID': answers['awsAccount'],
                    'AWS_IDP_REGION': answers['region'],
                    ...process.env
                };
                log(chalk.green("✔ Credentials inferred from AWS Profile"));
            }
            
            log(chalk.green("✔ Bootstrapping cdk project..."));
            log(chalk.green(`✔ Running cdk bootstrap aws://${answers['awsAccount'].trim()}/${answers['region']}...`));
            const bootStrap = exec(`cdk bootstrap aws://$AWS_IDP_ACCOUNT_ID/$AWS_IDP_REGION`, env, (err, stdout, stderr) => {
                if (err) {
                    log(chalk.red("✗ "+err));
                }else{
                    log(chalk.green("✔ Bootstrapping complete..."));
                }
            });
            
            bootStrap.stdout.on('data', function(data) {
                log(chalk.green("✔ "+data));
            });
        })
        .catch(console.error);
};