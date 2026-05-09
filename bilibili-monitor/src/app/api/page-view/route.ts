import { NextResponse } from "next/server";
import { recordPageView } from "@/lib/db";

/**
 * POST /api/page-view
 * 记录一次页面访问（PV）
 */
export async function POST(request: Request) {
  try {
    // 从请求头获取客户端信息
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // 记录访问
    recordPageView(ipAddress);

    return NextResponse.json({
      success: true,
      message: "访问已记录",
    });
  } catch (error) {
    console.error("[API/postPageView] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "记录失败",
      },
      { status: 500 }
    );
  }
}
