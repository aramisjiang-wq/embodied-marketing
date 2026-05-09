import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  getUserInfo,
  createSession,
} from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      console.error("Feishu auth error:", error);
      return NextResponse.redirect(
        new URL(`/login?error=${error}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(new URL("/login?error=no_code", request.url));
    }

    const tokenData = await exchangeCodeForToken(code);

    const userInfo = await getUserInfo(tokenData.access_token);

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || undefined;

    await createSession(
      userInfo,
      tokenData.access_token,
      tokenData.expires_in,
      ipAddress,
      userAgent
    );

    console.log(`User logged in: ${userInfo.name} (${userInfo.email}) from ${ipAddress}`);

    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("Failed to handle Feishu callback:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Authentication failed";

    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
