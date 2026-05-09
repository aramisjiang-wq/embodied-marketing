import { NextRequest, NextResponse } from "next/server";
import { getComparisonData, getWeeklyStats } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const brandIdsParam = url.searchParams.get("brandIds");
    const period = url.searchParams.get("period") || "month";
    const months = parseInt(url.searchParams.get("months") || "12");

    if (!brandIdsParam) {
      return NextResponse.json(
        { success: false, error: "brandIds is required" },
        { status: 400 }
      );
    }

    const brandIds = brandIdsParam.split(",").map((id) => parseInt(id));

    let data;
    if (period === "week") {
      data = getWeeklyStats(brandIds);
      console.log(`[API/Compare] 返回周度数据: ${data.length} 条记录`);
    } else {
      data = getComparisonData(brandIds, months);
      console.log(`[API/Compare] 返回月度数据: ${data.length} 条记录`);
    }

    return NextResponse.json({ success: true, data, period });
  } catch (error) {
    console.error("[API/Compare] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch comparison data" },
      { status: 500 }
    );
  }
}
