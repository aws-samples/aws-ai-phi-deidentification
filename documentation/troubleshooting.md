# Troubleshooting

Although, the single-command deployment is expected to handle the build and deployment for you and fail gracefully, but as we all know, things can (and will) break in real world. So here are some common causes of failures and how to troubleshoot them.

### Deployment failed due insufficient space in Cloud9 environment

If you are using AWS Cloud9 environment to deploy the project, you may run into insufficient space. The build process in the project creates Docker images that can grow large in size. With a Cloud9 instance the default storage assigned is usually 10Gb, which at times can be insufficient for deployment purposes of medium to large projects. If you encounter space issues, you can refer to [this document](https://docs.aws.amazon.com/cloud9/latest/user-guide/move-environment.html#move-environment-resize) to quickly execute a script to resize the disk of your Cloud9 environment. 

Once you have resized, you can retry the installation steps. If you continue to encounter Stack related issues, you may need to delete the CloudFormation stacks manually and retry the installation. The following step discusses manual stack deletion.

### Reverting from a deployment failure

You may have to delete the stacks if your deployment fails unexpectedly in the middle of the deployment. The CDK application in this project deploys a number of different stacks, so it is possible for a few stacks get deployed correctly, while others fail. In such cases, the best course of action is to delete all the stacks manually from Amazon CloudFormation console. It is safe to delete these CloudFormation stacks manually in the following order-

- `IDPDeidWebDeployStack` (this will delete a nested stack within it)
- `IDPDeidBackendStack`
- `IdpCdkDeidAppStack`
- `IDPDeidLambdaStack`
- `IDPDeidStepFunctionStack`

To delete CloudFormation stacks, navigate to the AWS CloudFormation console, select the stack name and click "Delete" button at the top. Delete one stack at a time.

### Stack deletion failures

Once you are done with your project, you may want to delete the CloudFormation stacks using the [cleanup steps](../README.md#cleaning-up). One of the common reasons for the stack deletion to fail is non-empty Amazon S3 buckets. If you have successfully deployed the project before, and have been using it, chances are that you have documents and files in the IDP S3 bucket that was created as part of the project. The CDK app is created in a way that removal of the stack will also remove the contents of the bucket before deleting the bucket automatically. However, in some cases there may be situations where files may still be present in the bucket because you have enabled versioning on it (either manually after the bucket was created, or by modifying [the stack](../idp-cdk-app/lib/idp-cdk-app-stack.js) before deployment). In such cases, you must delete all the object versions within the bucket manually before proceeding to delete the Stack itself.

> **NOTE**: Please make sure to backup all your data from the IDP S3 bucket before deleting the objects.

### Reverting all changes

At times, you may want to start a fresh install by deleting all the partially deployed stacks. You can follow the instructions above to delete the application stacks in CloudFormation. However, the AWS CDK Bootstrap process also creates resources that you may want to delete. To delete resources created by the bootstrap process, you can delete the stack named `CDKToolkit` from CloudFormation manually. Subsequently, can you also delete the CDK bootstrap S3 bucket which will have a naming convention of `cdk-xxxxxxxx-assets-<account_id>-<region>`.

Note that the `CDKToolkit` stack deletion may fail if the `cdk-xxxxxxxx-assets-<account_id>-<region>` is not empty. If that happens, delete the contents of the bucket manually and retry the stack deletion. Finally, delete the bucket manually.

> **NOTE**: It is safe to delete the CDK Bootstrap resources. The installation process will attempt to bootstrap and create all the necessary resources again.

### I've customized the stack, and now I am encountering circular stack references error

Circular dependencies happen when Stack A depends on Stack B, which in turn depends on Stack A, causing the circular reference. It may not be immediately obvious of such dependencies when developing. Refer to [Handling circular dependency errors in AWS CloudFormation](https://aws.amazon.com/blogs/infrastructure-and-automation/handling-circular-dependency-errors-in-aws-cloudformation/) for more information. You can also refer to [this CDK GitHub document](https://github.com/aws/aws-cdk/tree/main/packages/aws-cdk-lib#removing-automatic-cross-stack-references) for tips and tricks on handling cross stack dependencies with CDK. 

---