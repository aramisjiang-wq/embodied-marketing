"use client";

import { useState, memo, startTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import type { BrandWithStats } from "@/lib/types";
import { SiteStats } from "@/components/SiteStats";

interface SidebarProps {
  brands?: BrandWithStats[];
  selectedBrands?: number[];
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = memo(function Sidebar({
  brands = [],
  selectedBrands = [],
  isOpen = true,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { icon: LayoutDashboard, label: "数据概览", href: "/", active: pathname === "/" },
    { icon: BarChart3, label: "厂家对比", href: "/compare", active: pathname === "/compare" },
    { icon: Settings, label: "厂家管理", href: "/brands", active: pathname === "/brands" },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          bg-white border-r border-gray-200
          flex flex-col
          transition-all duration-300 ease-out
          ${isCollapsed ? "w-16" : "w-56"}
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className={`h-14 flex items-center border-b border-gray-100 px-3 ${
          isCollapsed ? "justify-center" : "justify-between"
        }`}>
          <img
            src="/logo.png"
            alt="LimX Dynamics"
            className={`h-7 w-auto object-contain transition-all duration-200 cursor-pointer ${
              isCollapsed ? "hover:opacity-100" : ""
            } ${isCollapsed ? "opacity-70" : ""}`}
            onClick={() => isCollapsed && startTransition(() => setIsCollapsed(false))}
            title={isCollapsed ? "点击展开侧边栏" : ""}
          />
          <div className={`flex items-center gap-2 ${isCollapsed ? "hidden" : ""}`}>
            {/* 网站统计 - 极简模式 */}
            <SiteStats variant="compact" />

            {/* 分隔符 */}
            <div className="w-px h-4 bg-gray-200"></div>

            <button
              onClick={() => startTransition(() => setIsCollapsed(!isCollapsed))}
              className="p-1.5 hover:bg-gray-100 rounded-lg hidden lg:block transition-colors"
              title={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg lg:hidden transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-2.5 py-4 space-y-0.5 flex-1">
          {navItems.map((item) => {
            const isActive = item.active;
            return (
              <button
                key={item.href}
                onClick={() => {
                  startTransition(() => {
                    router.push(item.href);
                  });
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                  transition-all duration-150 relative group
                  ${
                    isActive
                      ? "bg-gray-900 text-white font-medium shadow-sm"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }
                `}
              >
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white rounded-r-full" />
                )}
                <item.icon
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isActive ? "text-white" : "text-gray-500 group-hover:text-gray-700"
                  }`}
                />
                {!isCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer - 品牌计数 */}
        <div className="px-3 pb-4 pt-4 border-t border-gray-100">
          {!isCollapsed && (
            <div className="flex items-center justify-between px-2">
              <div>
                <p className="text-xs font-medium text-gray-700">
                  {brands.length} 个品牌
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  已选 {selectedBrands.length} 个
                </p>
              </div>
              <div className="w-2 h-2 rounded-full bg-green-500" title="系统正常运行" />
            </div>
          )}
          {isCollapsed && (
            <div className="flex justify-center">
              <div className="w-2 h-2 rounded-full bg-green-500" title="系统正常运行" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
});
