import { NextResponse } from "next/server";
import { getMonthlyStats, getBrandsWithStats } from "@/lib/db";

export async function GET() {
  try {
    const brands = getBrandsWithStats();
    const monthlyStats = getMonthlyStats();

    const totalVideos = brands.reduce((sum, b) => sum + (b.video_count || 0), 0);
    const totalViews = brands.reduce((sum, b) => sum + (b.total_views || 0), 0);
    const totalFollowers = brands.reduce((sum, b) => sum + (b.follower || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        brands,
        monthlyStats,
        summary: {
          totalBrands: brands.length,
          totalVideos,
          totalViews,
          totalFollowers,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching overview:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch overview" },
      { status: 500 }
    );
  }
}
