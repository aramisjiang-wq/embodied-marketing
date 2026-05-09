"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Users,
  Shield,
  UserCheck,
  UserX,
  Trash2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import type { User, LoginLog } from "@/lib/user-db";

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  adminCount: number;
  editorCount: number;
  viewerCount: number;
  newUsersToday: number;
  recentLogins: (LoginLog & { user_name: string; avatar_url: string | null })[];
  actionLogs: Array<{ id: number; user_name: string; action: string; created_at: string }>;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "logs" | "stats">("users");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  useEffect(() => {
    loadCurrentUser();
    loadData();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (data.success) {
        setCurrentUserRole(data.data.user.role || "viewer");
      }
    } catch (error) {
      console.error("Failed to load current user:", error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const [usersRes, statsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/users/stats"),
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        if (usersData.success) {
          setUsers(usersData.data);
        }
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(statsData.data);
        }
      }
    } catch (error) {
      console.error("Failed to load admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: number, role: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (res.ok) {
        loadData();
      } else {
        alert("更新失败");
      }
    } catch (error) {
      console.error("Failed to update role:", error);
      alert("操作失败");
    }
  };

  const handleToggleStatus = async (userId: number, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    const confirmMessage =
      newStatus === "disabled"
        ? "确定要禁用该用户吗？禁用后用户将无法登录。"
        : "确定要启用该用户吗？";

    if (!confirm(confirmMessage)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        loadData();
      } else {
        alert("更新失败");
      }
    } catch (error) {
      console.error("Failed to toggle status:", error);
      alert("操作失败");
    }
  };

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`确定要删除用户 "${userName}" 吗？此操作不可恢复。`)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        loadData();
      } else {
        alert("删除失败");
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
      alert("删除失败");
    }
  };

  // 非管理员显示无权限提示
  if (currentUserRole && currentUserRole !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            无权限访问
          </h2>
          <p className="text-sm text-gray-500">
            只有管理员才能访问此页面
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-600" />
            用户管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            管理系统用户、角色权限和登录日志
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          刷新数据
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard
            title="总用户数"
            value={stats.totalUsers}
            icon={<Users className="w-5 h-5" />}
            color="blue"
          />
          <StatCard
            title="活跃用户"
            value={stats.activeUsers}
            icon={<UserCheck className="w-5 h-5" />}
            color="green"
          />
          <StatCard
            title="管理员"
            value={stats.adminCount}
            icon={<Shield className="w-5 h-5" />}
            color="purple"
          />
          <StatCard
            title="编辑者"
            value={stats.editorCount}
            icon={<UserCheck className="w-5 h-5" />}
            color="orange"
          />
          <StatCard
            title="今日新增"
            value={stats.newUsersToday}
            icon={<Users className="w-5 h-5" />}
            color="pink"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="border-b border-gray-200 px-6 pt-4">
          <nav className="flex space-x-8">
            <TabButton
              active={activeTab === "users"}
              onClick={() => setActiveTab("users")}
              label="用户列表"
              icon={<Users className="w-4 h-4" />}
            />
            <TabButton
              active={activeTab === "logs"}
              onClick={() => setActiveTab("logs")}
              label="登录日志"
              icon={<RefreshCw className="w-4 h-4" />}
            />
            <TabButton
              active={activeTab === "stats"}
              onClick={() => setActiveTab("stats")}
              label="统计概览"
              icon={<Shield className="w-4 h-4" />}
            />
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "users" && (
            <UsersTable
              users={users}
              loading={loading}
              onUpdateRole={handleUpdateRole}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDeleteUser}
            />
          )}

          {activeTab === "logs" && (
            <LogsPanel logs={stats?.recentLogins || []} loading={loading} />
          )}

          {activeTab === "stats" && (
            <StatsPanel stats={stats} loading={loading} />
          )}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
    pink: "bg-pink-50 text-pink-600",
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500">{title}</span>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
        active
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// Users Table Component
function UsersTable({
  users,
  loading,
  onUpdateRole,
  onToggleStatus,
  onDelete,
}: {
  users: User[];
  loading: boolean;
  onUpdateRole: (id: number, role: string) => void;
  onToggleStatus: (id: number, status: string) => void;
  onDelete: (id: number, name: string) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-16 w-full" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">暂无用户数据</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              用户
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              角色
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              状态
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              登录次数
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              最后登录
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {user.avatar_url ? (
                    <Image
                      src={user.avatar_url}
                      alt={user.name}
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-white"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-500">
                        {user.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900 text-sm">
                      {user.name}
                    </div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <select
                  value={user.role}
                  onChange={(e) => onUpdateRole(user.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="admin">管理员</option>
                  <option value="editor">编辑者</option>
                  <option value="viewer">查看者</option>
                </select>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onToggleStatus(user.id, user.status)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    user.status === "active"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {user.status === "active" ? (
                    <UserCheck className="w-3 h-3" />
                  ) : (
                    <UserX className="w-3 h-3" />
                  )}
                  {user.status === "active" ? "正常" : "已禁用"}
                </button>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {user.login_count}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {user.last_login_at
                  ? new Date(user.last_login_at).toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-"}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onDelete(user.id, user.name)}
                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors"
                  title="删除用户"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Logs Panel Component
function LogsPanel({
  logs,
  loading,
}: {
  logs: (LoginLog & { user_name: string; avatar_url: string | null })[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-12 w-full" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">暂无登录日志</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
        >
          <div className="flex items-center gap-3">
            {log.avatar_url ? (
              <Image
                src={log.avatar_url}
                alt={log.user_name}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-xs font-medium text-gray-500">
                  {log.user_name?.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <div className="font-medium text-sm text-gray-900">
                {log.user_name}
              </div>
              <div className="text-xs text-gray-500">
                {log.ip_address || "未知IP"} ·{" "}
                {new Date(log.login_at).toLocaleString("zh-CN", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Stats Panel Component
function StatsPanel({
  stats,
  loading,
}: {
  stats: UserStats | null;
  loading: boolean;
}) {
  if (loading || !stats) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Role Distribution */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          角色分布
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-purple-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-600">
              {stats.adminCount}
            </div>
            <div className="text-xs text-purple-600 mt-1">管理员</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-orange-600">
              {stats.editorCount}
            </div>
            <div className="text-xs text-orange-600 mt-1">编辑者</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">
              {stats.viewerCount}
            </div>
            <div className="text-xs text-blue-600 mt-1">查看者</div>
          </div>
        </div>
      </div>

      {/* Recent Activity Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-yellow-800">
            安全提示
          </h4>
          <ul className="mt-2 text-xs text-yellow-700 space-y-1">
            <li>• 第一个注册的用户自动成为管理员</li>
            <li>• 建议至少保留2个管理员账号</li>
            <li>• 定期检查异常登录日志</li>
            <li>• 离职员工应及时禁用账号</li>
          </ul>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          系统信息
        </h3>
        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex justify-between">
            <span>总注册用户:</span>
            <span className="font-medium">{stats.totalUsers}</span>
          </div>
          <div className="flex justify-between">
            <span>当前活跃:</span>
            <span className="font-medium text-green-600">
              {stats.activeUsers}
            </span>
          </div>
          <div className="flex justify-between">
            <span>今日新注册:</span>
            <span className="font-medium text-blue-600">
              +{stats.newUsersToday}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
