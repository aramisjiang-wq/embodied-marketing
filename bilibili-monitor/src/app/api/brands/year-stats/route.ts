import { NextRequest, NextResponse } from "next/server";
import { getBrandsWithStatsForYear } from "@/lib/db";

function parseYear(request: NextRequest): number | null {
  const raw = request.nextUrl.searchParams.get("year");
  if (raw === null || raw.trim() === "") {
    return null;
  }
  const y = Number.parseInt(raw.trim(), 10);
  if (Number.isNaN(y) || y < 2000 || y > 2100) {
    return null;
  }
  return y;
}

export async function GET(request: NextRequest) {
  try {
    const year = parseYear(request);
    if (year === null) {
      return NextResponse.json(
        { success: false, error: "Query year is required (2000–2100)" },
        { status: 400 }
      );
    }
    const brands = getBrandsWithStatsForYear(year);
    return NextResponse.json({
      success: true,
      data: { year, brands },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Invalid year") {
      return NextResponse.json(
        { success: false, error: "Invalid year" },
        { status: 400 }
      );
    }
    console.error("Error fetching year brand stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch year stats" },
      { status: 500 }
    );
  }
}
