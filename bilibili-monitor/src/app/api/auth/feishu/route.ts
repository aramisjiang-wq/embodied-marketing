import { NextResponse } from "next/server";
import { buildFeishuAuthUrl } from "@/lib/auth";

export async function GET() {
  try {
    const authUrl = buildFeishuAuthUrl();

    return NextResponse.json({
      success: true,
      data: {
        auth_url: authUrl,
      },
    });
  } catch (error) {
    console.error("Failed to build Feishu auth URL:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate authorization URL",
      },
      { status: 500 }
    );
  }
}
