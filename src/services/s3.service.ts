import AWS from "aws-sdk";
import { Readable } from "stream";
import dotenv from "dotenv";

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

class S3Service {
  private s3: AWS.S3;

  constructor() {
    this.s3 = new AWS.S3();
  }

  // Function to upload a file to S3
  public uploadFile = async (
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    folder = "proposals"
  ): Promise<AWS.S3.ManagedUpload.SendData> => {
    const params: AWS.S3.PutObjectRequest = {
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: `${folder}/${Date.now()}-${fileName}`,
      Body: fileBuffer,
      ContentType: mimeType,
    };

    return this.s3.upload(params).promise();
  };

  // Function to delete a file from S3
  public deleteFile = async (
    fileKey: string
  ): Promise<AWS.S3.DeleteObjectOutput> => {
    const params: AWS.S3.DeleteObjectRequest = {
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: fileKey,
    };

    return this.s3.deleteObject(params).promise();
  };

  // Function to create a read stream for a file in S3
  public getFileStream = (fileKey: string): Readable => {
    const params: AWS.S3.GetObjectRequest = {
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: fileKey,
    };

    return this.s3.getObject(params).createReadStream();
  };
}

export const s3Service = new S3Service();
