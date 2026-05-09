import { NextRequest, NextResponse } from "next/server";
import { getThisWeekVideos } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const brandIdsParam = url.searchParams.get("brandIds");

    if (!brandIdsParam) {
      return NextResponse.json(
        { success: false, error: "brandIds parameter is required" },
        { status: 400 }
      );
    }

    const brandIds = brandIdsParam.split(",").map((id) => parseInt(id));

    if (brandIds.some(isNaN)) {
      return NextResponse.json(
        { success: false, error: "Invalid brandIds format" },
        { status: 400 }
      );
    }

    const data = getThisWeekVideos(brandIds);

    console.log(`[API/ThisWeekVideos] 返回 ${data.length} 条本周视频`);

    return NextResponse.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    console.error("[API/ThisWeekVideos] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
