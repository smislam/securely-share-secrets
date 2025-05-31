import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { CreateSecretCommand, PutSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { Handler } from "aws-lambda";
import { privateDecrypt } from "node:crypto";

const clientS3 = new S3Client({region: process.env.REGION});
const clientSM = new SecretsManagerClient({region: process.env.REGION});

export const handler: Handler = async (event, context) => {
    try {
        const privateKeyValue = Buffer.from(await getPrivateKey(process.env.FILE_KEY || ''), 'utf-8');
        const encryptedSecretValueFromS3 = Buffer.from(await getPrivateKey('encrypted-secret.txt'), 'base64');
        const decrypted = privateDecrypt(privateKeyValue, encryptedSecretValueFromS3); 
        await writeSecretValue(decrypted.toString('utf-8'));

    } catch (error) {
        return {
            statusCode: 200,
            body: JSON.stringify(error),
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify('New Secret added'),
    };
};

//Use Update Secret Command if you want to replace an existing secret
const writeSecretValue = async(secret: string) => { 
    const commandSM = new CreateSecretCommand({
        Name: 'MySuperSecretAppSecret',
        SecretString: `{"appsecret":"${secret}"}`
    });
    await clientSM.send(commandSM);
};

const getPrivateKey = async (key: string) => {
    const commandS3 = new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: key
    });
    const responseS3 = await clientS3.send(commandS3);
    return responseS3.Body?.transformToString() || '';    
};