import dns from "node:dns";
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

function resolveConfiguredMongoUri() {
  if (mongoTarget === "production") {
    const directUri = process.env.MONGODB_URI_PRODUCTION_DIRECT?.trim();
    if (directUri) {
      return directUri;
    }

    const uri = process.env.MONGODB_URI_PRODUCTION;
    if (!uri) {
      throw new Error("Please define the MONGODB_URI_PRODUCTION environment variable.");
    }

    return uri;
  }

  const directUri = process.env.MONGODB_URI_LOCAL_DIRECT?.trim();
  if (directUri) {
    return directUri;
  }

  const uri = process.env.MONGODB_URI_LOCAL;
  if (!uri) {
    throw new Error("Please define the MONGODB_URI_LOCAL environment variable.");
  }

  return uri;
}

const mongoUri = resolveConfiguredMongoUri();

let cachedConnectUri: string | null = null;

function configureMongoDns() {
  if (isVercelDeployment) {
    return;
  }

  const configuredServers = process.env.MONGODB_DNS_SERVERS?.split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  dns.setServers(configuredServers?.length ? configuredServers : ["8.8.8.8", "1.1.1.1"]);
}

async function resolveMongoConnectUri(uri: string) {
  if (!uri.startsWith("mongodb+srv://")) {
    return uri;
  }

  configureMongoDns();

  const normalized = new URL(uri.replace("mongodb+srv://", "https://"));
  const srvHost = `_mongodb._tcp.${normalized.hostname}`;
  const [records, txtRecords] = await Promise.all([
    dns.promises.resolveSrv(srvHost),
    dns.promises.resolveTxt(srvHost).catch(() => [] as string[][]),
  ]);

  let replicaSet = "";
  for (const txt of txtRecords) {
    const joined = txt.join("");
    const match = joined.match(/replicaSet=([^&\s]+)/);
    if (match?.[1]) {
      replicaSet = match[1];
      break;
    }
  }

  const credentials =
    normalized.username.length > 0
      ? `${encodeURIComponent(decodeURIComponent(normalized.username))}:${encodeURIComponent(decodeURIComponent(normalized.password))}@`
      : "";
  const hosts = records.map((record) => `${record.name}:${record.port}`).join(",");
  const databaseName = normalized.pathname.replace(/^\//, "");
  const params = new URLSearchParams(normalized.search);

  params.set("ssl", "true");
  if (replicaSet) {
    params.set("replicaSet", replicaSet);
  }
  if (!params.has("authSource")) {
    params.set("authSource", "admin");
  }

  const query = params.toString();
  return `mongodb://${credentials}${hosts}/${databaseName}${query ? `?${query}` : ""}`;
}

async function getMongoConnectUri() {
  if (cachedConnectUri) {
    return cachedConnectUri;
  }

  cachedConnectUri = await resolveMongoConnectUri(mongoUri);
  return cachedConnectUri;
}

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

export function isMongoNetworkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|MongoNetworkError|querySrv|Server selection timed out/i.test(
    error.message
  );
}

export async function connectToDatabase() {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = getMongoConnectUri()
      .then((connectUri) =>
        mongoose.connect(connectUri, {
          serverSelectionTimeoutMS: 15000,
        })
      )
      .catch((error) => {
        cache.promise = null;
        cache.conn = null;
        throw error;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
