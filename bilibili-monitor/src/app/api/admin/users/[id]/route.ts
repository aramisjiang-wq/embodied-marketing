import { NextRequest, NextResponse } from "next/server";
import {
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await checkAdminAuth(request);

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error === "Not authenticated" ? 401 : 403 }
      );
    }

    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: "Invalid user ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { role, status } = body;

    // 防止修改自己的角色
    if (auth.session.user.id === userId && role) {
      return NextResponse.json(
        { success: false, error: "Cannot modify your own role" },
        { status: 400 }
      );
    }

    // 更新角色
    if (role && ["admin", "editor", "viewer"].includes(role)) {
      updateUserRole(userId, role);
    }

    // 更新状态
    if (status && ["active", "disabled"].includes(status)) {
      updateUserStatus(userId, status);
    }

    const updatedUser = getUserById(userId);

    return NextResponse.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await checkAdminAuth(request);

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error === "Not authenticated" ? 401 : 403 }
      );
    }

    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: "Invalid user ID" },
        { status: 400 }
      );
    }

    // 防止删除自己
    if (auth.session.user.id === userId) {
      return NextResponse.json(
        { success: false, error: "Cannot delete yourself" },
        { status: 400 }
      );
    }

    deleteUser(userId);

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
