import { NextResponse } from "next/server";
import { getSiteStats, recordLike, recordPageView } from "@/lib/db";

/**
 * GET /api/site-stats
 * 获取网站统计信息（总访问量、今日访问量、爱心数等）
 */
export async function GET() {
  try {
    const stats = getSiteStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("[API/getSiteStats] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "获取统计数据失败",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/like
 * 用户点击爱心助力
 */
export async function POST(request: Request) {
  try {
    // 从请求头获取客户端信息
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const userAgent = request.headers.get("user-agent") || "unknown";

    // 记录爱心助力
    const success = recordLike(ipAddress, userAgent);

    if (success) {
      // 返回最新的统计数据
      const stats = getSiteStats();

      return NextResponse.json({
        success: true,
        message: "感谢您的助力！❤️",
        data: stats,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "助力失败，请重试",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[API/postLike] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "服务器错误",
      },
      { status: 500 }
    );
  }
}
