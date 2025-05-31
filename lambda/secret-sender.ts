import { GetObjectCommand, PutObjectCommand, PutObjectCommandInput, S3Client } from "@aws-sdk/client-s3";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { PublishCommand, PublishInput, SNSClient } from "@aws-sdk/client-sns";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Handler } from "aws-lambda";
import { publicEncrypt } from "node:crypto";

const clientS3 = new S3Client({region: process.env.REGION});
const clientSM = new SecretsManagerClient({region: process.env.REGION});
const clientSNS = new SNSClient({region: process.env.REGION});

export const handler: Handler = async (event, context) => {
    try {
        const publicKeyValue = Buffer.from(await getPublicKey(), 'utf-8');
        const secretValue = Buffer.from(await getSecretValue(), 'utf-8');
        const encrypted = publicEncrypt(publicKeyValue, secretValue); 
        
        const filename = 'encrypted-secret.txt';
        
        await writeToS3(filename, encrypted.toString('base64'));
        
        const presignFile = await preSign(filename);
        
        await sendMessage(presignFile);

    } catch (error) {
        console.log(error);
    }
};

const getSecretValue = async() => { 
    const commandSM = new GetSecretValueCommand({
        SecretId: process.env.MY_SECRET_NAME
    });
    const responseSM = await clientSM.send(commandSM);
    const secretValue = responseSM.SecretString || '';
    return secretValue;
};

const getPublicKey = async () => {
    const commands3 = new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: process.env.FILE_KEY
    });
    const responseS3 = await clientS3.send(commands3);
    const publicKeyValue = await responseS3.Body?.transformToString() || '';
    return publicKeyValue;
};

const sendMessage = async (preSignUrl: string) => {
    const input: PublishInput = {
        TopicArn: process.env.TOPIC_ARN,
        Message: `Here is the link to download the secret.  This link will expire after 30 minutes.\n\n ${preSignUrl}\n\n EOM`,
        Subject: 'Encrypted Client_credentials from XXXX Service',
        MessageStructure: 'html'
    };
    const response = await clientSNS.send(new PublishCommand(input));
}

const writeToS3 = async (filename: string, encrypted: string) => {
    const input: PutObjectCommandInput = {
        Bucket: process.env.BUCKET_NAME,
        Key: filename,
        Body: encrypted
    };
    const response = await clientS3.send(new PutObjectCommand(input));
}

const preSign = async (filename: string) => {
    const command = new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: filename
    });

    const signedUrl = await getSignedUrl(clientS3, command, {
        expiresIn: 1800
    });

    return signedUrl;
}
