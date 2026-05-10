import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  getUserInfo,
  createSession,
} from "@/lib/auth";

function getAppBaseUrl(request: NextRequest): string {
  // Use explicitly configured base URL to avoid 0.0.0.0 bind-address leaking into redirects
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  // Fallback: derive from x-forwarded-host or host header (never from request.url which may contain 0.0.0.0)
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:8082";
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const baseUrl = getAppBaseUrl(request);

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      console.error("Feishu auth error:", error);
      return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return NextResponse.redirect(`${baseUrl}/login?error=no_code`);
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

    return NextResponse.redirect(`${baseUrl}/`);
  } catch (error) {
    console.error("Failed to handle Feishu callback:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Authentication failed";

    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent(errorMessage)}`
    );
  }
}
