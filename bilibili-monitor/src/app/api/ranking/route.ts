import { NextResponse } from "next/server";
import { getBrandsWithStatsByYear, getAvailableYears } from "@/lib/db";

/**
 * GET /api/ranking
 *   无参数 → 返回可用年份列表
 *   ?year=YYYY → 返回该自然年发布视频的厂家排名数据
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");

    if (!year) {
      const years = getAvailableYears();
      return NextResponse.json({ success: true, data: { years } });
    }

    if (!/^\d{4}$/.test(year)) {
      return NextResponse.json(
        { success: false, error: "year 参数格式不合法，需为4位数字年份" },
        { status: 400 }
      );
    }

    const brands = getBrandsWithStatsByYear(year);
    return NextResponse.json({ success: true, data: { brands, year } });
  } catch (error) {
    console.error("[api/ranking] error:", error);
    return NextResponse.json(
      { success: false, error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
