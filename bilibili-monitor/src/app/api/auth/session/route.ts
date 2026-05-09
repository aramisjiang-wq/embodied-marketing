import { NextResponse } from "next/server";
import { getSession, isAuthenticated } from "@/lib/auth";

export async function GET() {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return NextResponse.json(
        {
          success: false,
          error: "Not authenticated",
        },
        { status: 401 }
      );
    }

    const session = await getSession();

    return NextResponse.json({
      success: true,
      data: {
        user: session?.user,
        login_time: session?.login_time,
      },
    });
  } catch (error) {
    console.error("Failed to get session:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get session",
      },
      { status: 500 }
    );
  }
}
