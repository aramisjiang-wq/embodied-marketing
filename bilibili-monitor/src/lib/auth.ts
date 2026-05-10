import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  findOrCreateUser,
  updateUserLogin,
  type User as DBUser,
} from "./user-db";

export interface FeishuUser {
  open_id: string;
  union_id: string;
  name: string;
  en_name: string;
  avatar_url: string;
  email: string;
  mobile: string;
}

export interface AuthSession {
  user: FeishuUser & {
    id: number;
    role: "admin" | "editor" | "viewer";
    status: "active" | "disabled";
  };
  access_token: string;
  expires_at: number;
  login_time: string;
}

const SESSION_COOKIE_NAME = "feishu_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const FEISHU_APP_ID = process.env.FEISHU_APPID || "";
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || "";

function getRedirectUri(): string {
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000/api/auth/callback";
  }
  return `${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/auth/callback`;
}

export function buildFeishuAuthUrl(): string {
  const redirectUri = getRedirectUri();
  const state = generateState();

  const params = new URLSearchParams({
    client_id: FEISHU_APP_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    state: state,
    scope: "contact:user.base:readonly",
  });

  return `https://open.feishu.cn/open-apis/authen/v1/authorize?${params.toString()}`;
}

function generateState(): string {
  return Math.random().toString(36).substring(2, 15);
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}> {
  const response = await fetch(
    "https://open.feishu.cn/open-apis/authen/v2/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: FEISHU_APP_ID,
        client_secret: FEISHU_APP_SECRET,
        code: code,
        redirect_uri: getRedirectUri(),
      }),
    }
  );

  const data = await response.json();
  console.log("[Auth] Token exchange response status:", response.status, "body:", JSON.stringify(data));

  if (!response.ok) {
    // v2 OAuth standard error format: { error: "...", error_description: "..." }
    const errMsg = data.error_description || data.error || data.msg || response.statusText;
    throw new Error(`Token exchange failed: ${errMsg}`);
  }

  // authen/v2/oauth/token follows standard OAuth2 — tokens are at the top level,
  // NOT wrapped in { code, data: { ... } } like the v1 APIs.
  if (data.access_token) {
    return data;
  }

  // Fallback: some Feishu environments still wrap in { code, data }
  if (data.code === 0 && data.data?.access_token) {
    return data.data;
  }

  throw new Error(`Unexpected token response: ${JSON.stringify(data)}`);
}

export async function getUserInfo(accessToken: string): Promise<FeishuUser> {
  const response = await fetch(
    "https://open.feishu.cn/open-apis/authen/v1/user_info",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user info: ${error}`);
  }

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`Feishu API error: ${data.msg}`);
  }

  return data.data;
}

export async function createSession(
  user: FeishuUser,
  accessToken: string,
  expiresIn: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  // 查找或创建本地用户记录
  const dbUser = findOrCreateUser(user);

  // 检查用户是否被禁用
  if (dbUser.status === "disabled") {
    throw new Error("Account has been disabled");
  }

  // 更新登录信息
  updateUserLogin(dbUser.id, ipAddress, userAgent);

  const session: AuthSession = {
    user: {
      ...user,
      id: dbUser.id,
      role: dbUser.role,
      status: dbUser.status,
    },
    access_token: accessToken,
    expires_at: Date.now() + expiresIn * 1000,
    login_time: new Date().toISOString(),
  };

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const session: AuthSession = JSON.parse(sessionCookie.value);

    if (session.expires_at < Date.now()) {
      await destroySession();
      return null;
    }

    return session;
  } catch {
    await destroySession();
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

/**
 * 权限检查辅助函数 - 用于API路由中验证用户角色
 * 
 * @param request Next.js请求对象
 * @param allowedRoles 允许访问的角色列表
 * @returns { session: AuthSession } 验证通过的用户会话
 * @throws NextResponse 如果未登录或权限不足，直接返回错误响应
 * 
 * @example
 * // 在API路由中使用：
 * export async function POST(request: NextRequest) {
 *   const { session } = await requireRole(request, ["admin", "editor"]);
 *   // 只有 admin 和 editor 才能执行到这里
 *   
 *   const body = await request.json();
 *   // ... 业务逻辑
 * }
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: ("admin" | "editor" | "viewer")[]
): Promise<{ session: AuthSession }> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    throw NextResponse.json(
      { success: false, error: "Not authenticated. Please login first." },
      { status: 401 }
    );
  }

  try {
    const session: AuthSession = JSON.parse(sessionCookie.value);

    if (session.expires_at < Date.now()) {
      throw NextResponse.json(
        { success: false, error: "Session expired. Please login again." },
        { status: 401 }
      );
    }

    if (session.user.status === "disabled") {
      throw NextResponse.json(
        { success: false, error: "Account has been disabled. Contact administrator." },
        { status: 403 }
      );
    }

    if (!allowedRoles.includes(session.user.role)) {
      throw NextResponse.json(
        {
          success: false,
          error: `Insufficient permissions. Required roles: [${allowedRoles.join(", ")}], Your role: ${session.user.role}`,
        },
        { status: 403 }
      );
    }

    return { session };
  } catch (error) {
    if (error instanceof NextResponse) {
      throw error;
    }
    
    console.error("[Auth/requireRole] Failed to parse session:", error);
    throw NextResponse.json(
      { success: false, error: "Invalid session. Please login again." },
      { status: 401 }
    );
  }
}

/**
 * 快捷方法：要求管理员权限
 */
export async function requireAdmin(request: NextRequest): Promise<{ session: AuthSession }> {
  return requireRole(request, ["admin"]);
}

/**
 * 快捷方法：要求编辑者或管理员权限
 */
export async function requireEditor(request: NextRequest): Promise<{ session: AuthSession }> {
  return requireRole(request, ["admin", "editor"]);
}
