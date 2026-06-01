import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase, getResolvedMongoUri, mongoTarget } from "@/lib/mongodb";

type LoginDocument = {
  email?: string;
  username?: string;
  userName?: string;
  name?: string;
  fullName?: string;
  role?: string;
  status?: string;
};

function maskValue(value: string | undefined) {
  if (!value) {
    return "";
  }

  if (value.length <= 4) {
    return "*".repeat(value.length);
  }

  return `${value.slice(0, 2)}${"*".repeat(Math.max(value.length - 4, 1))}${value.slice(-2)}`;
}

function getConfiguredDatabaseName(uri: string) {
  try {
    const parsed = new URL(uri);
    const pathname = parsed.pathname.replace(/^\/+/, "").trim();
    return pathname || "";
  } catch {
    return "";
  }
}

function buildSafeUriSummary(uri: string) {
  try {
    const parsed = new URL(uri);
    const databaseName = getConfiguredDatabaseName(uri) || "(default)";

    return {
      protocol: parsed.protocol.replace(":", ""),
      host: parsed.host,
      databaseName,
    };
  } catch {
    return {
      protocol: "unknown",
      host: "unknown",
      databaseName: "unknown",
    };
  }
}

export async function GET(req: Request) {
  const configuredSecret = process.env.AUTH_DEBUG_SECRET?.trim();
  const requestUrl = new URL(req.url);
  const providedSecret =
    req.headers.get("x-debug-secret")?.trim() ||
    requestUrl.searchParams.get("secret")?.trim() ||
    "";

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json({ message: "Database connection is unavailable." }, { status: 500 });
    }

    const loginCollection = db.collection<LoginDocument>("login");
    const [collections, totalAccounts, activeAccounts, sampleAccount] = await Promise.all([
      db.listCollections({}, { nameOnly: true }).toArray(),
      loginCollection.countDocuments(),
      loginCollection.countDocuments({ status: /^active$/i }),
      loginCollection.findOne({}, { projection: { password: 0 } }),
    ]);

    const collectionNames = collections.map((collection) => collection.name).sort();

    return NextResponse.json({
      nodeEnv: process.env.NODE_ENV ?? "",
      vercelEnv: process.env.VERCEL_ENV ?? "",
      mongoTarget,
      resolvedConnection: buildSafeUriSummary(getResolvedMongoUri()),
      connectedDatabaseName: db.databaseName,
      hasLoginCollection: collectionNames.includes("login"),
      loginAccountCount: totalAccounts,
      activeLoginAccountCount: activeAccounts,
      sampleLoginAccount: sampleAccount
        ? {
            email: maskValue(sampleAccount.email),
            username: sampleAccount.username ?? sampleAccount.userName ?? "",
            name: sampleAccount.fullName ?? sampleAccount.name ?? "",
            role: sampleAccount.role ?? "",
            status: sampleAccount.status ?? "",
          }
        : null,
      collectionNames,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to inspect authentication configuration.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
