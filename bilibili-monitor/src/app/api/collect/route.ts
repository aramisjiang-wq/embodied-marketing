import { NextResponse } from "next/server";
import { runCollector } from "@/lib/collector";

export async function POST() {
  try {
    const result = await runCollector();
    return NextResponse.json({ success: true, output: result });
  } catch (error) {
    console.error("Error running collector:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Collection failed" },
      { status: 500 }
    );
  }
}
