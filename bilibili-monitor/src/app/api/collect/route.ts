import { NextResponse } from "next/server";
import { runCollector } from "@/lib/collector";
import { requireEditor } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await requireEditor(request as any);

    const result = await runCollector();
    return NextResponse.json({ success: true, output: result });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    console.error("Error running collector:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Collection failed" },
      { status: 500 }
    );
  }
}
