import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

function buildMongoUriFromParts() {
  const host = process.env.MONGO_HOST || "127.0.0.1";
  const port = Number(process.env.MONGO_PORT || 27017);
  const dbName = process.env.MONGO_DB || "feuerwehr_checkliste";
  const user = process.env.MONGO_USER;
  const password = process.env.MONGO_PASSWORD;

  if (user && password) {
    const encodedUser = encodeURIComponent(user);
    const encodedPassword = encodeURIComponent(password);
    return `mongodb://${encodedUser}:${encodedPassword}@${host}:${port}/${dbName}?authSource=admin`;
  }

  return `mongodb://${host}:${port}/${dbName}`;
}

function resolveMongoUri() {
  const envUrl = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (envUrl) {
    return envUrl;
  }

  const genericUrl = process.env.DATABASE_URL;
  if (genericUrl && genericUrl.startsWith("mongodb")) {
    return genericUrl;
  }

  return buildMongoUriFromParts();
}

export async function connectDatabase() {
  const mongoUri = resolveMongoUri();
  await mongoose.connect(mongoUri);
}

export { mongoose };
