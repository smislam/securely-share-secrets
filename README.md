# Securely Share Secrets with your Clients
In this example, we provide a solution to securely share secrets with clients.  The [AWS Secrets Manager cross-account access](https://docs.aws.amazon.com/secretsmanager/latest/userguide/auth-and-access_examples_cross.html) is a great way to securely share secrets with clients. However, in certain cases this may not be possible when you have large number of clients that you will have to configure each separately.

This application uses `Public-key cryptography` based on [RSA Asymmetric encryption](https://www.ibm.com/think/topics/asymmetric-encryption) to encrypt secret.  Then, it securely shares the secret with client using the following workflow.

## Workflows
**Sending Application Workflow**
```mermaid
sequenceDiagram
autonumber
    Client->>+Provider: Send email and public certificate

    box Provider (Sender) Workflow
        participant Provider
        participant SNS
        participant S3
        participant Secrets Manager
    end
    
    SNS->>+Client: Send email verification email
    Client->>+Client: Verify email using SNS message
    rect rgb(128, 162, 207)
    Provider->>+S3: Store the public certificate
    Secrets Manager->>+Provider: Get secret
    Provider->>+Provider: Encrypt the secret<br/>using public certificate
    Provider->>+S3: Store the encrypted file
    Provider->>+Provider: Create pre-signed URL
    Provider->>+SNS: Send message to<br/>SNS topic   
    SNS-->>+Client: Send email to client
    end
```
* Ask the Client to share their RSA Public Certificate
* Create Secret for Client
* Encrypt the Secret with Client's Public Certificate
* Save the encrypted secret in S3 bucket
* Pre-sign the URL for Client Download
* Send a SNS message to Client which will email them the S3 pre-signed URL link.

**Receiving Application Workflow**
```mermaid
sequenceDiagram
autonumber
    Client->>+Provider S3: Fetch encrypted secret file<br/> using Pre-signed URL
    destroy Provider S3
    Provider S3-->>+Client: Returns encrypted<br/>secret file
    Client->>+Client S3: Store encrypted secret file to S3
    Client->>+Client: Decrypt the encrypted secret<br/> using private certificate
    Client->>+Secrets Manager: Store the decrypted secret
    Client->>+Client: Reboot systems if necessary
```
* Download the S3 file using the Pre-signed URL
* Decrypt the file content using the RSA Private Certificate
* Store the decrypted Secret in AWS Secret Manager

This application is developed using AWS CDK in TypeScript.

## What does this build?
* Creates a S3 bucket for holding the certificates
* Creates a lambda that performs the Sender workflow
* Creates another lambda that performs the Receiver workflow
* Creates an API Gateway endpoint for the receiver lambda invocation in this example
  * You may want to create automation to invoke the lambda. One such example can be to write the file to S3 and have S3 event invoke the lambda.

*Note: This example uses both of these workflows in one.  For example, we do not need to download the encrypted secret and store on client's S3 since we are using the same S3 bucket for both of these workflows.*

## Steps to run and test
* Run the CDK code and wait for it to finish
* Check your email from AWS for SNS message subscription verification
    * ![image](sns-confirmation.PNG "Example SNS Confirmation message from AWS")
* Accept and approve the confirmation
* Create the RSA Private and Public certificates
    * Generate the private key: `openssl genrsa -out client-one-private.pem 4096`
    * Generate the public key: `openssl rsa -in client-one-private.pem -out client-one-public.pem -pubout`
* Upload the certificates to the S3 Bucket
* Check your email for AWS SNS message with S3 pre-sigend URL
    * ![image](encrypted-secret-email.PNG "Example SNS credentials email from AWS")
    * ![image](encrypted-secret-content.PNG "Example SNS credentials message content from AWS")
* Invoke the API Gateway endpoint. The lambda behind the API will create a new decrypted Secrets Manager entry.
* Verify that the new secret is same as the original secret ✅
* ![image](resulted-secret.PNG "Example of the two secrets")

## Considerations
* Rather than creating a new secret each time, *client* could update existing secrets. Remember, this may require an application reboot based on your setup.
* I didn't include `Secret Rotation` workflow in this application. If you have secret rotations, you will need to automate the process to run from those events.
* There are many opportunities to simplify this solution.  Some examples:
    * Use Step Functions for these workflows
    * Rather than emailing Public Certificate, you can create S3 pre-sign URL for your client to download
    * Create separate Key Pairs for clients

## References
* [RSA Cryptography Specifications](https://www.rfc-editor.org/rfc/rfc8017)
* [OpenSSL](https://www.openssl.org/)
* [Node Crypto](https://nodejs.org/api/crypto.html)
* [Amazon Secrets Manager](https://aws.amazon.com/secrets-manager/)
* [Amazon Lambda](https://aws.amazon.com/lambda/)
* [Amazon S3](https://aws.amazon.com/s3/)
* [Amazon API Gateway](https://aws.amazon.com/api-gateway/)