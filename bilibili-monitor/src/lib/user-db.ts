// ============================================
// 用户管理相关函数
// ============================================

import { getDb } from "./db";

export interface User {
  id: number;
  open_id: string;
  union_id: string | null;
  name: string;
  en_name: string | null;
  email: string | null;
  mobile: string | null;
  avatar_url: string | null;
  role: "admin" | "editor" | "viewer";
  status: "active" | "disabled";
  last_login_at: string | null;
  login_count: number;
  created_at: string;
  updated_at: string;
}

export interface LoginLog {
  id: number;
  user_id: number;
  ip_address: string | null;
  user_agent: string | null;
  login_at: string;
}

export interface ActionLog {
  id: number;
  user_id: number;
  action: string;
  target_type: string | null;
  target_id: number | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

/**
 * 根据open_id查找或创建用户
 */
export function findOrCreateUser(feishuUser: {
  open_id: string;
  union_id: string;
  name: string;
  en_name: string;
  email: string;
  mobile: string;
  avatar_url: string;
}): User {
  const database = getDb();

  // 先尝试查找已有用户
  const existingUser = database
    .prepare("SELECT * FROM users WHERE open_id = ?")
    .get(feishuUser.open_id) as User | undefined;

  if (existingUser) {
    // 更新用户信息（飞书信息可能变化）
    database.prepare(`
      UPDATE users SET
        name = ?,
        en_name = ?,
        email = ?,
        mobile = ?,
        avatar_url = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE open_id = ?
    `).run(
      feishuUser.name,
      feishuUser.en_name || null,
      feishuUser.email || null,
      feishuUser.mobile || null,
      feishuUser.avatar_url || null,
      feishuUser.open_id
    );

    // 返回更新后的用户
    return database
      .prepare("SELECT * FROM users WHERE open_id = ?")
      .get(feishuUser.open_id) as User;
  }

  // 创建新用户（第一个注册的用户自动成为管理员）
  const userCount = database.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  const role = userCount.count === 0 ? "admin" : "viewer";

  const result = database.prepare(`
    INSERT INTO users (open_id, union_id, name, en_name, email, mobile, avatar_url, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    feishuUser.open_id,
    feishuUser.union_id || null,
    feishuUser.name,
    feishuUser.en_name || null,
    feishuUser.email || null,
    feishuUser.mobile || null,
    feishuUser.avatar_url || null,
    role
  );

  return database
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(result.lastInsertRowid as number) as User;
}

/**
 * 更新用户登录信息
 */
export function updateUserLogin(
  userId: number,
  ipAddress?: string,
  userAgent?: string
): void {
  const database = getDb();

  // 更新最后登录时间和登录次数
  database.prepare(`
    UPDATE users SET
      last_login_at = CURRENT_TIMESTAMP,
      login_count = login_count + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(userId);

  // 记录登录日志
  database.prepare(`
    INSERT INTO login_logs (user_id, ip_address, user_agent)
    VALUES (?, ?, ?)
  `).run(userId, ipAddress || null, userAgent || null);
}

/**
 * 获取所有用户列表
 */
export function getAllUsers(): User[] {
  const database = getDb();
  return database
    .prepare("SELECT * FROM users ORDER BY created_at DESC")
    .all() as User[];
}

/**
 * 根据ID获取用户
 */
export function getUserById(id: number): User | undefined {
  const database = getDb();
  return database
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(id) as User | undefined;
}

/**
 * 更新用户角色
 */
export function updateUserRole(
  userId: number,
  role: "admin" | "editor" | "viewer"
): boolean {
  try {
    const database = getDb();
    database
      .prepare("UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(role, userId);
    return true;
  } catch (error) {
    console.error("[DB/updateUserRole] Error:", error);
    return false;
  }
}

/**
 * 更新用户状态（启用/禁用）
 */
export function updateUserStatus(
  userId: number,
  status: "active" | "disabled"
): boolean {
  try {
    const database = getDb();
    database
      .prepare("UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(status, userId);
    return true;
  } catch (error) {
    console.error("[DB/updateUserStatus] Error:", error);
    return false;
  }
}

/**
 * 删除用户（软删除或硬删除，这里使用硬删除）
 */
export function deleteUser(userId: number): boolean {
  try {
    const database = getDb();

    // 删除相关的登录日志和操作日志
    database.prepare("DELETE FROM login_logs WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM action_logs WHERE user_id = ?").run(userId);

    // 删除用户
    database.prepare("DELETE FROM users WHERE id = ?").run(userId);

    return true;
  } catch (error) {
    console.error("[DB/deleteUser] Error:", error);
    return false;
  }
}

/**
 * 获取用户的登录日志
 */
export function getUserLoginLogs(
  userId: number,
  limit: number = 50
): LoginLog[] {
  const database = getDb();
  return database
    .prepare(
      "SELECT * FROM login_logs WHERE user_id = ? ORDER BY login_at DESC LIMIT ?"
    )
    .all(userId, limit) as LoginLog[];
}

/**
 * 获取最近的所有登录日志
 */
export function getRecentLoginLogs(limit: number = 100): LoginLog[] {
  const database = getDb();
  return database
    .prepare(`
      SELECT ll.*, u.name as user_name, u.avatar_url
      FROM login_logs ll
      JOIN users u ON ll.user_id = u.id
      ORDER BY ll.login_at DESC
      LIMIT ?
    `)
    .all(limit) as (LoginLog & { user_name: string; avatar_url: string | null })[];
}

/**
 * 记录操作日志
 */
export function recordActionLog(params: {
  userId: number;
  action: string;
  targetType?: string;
  targetId?: number;
  details?: string;
  ipAddress?: string;
}): void {
  const database = getDb();
  database.prepare(`
    INSERT INTO action_logs (user_id, action, target_type, target_id, details, ip_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    params.userId,
    params.action,
    params.targetType || null,
    params.targetId || null,
    params.details || null,
    params.ipAddress || null
  );
}

/**
 * 获取操作日志
 */
export function getActionLogs(
  userId?: number,
  limit: number = 100
): ActionLog[] {
  const database = getDb();

  if (userId) {
    return database
      .prepare(
        "SELECT * FROM action_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
      )
      .all(userId, limit) as ActionLog[];
  }

  return database
    .prepare(`
      SELECT al.*, u.name as user_name
      FROM action_logs al
      JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT ?
    `)
    .all(limit) as (ActionLog & { user_name: string })[];
}

/**
 * 获取用户统计信息
 */
export function getUserStats(): {
  totalUsers: number;
  activeUsers: number;
  adminCount: number;
  editorCount: number;
  viewerCount: number;
  newUsersToday: number;
  recentLogins: LoginLog[];
} {
  const database = getDb();

  const today = new Date().toISOString().split('T')[0];

  const totalUsers = (database.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number }).count;
  const activeUsers = (database.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active'").get() as { count: number }).count;
  const adminCount = (database.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'active'").get() as { count: number }).count;
  const editorCount = (database.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'editor' AND status = 'active'").get() as { count: number }).count;
  const viewerCount = (database.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'viewer' AND status = 'active'").get() as { count: number }).count;
  const newUsersToday = (database.prepare("SELECT COUNT(*) as count FROM users WHERE date(created_at) = ?").get(today) as { count: number }).count;

  const recentLogins = getRecentLoginLogs(10);

  return {
    totalUsers,
    activeUsers,
    adminCount,
    editorCount,
    viewerCount,
    newUsersToday,
    recentLogins,
  };
}
