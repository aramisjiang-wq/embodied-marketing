"use client";

import { useState, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Video, Trash2, ExternalLink } from "lucide-react";
import { AddBrandModal } from "@/components/AddBrandModal";
import { Card, CardTitle, Button, Badge, SearchInput, EmptyState } from "@/components/ui";
import type { BrandWithStats } from "@/lib/types";

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + "万";
  }
  return num.toLocaleString();
}

export default function BrandsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<BrandWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const [brandsRes, sessionRes] = await Promise.all([
          fetch("/api/brands"),
          fetch("/api/auth/session"),
        ]);
        const brandsData = await brandsRes.json();
        if (!cancelled && brandsData.success) {
          setBrands(brandsData.data || []);
        }
        if (!cancelled && sessionRes.ok) {
          const sessionData = await sessionRes.json();
          setIsAdmin(sessionData?.data?.user?.role === "admin");
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定要删除"${name}"吗？所有关联数据将被删除。`)) return;
    try {
      await fetch(`/api/brands/${id}`, { method: "DELETE" });
      const response = await fetch("/api/brands");
      const data = await response.json();
      if (data.success) {
        setBrands(data.data || []);
      }
    } catch {
      // silent
    }
  };

  const handleAddBrand = async (mid: string, name: string) => {
    const response = await fetch("/api/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mid, name }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || "添加失败");
    }

    const res = await fetch("/api/brands");
    const data = await res.json();
    if (data.success) {
      setBrands(data.data || []);
    }
  };

  const filteredBrands = brands.filter((brand) =>
    brand.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in">
      <Card padding="none">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>厂家管理</CardTitle>
            <Badge variant="default">{filteredBrands.length} 个</Badge>
          </div>
          <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowAddModal(true)}>
            添加厂家
          </Button>
        </div>

        {/* Search Bar */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <SearchInput
              placeholder="搜索厂家名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              className="max-w-sm"
            />
          </div>
        </div>

        {/* Table Content */}
        {filteredBrands.length === 0 ? (
          <EmptyState
            icon={<Video className="w-6 h-6" />}
            title={search ? "未找到匹配的厂家" : "暂无厂家数据"}
            description={search ? "请尝试其他关键词" : "添加第一个厂家开始监控"}
            action={
              !search
                ? {
                    label: "添加第一个厂家",
                    onClick: () => setShowAddModal(true),
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr className="border-b border-gray-200">
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide">厂家</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide">视频数</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide">粉丝</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide">播放量</th>
                  <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBrands.map((brand) => (
                  <tr
                    key={brand.id}
                    className="hover:bg-gray-50 transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{brand.name}</span>
                        {brand.is_self === 1 && (
                          <Badge variant="warning" size="sm">自</Badge>
                        )}
                        <span className="text-[10px] text-gray-400 font-mono">MID: {brand.mid}</span>
                      </div>
                    </td>
                    <td className="text-right px-4 py-3.5 text-gray-600 tabular-nums">
                      {brand.video_count || 0}
                    </td>
                    <td className="text-right px-4 py-3.5 text-gray-600 tabular-nums">
                      {formatNumber(brand.follower || 0)}
                    </td>
                    <td className="text-right px-4 py-3.5 font-semibold text-gray-900 tabular-nums">
                      {formatNumber(brand.total_views || 0)}
                    </td>
                    <td className="text-right px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<ExternalLink className="w-3.5 h-3.5" />}
                          onClick={() => startTransition(() => router.push(`/brand/${brand.id}`))}
                        >
                          详情
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={() => handleDelete(brand.id, brand.name)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            删除
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AddBrandModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddBrand}
      />
    </div>
  );
}
