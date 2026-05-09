import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  updateUserStatus,
  deleteUser,
} from "@/lib/user-db";

async function checkAdminAuth(request: NextRequest) {
  const sessionCookie = request.cookies.get("feishu_session");

  if (!sessionCookie?.value) {
    return { authorized: false, error: "Not authenticated" };
  }

  try {
    const session = JSON.parse(sessionCookie.value);

    if (session.expires_at < Date.now()) {
      return { authorized: false, error: "Session expired" };
    }

    if (session.user?.role !== "admin") {
      return { authorized: false, error: "Admin access required" };
    }

    return { authorized: true, session };
  } catch {
    return { authorized: false, error: "Invalid session" };
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await checkAdminAuth(request);

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error === "Not authenticated" ? 401 : 403 }
      );
    }

    const users = getAllUsers();

    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Failed to get users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get users" },
      { status: 500 }
    );
  }
}
