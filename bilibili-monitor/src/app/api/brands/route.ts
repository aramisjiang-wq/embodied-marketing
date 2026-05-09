import { NextRequest, NextResponse } from "next/server";
import { getBrandsWithStats, createBrand, deleteBrand, updateBrand } from "@/lib/db";
import { requireEditor } from "@/lib/auth";

export async function GET() {
  try {
    const brands = getBrandsWithStats();
    return NextResponse.json({ success: true, data: brands });
  } catch (error) {
    console.error("Error fetching brands:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch brands" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireEditor(request);

    const body = await request.json();
    const { mid, name } = body;

    if (!mid || !name) {
      return NextResponse.json(
        { success: false, error: "MID and name are required" },
        { status: 400 }
      );
    }

    const brand = createBrand(mid, name);
    return NextResponse.json({ success: true, data: brand }, { status: 201 });
  } catch (error) {
    if (error instanceof NextResponse) {
      throw error;
    }
    console.error("Error creating brand:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create brand" },
      { status: 500 }
    );
  }
}
