"use client";

import { useState, useEffect, useCallback, useRef, startTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  BarChart3,
  Settings,
  X,
  LogOut,
  User,
  Shield,
} from "lucide-react";
import { FilterProvider, useFilter } from "@/components/layout/FilterContext";
import { AddBrandModal } from "@/components/AddBrandModal";
import { SiteStats } from "@/components/SiteStats";
import type { BrandWithStats } from "@/lib/types";
import Image from "next/image";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "数据概览", href: "/" },
  { icon: BarChart3, label: "厂家对比", href: "/compare" },
  { icon: Settings, label: "厂家管理", href: "/brands" },
] as const;

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const { brands, setBrands, selectedBrands, setSelectedBrands } = useFilter();
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    avatar_url: string;
    email: string;
    role?: string;
  } | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isNavigatingRef = useRef(false);

  const loadOverview = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/overview", { signal: controller.signal });
      const data = await res.json();

      if (!controller.signal.aborted && data.success) {
        const brandList: BrandWithStats[] = data.data.brands || [];
        setBrands(brandList);
        setSelectedBrands(brandList.map((b) => b.id));
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Failed to load overview:', error);
      }
    }
  }, [setBrands, setSelectedBrands]);

  const loadCurrentUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();

      if (data.success && data.data?.user) {
        setCurrentUser({
          name: data.data.user.name,
          avatar_url: data.data.user.avatar_url,
          email: data.data.user.email,
          role: data.data.user.role,
        });
      }
    } catch (error) {
      console.error("Failed to load current user:", error);
    }
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  useEffect(() => {
    loadOverview();
    loadCurrentUser();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadOverview]);

  useEffect(() => {
    setSidebarOpen(false);
    isNavigatingRef.current = false;
  }, [pathname]);

  const handleNavClick = (href: string) => {
    if (isNavigatingRef.current || pathname === href) return;

    isNavigatingRef.current = true;
    setSidebarOpen(false);

    startTransition(() => {
      router.push(href);
    });

    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 300);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* ====== 顶栏 ====== */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 lg:px-5 flex-shrink-0 z-40 relative">
        {/* Left: Mobile menu + Logo + Collapse toggle */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <img
            src="/logo.png"
            alt="LimX Dynamics"
            className="h-7 w-auto object-contain"
          />
          <span
            className={`
              text-sm font-semibold text-gray-800 whitespace-nowrap
              transition-all duration-300 ease-out overflow-hidden
              ${sidebarCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100 ml-2"}
            `}
          >
            LimX Marketing
          </span>
          <button
            onClick={() => startTransition(() => setSidebarCollapsed(!sidebarCollapsed))}
            className="hidden lg:flex p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>

        {/* Right: User Info + Site Stats */}
        <div className="ml-auto flex items-center gap-3">
          <SiteStats variant="compact" />

          {/* User Avatar & Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {currentUser?.avatar_url ? (
                <Image
                  src={currentUser.avatar_url}
                  alt={currentUser.name}
                  width={28}
                  height={28}
                  className="w-7 h-7 rounded-full object-cover ring-2 ring-white"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-500" />
                </div>
              )}
              {!sidebarCollapsed && (
                <span className="text-sm text-gray-700 font-medium max-w-[120px] truncate">
                  {currentUser?.name || "用户"}
                </span>
              )}
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">
                      {currentUser?.name || "用户"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {currentUser?.email || ""}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ====== Body: Sidebar + Content ====== */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - 无独立 header，从顶栏下方开始 */}
        <aside
          className={`
            fixed inset-y-0 left-0 top-14 z-30
            bg-white border-r border-gray-200
            flex flex-col transition-all duration-300 ease-out
            ${sidebarCollapsed ? "w-16" : "w-56"}
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          {/* Navigation */}
          <nav className="px-2.5 py-3 flex-1 overflow-y-auto custom-scrollbar">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <button
                  key={item.href}
                  onClick={() => handleNavClick(item.href)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                    transition-all duration-150 relative group mb-0.5
                    ${
                      isActive
                        ? "bg-gray-900 text-white font-medium shadow-sm"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }
                  `}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white rounded-r-full" />
                  )}
                  <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isActive ? "text-white" : "text-gray-500 group-hover:text-gray-700"
                  }`} />
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              );
            })}

            {/* Admin Panel - Only for admin users */}
            {currentUser && (currentUser as any).role === "admin" && (() => {
              const isAdminActive = pathname === "/admin";
              return (
                <button
                  onClick={() => handleNavClick("/admin")}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                    transition-all duration-150 relative group mb-0.5 mt-4 pt-4 border-t border-gray-100
                    ${
                      isAdminActive
                        ? "bg-purple-600 text-white font-medium shadow-sm"
                        : "text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                    }
                  `}
                >
                  {isAdminActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white rounded-r-full" />
                  )}
                  <Shield className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isAdminActive ? "text-white" : "text-purple-500 group-hover:text-purple-700"
                  }`} />
                  {!sidebarCollapsed && (
                    <span className="truncate">系统管理</span>
                  )}
                </button>
              );
            })()}
          </nav>

          {/* Footer */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-100">
            {!sidebarCollapsed ? (
              <div className="flex items-center justify-between px-2">
                <div>
                  <p className="text-xs font-medium text-gray-700">{brands.length} 个品牌</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">已选 {selectedBrands.length} 个</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500" title="系统正常运行" />
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="w-2 h-2 rounded-full bg-green-500" title="系统正常运行" />
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <div className={`flex-1 flex flex-col min-w-0 ${!sidebarCollapsed ? "lg:ml-56" : "lg:ml-16"} transition-all duration-300`}>
          <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
        </div>
      </div>

      {/* Add Brand Modal */}
      {showAddBrandModal && (
        <AddBrandModal
          isOpen={showAddBrandModal}
          onClose={() => setShowAddBrandModal(false)}
          onAdd={loadOverview}
        />
      )}
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FilterProvider>
      <DashboardContent>{children}</DashboardContent>
    </FilterProvider>
  );
}
