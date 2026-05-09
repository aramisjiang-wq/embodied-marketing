import { NextRequest, NextResponse } from "next/server";
import { getWeeklyStats, getYearlyMonthlyStats } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const brandIdsParam = url.searchParams.get("brandIds");
    const period = url.searchParams.get("period") || "month";
    const year = url.searchParams.get("year")
      ? parseInt(url.searchParams.get("year")!)
      : new Date().getFullYear();

    if (!brandIdsParam) {
      return NextResponse.json(
        { success: false, error: "brandIds is required" },
        { status: 400 }
      );
    }

    const brandIds = brandIdsParam.split(",").map((id) => parseInt(id));
    const data = period === "week"
      ? getWeeklyStats(brandIds)
      : getYearlyMonthlyStats(brandIds, year);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching trends:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch trends" },
      { status: 500 }
    );
  }
}
