import { cookies } from "next/headers";
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`Feishu API error: ${data.msg}`);
  }

  return data.data;
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
