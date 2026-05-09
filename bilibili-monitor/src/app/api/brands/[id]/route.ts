import { NextRequest, NextResponse } from "next/server";
import {
  getBrandById,
  getBrandWithStatsById,
  updateBrand,
  deleteBrand,
  getVideosByBrand,
  getBrandMonthlyStats,
} from "@/lib/db";
import { requireEditor } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const brand = getBrandWithStatsById(parseInt(id));

    if (!brand) {
      return NextResponse.json(
        { success: false, error: "Brand not found" },
        { status: 404 }
      );
    }

    const url = new URL(request.url);
    const includeVideos = url.searchParams.get("videos") === "true";
    const includeStats = url.searchParams.get("stats") === "true";

    const response: Record<string, unknown> = { success: true, data: brand };

    if (includeVideos) {
      response.videos = getVideosByBrand(parseInt(id));
    }

    if (includeStats) {
      response.monthlyStats = getBrandMonthlyStats(parseInt(id));
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching brand:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch brand" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireEditor(request);

    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    const brand = getBrandById(parseInt(id));
    if (!brand) {
      return NextResponse.json(
        { success: false, error: "Brand not found" },
        { status: 404 }
      );
    }

    updateBrand(parseInt(id), name);
    return NextResponse.json({ success: true, data: { id: parseInt(id), name } });
  } catch (error) {
    if (error instanceof NextResponse) {
      throw error;
    }
    console.error("Error updating brand:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update brand" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireEditor(request);

    const { id } = await params;
    const brand = getBrandById(parseInt(id));

    if (!brand) {
      return NextResponse.json(
        { success: false, error: "Brand not found" },
        { status: 404 }
      );
    }

    deleteBrand(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) {
      throw error;
    }
    console.error("Error deleting brand:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete brand" },
      { status: 500 }
    );
  }
}
