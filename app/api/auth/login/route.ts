import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_MAX_AGE, AUTH_COOKIE_NAME, createAuthSession, encodeAuthSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";

type LoginPayload = {
  identifier?: string;
  password?: string;
};

type LoginDocument = {
  email?: string;
  username?: string;
  userName?: string;
  name?: string;
  fullName?: string;
  role?: string;
  status?: string;
  password?: string;
};

function normalizeIdentifier(identifier: string) {
  return identifier.trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LoginPayload;
    const identifier = normalizeIdentifier(body.identifier ?? "");
    const password = body.password?.trim() ?? "";

    if (!identifier || !password) {
      return NextResponse.json({ message: "Username/email and password are required." }, { status: 400 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json({ message: "Database connection is unavailable." }, { status: 500 });
    }

    const loginCollection = db.collection<LoginDocument>("login");
    const totalAccounts = await loginCollection.countDocuments();
    if (totalAccounts === 0) {
      return NextResponse.json(
        { message: "Collection login does not have any configured account yet." },
        { status: 404 }
      );
    }

    const exactIdentifierPattern = new RegExp(`^${escapeRegExp(identifier)}$`, "i");
    const account = await loginCollection.findOne({
      $or: [
        { email: { $regex: exactIdentifierPattern } },
        { username: { $regex: exactIdentifierPattern } },
        { userName: { $regex: exactIdentifierPattern } },
      ],
    });

    if (!account || !account.password || account.password !== password) {
      return NextResponse.json({ message: "Incorrect username/email or password." }, { status: 401 });
    }

    if (typeof account.status === "string" && account.status.toLowerCase() !== "active") {
      return NextResponse.json({ message: "This account is inactive." }, { status: 403 });
    }

    const session = createAuthSession({
      name: account.fullName ?? account.name,
      email: account.email,
      username: account.username ?? account.userName ?? identifier,
      role: account.role,
    });

    const response = NextResponse.json({
      name: session.name,
      email: session.email,
      role: session.role,
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: encodeAuthSession(session),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE,
    });

    return response;
  } catch {
    return NextResponse.json({ message: "Failed to sign in." }, { status: 500 });
  }
}
