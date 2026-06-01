import mongoose from "mongoose";

const isVercelDeployment = process.env.VERCEL === "1" || typeof process.env.VERCEL_ENV === "string";

export const mongoTarget =
  process.env.MONGODB_TARGET === "production"
    ? "production"
    : process.env.MONGODB_TARGET === "local"
      ? "local"
      : isVercelDeployment || process.env.NODE_ENV === "production"
        ? "production"
        : "local";

const resolvedMongoUri =
  mongoTarget === "production"
    ? process.env.MONGODB_URI_PRODUCTION
    : process.env.MONGODB_URI_LOCAL;

if (!resolvedMongoUri) {
  throw new Error(
    mongoTarget === "production"
      ? "Please define the MONGODB_URI_PRODUCTION environment variable."
      : "Please define the MONGODB_URI_LOCAL environment variable."
  );
}

const mongoUri: string = resolvedMongoUri;

export function getResolvedMongoUri() {
  return mongoUri;
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const globalCache = globalThis as typeof globalThis & { mongooseCache?: MongooseCache };

const cache: MongooseCache = globalCache.mongooseCache ?? { conn: null, promise: null };

if (!globalCache.mongooseCache) {
  globalCache.mongooseCache = cache;
}

export async function connectToDatabase() {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(mongoUri);
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
