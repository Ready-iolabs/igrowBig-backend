const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
require("dotenv").config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const uploadToS3 = async (file, folder) => {
  if (!file || !file.path || !file.filename) {
    throw new Error("Invalid file object: missing path or filename");
  }
  if (!folder) {
    throw new Error("Folder parameter is missing");
  }

  console.log("Uploading to S3:", { folder, filename: file.filename });

  const fileContent = fs.readFileSync(file.path);
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `${folder}/${file.filename}`,
    Body: fileContent,
    ContentType: file.mimetype,
  };

  const command = new PutObjectCommand(params);
  await s3.send(command);
  fs.unlinkSync(file.path); // Remove temp file
  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
};

const deleteFromS3 = async (fileUrl) => {
  if (!fileUrl) {
    throw new Error("File URL is missing");
  }

  const key = fileUrl.split(`${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`)[1];
  if (!key) {
    throw new Error(`Invalid S3 URL: unable to extract Key from ${fileUrl}`);
  }

  console.log("Deleting from S3:", { key });

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  };

  const command = new DeleteObjectCommand(params);
  await s3.send(command);
};

module.exports = { uploadToS3, deleteFromS3 };