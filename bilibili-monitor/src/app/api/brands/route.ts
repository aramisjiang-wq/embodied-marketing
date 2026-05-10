import { NextRequest, NextResponse } from "next/server";
import { getBrandsWithStats, createBrand, getBrandByMid } from "@/lib/db";
import { getSession } from "@/lib/auth";

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
    // All logged-in users can add brands (middleware already enforces login)
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const mid = String(body.mid || "").trim();
    const name = String(body.name || "").trim();

    if (!mid || !name) {
      return NextResponse.json(
        { success: false, error: "MID and name are required" },
        { status: 400 }
      );
    }

    const existingBrand = getBrandByMid(mid);
    if (existingBrand) {
      return NextResponse.json(
        { success: false, error: `厂家已存在：${existingBrand.name}` },
        { status: 409 }
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
