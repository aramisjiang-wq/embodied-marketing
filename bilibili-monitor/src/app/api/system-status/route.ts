import { NextResponse } from "next/server";
import { getSystemStatus } from "@/lib/db";

export async function GET() {
  try {
    const status = getSystemStatus();
    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("获取系统状态失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: "获取系统状态失败",
      },
      { status: 500 }
    );
  }
}
