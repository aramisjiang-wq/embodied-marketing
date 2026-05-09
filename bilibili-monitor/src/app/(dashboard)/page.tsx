"use client";

import { useState, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Video, Eye, Users, Plus, Activity, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { BrandHeatmap } from "@/components/BrandHeatmap";
import { BrandScatterPlot } from "@/components/BrandScatterPlot";
import { BrandRankingTable } from "@/components/BrandRankingTable";
import { ThisWeekVideos } from "@/components/ThisWeekVideos";
import { useFilter } from "@/components/layout/FilterContext";
import { AddBrandModal } from "@/components/AddBrandModal";
import { StatCard, Card, CardHeader, CardTitle, Badge, SearchInput, Button } from "@/components/ui";
import type { BrandWithStats, BrandPeriodStat } from "@/lib/types";

interface BrandData extends BrandWithStats {
  is_self?: number;
}

type ViewType = "cards" | "scatter" | "ranking";

function formatNumber(num: number): string {
  if (num >= 100000000) return (num / 100000000).toFixed(1) + "亿";
  if (num >= 10000) return (num / 10000).toFixed(1) + "万";
  return num.toLocaleString();
}

export default function DashboardPage() {
  const router = useRouter();
  const { brands: filterBrands, selectedBrands, setSelectedBrands, period, setPeriod, setBrands, selectedYear, setSelectedYear } = useFilter();
  const [brands, setBrandsState] = useState<BrandData[]>([]);
  const [trendData, setTrendData] = useState<BrandPeriodStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandSearch, setBrandSearch] = useState("");
  const [viewType, setViewType] = useState<ViewType>("cards");
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [collectStatus, setCollectStatus] = useState<{
    is_running: boolean;
    completed_brands: number;
    total_brands: number;
    last_run_summary?: {
      total_videos: number;
      success_count: number;
      total_brands: number;
      duration: number;
      completed_at: string;
    } | null;
  } | null>(null);

  useEffect(() => {
    if (filterBrands.length > 0) {
      setBrandsState(filterBrands as BrandData[]);
      setLoading(false);
    }
  }, [filterBrands]);

  useEffect(() => {
    const fetchCollectStatus = async () => {
      try {
        const res = await fetch("/api/collect-status");
        const data = await res.json();
        if (data.success) {
          setCollectStatus(data.data);
        }
      } catch {
        // silent
      }
    };

    fetchCollectStatus();

    const interval = setInterval(fetchCollectStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedBrands.length === 0) return;
    let cancelled = false;
    const ids = selectedBrands.join(",");

    const params = new URLSearchParams({
      brandIds: ids,
      period: period,
    });

    if (period === "month") {
      params.append("year", selectedYear.toString());
    }

    fetch(`/api/trends?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success && data.data) {
          setTrendData(data.data);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedBrands, period, selectedYear]);

  const selectedBrandData = brands.filter((b) =>
    selectedBrands.includes(b.id)
  );
  const totalVideos = selectedBrandData.reduce(
    (sum, b) => sum + (b.video_count || 0),
    0
  );
  const totalViews = selectedBrandData.reduce(
    (sum, b) => sum + (b.total_views || 0),
    0
  );

  const filteredBrands = brandSearch.trim()
    ? brands.filter((b) =>
        b.name.toLowerCase().includes(brandSearch.toLowerCase())
      )
    : brands;

  const handleAddBrand = () => {
    setShowAddBrandModal(true);
  };

  const handleBrandAdded = async () => {
    fetch("/api/overview")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const brandList = data.data.brands || [];
          setBrands(brandList);
          setBrandsState(brandList as BrandData[]);
        }
      })
      .catch(() => {});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="skeleton w-12 h-12 rounded-full"></div>
          <div className="skeleton w-32 h-4 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Stats Cards - 统一白色卡片 + 左侧色条 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="视频总数"
          value={totalVideos.toLocaleString()}
          subtitle="个视频"
          icon={<Video className="w-4 h-4" />}
          accentColor="#2563EB"
        />
        <StatCard
          title="总播放量"
          value={formatNumber(totalViews)}
          subtitle="累计播放"
          icon={<Eye className="w-4 h-4" />}
          accentColor="#7C3AED"
        />
        <StatCard
          title="监控品牌"
          value={`${selectedBrands.length}/${brands.length}`}
          subtitle="个品牌"
          icon={<Users className="w-4 h-4" />}
          accentColor="#059669"
        />
        <div className="relative overflow-hidden bg-white rounded-xl border border-gray-200 p-5 transition-all duration-200 hover:shadow-md hover:border-gray-300">
          <div className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full bg-orange-500"></div>
          <div className="pl-3">
            {/* Header: Title + Status Badge */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-50">
                  <Activity className={`w-4 h-4 ${collectStatus?.is_running ? "text-orange-500 animate-pulse" : "text-orange-500"}`} />
                </div>
                <span className="text-sm font-medium text-gray-600">数据采集</span>
              </div>
              {collectStatus?.is_running ? (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                  采集中
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                  <CheckCircle className="w-3 h-3" />
                  就绪
                </span>
              )}
            </div>

            {/* Main Value */}
            {collectStatus?.is_running ? (
              <>
                <p className="text-2xl font-bold text-gray-900 tracking-tight">
                  {collectStatus.completed_brands}/{collectStatus.total_brands}
                </p>
                <p className="text-xs text-gray-500 mt-1">品牌采集中...</p>
              </>
            ) : collectStatus?.last_run_summary ? (
              <>
                <p className="text-2xl font-bold text-gray-900 tracking-tight">
                  {collectStatus.last_run_summary.total_videos.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">上次采集视频</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-400 tracking-tight">--</p>
                <p className="text-xs text-gray-400 mt-1">等待首次采集</p>
              </>
            )}

            {/* Detailed Info Grid - Only show when not running and has history */}
            {!collectStatus?.is_running && collectStatus?.last_run_summary && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                {/* Row 1: Time + Duration */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>上次</span>
                  </div>
                  <span className="font-medium text-gray-700">
                    {new Date(collectStatus.last_run_summary.completed_at).toLocaleString("zh-CN", {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                {/* Row 2: Success Rate + Duration */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <TrendingUp className="w-3 h-3" />
                    <span>成功率</span>
                  </div>
                  <span className={`font-medium ${
                    collectStatus.last_run_summary.success_count === collectStatus.last_run_summary.total_brands
                      ? 'text-green-600'
                      : 'text-orange-600'
                  }`}>
                    {collectStatus.last_run_summary.success_count}/{collectStatus.last_run_summary.total_brands}
                    {collectStatus.last_run_summary.total_brands > 0 && ` (${Math.round((collectStatus.last_run_summary.success_count / collectStatus.last_run_summary.total_brands) * 100)}%)`}
                  </span>
                </div>

                {/* Row 3: Duration */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Activity className="w-3 h-3" />
                    <span>耗时</span>
                  </div>
                  <span className="font-medium text-gray-700">
                    {collectStatus.last_run_summary.duration >= 60
                      ? `${Math.round(collectStatus.last_run_summary.duration / 60)}分${collectStatus.last_run_summary.duration % 60}秒`
                      : `${collectStatus.last_run_summary.duration}秒`
                    }
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* This Week Videos Widget - 移到厂家对比上方 */}
      <ThisWeekVideos />

      {/* Brand Selector - 始终展开，带搜索和添加功能 */}
      <Card padding="none">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>厂家对比</CardTitle>
            <Badge variant="default">{selectedBrands.length} 已选</Badge>
          </div>
          <Button variant="secondary" size="sm" icon={<Plus className="w-3 h-3" />} onClick={handleAddBrand}>
            添加厂家
          </Button>
        </div>

        {/* Content - 始终显示 */}
        <div className="p-5">
          {/* 操作栏：全选/清空 + 搜索 */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedBrands(brands.map((b) => b.id))}
              >
                全选
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedBrands([])}
              >
                清空
              </Button>
            </div>

            <SearchInput
              placeholder="搜索厂家..."
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              onClear={() => setBrandSearch("")}
              className="max-w-xs"
            />
          </div>

          {/* 厂家列表 */}
          {(brandSearch ? filteredBrands : brands).length > 0 ? (
            <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
              {(brandSearch ? filteredBrands : brands)
                .sort((a, b) => {
                  if (a.is_self === 1) return -1;
                  if (b.is_self === 1) return 1;
                  return (b.total_views || 0) - (a.total_views || 0);
                })
                .map((brand) => {
                  const isSelected = selectedBrands.includes(brand.id);
                  return (
                    <button
                      key={brand.id}
                      onClick={() => {
                        setSelectedBrands((prev) =>
                          prev.includes(brand.id)
                            ? prev.filter((id) => id !== brand.id)
                            : [...prev, brand.id]
                        );
                      }}
                      className={`
                        px-3 py-1.5 rounded-lg text-xs font-medium
                        transition-all duration-150 border
                        ${
                          isSelected
                            ? brand.is_self === 1
                              ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                              : "bg-gray-800 text-white border-gray-800 shadow-sm"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                        }
                      `}
                    >
                      {brand.name}
                      {brand.is_self === 1 && (
                        <span className="ml-1 opacity-70">自</span>
                      )}
                    </button>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm">
              未找到匹配的厂家
            </div>
          )}
        </div>
      </Card>

      {/* Add Brand Modal */}
      {showAddBrandModal && (
        <AddBrandModal
          isOpen={showAddBrandModal}
          onClose={() => setShowAddBrandModal(false)}
          onAdd={handleBrandAdded}
        />
      )}

      {/* Heatmaps */}
      <div className="space-y-6">
        <Card>
          <CardHeader
            action={
              <div className="flex items-center gap-2">
                {period === "month" && (
                  <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-lg">
                    <button
                      onClick={() => setSelectedYear(selectedYear - 1)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                      disabled={selectedYear <= 2020}
                      title="上一年"
                    >
                      ◀
                    </button>
                    <span className="text-sm font-medium text-gray-900 min-w-[3rem] text-center">
                      {selectedYear}
                    </span>
                    <button
                      onClick={() => setSelectedYear(selectedYear + 1)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                      disabled={selectedYear >= new Date().getFullYear()}
                      title="下一年"
                    >
                      ▶
                    </button>
                  </div>
                )}

                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setPeriod("week")}
                    className={`px-3 py-1 text-xs rounded-md transition-all ${
                      period === "week" ? "bg-white shadow-sm text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    按周
                  </button>
                  <button
                    onClick={() => setPeriod("month")}
                    className={`px-3 py-1 text-xs rounded-md transition-all ${
                      period === "month" ? "bg-white shadow-sm text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    按月
                  </button>
                </div>
              </div>
            }
          >
            <CardTitle>{period === "week" ? "每周" : `${selectedYear}年每月`}发布视频数对比</CardTitle>
          </CardHeader>
          <BrandHeatmap
            data={trendData}
            metric="video_count"
            title=""
            periodType={period}
          />
        </Card>

        <Card>
          <CardHeader
            action={
              <div className="flex items-center gap-2">
                {period === "month" && (
                  <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-lg">
                    <button
                      onClick={() => setSelectedYear(selectedYear - 1)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                      disabled={selectedYear <= 2020}
                      title="上一年"
                    >
                      ◀
                    </button>
                    <span className="text-sm font-medium text-gray-900 min-w-[3rem] text-center">
                      {selectedYear}
                    </span>
                    <button
                      onClick={() => setSelectedYear(selectedYear + 1)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                      disabled={selectedYear >= new Date().getFullYear()}
                      title="下一年"
                    >
                      ▶
                    </button>
                  </div>
                )}

                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setPeriod("week")}
                    className={`px-3 py-1 text-xs rounded-md transition-all ${
                      period === "week" ? "bg-white shadow-sm text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    按周
                  </button>
                  <button
                    onClick={() => setPeriod("month")}
                    className={`px-3 py-1 text-xs rounded-md transition-all ${
                      period === "month" ? "bg-white shadow-sm text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    按月
                  </button>
                </div>
              </div>
            }
          >
            <CardTitle>{period === "week" ? "每周" : `${selectedYear}年每月`}播放量对比</CardTitle>
          </CardHeader>
          <BrandHeatmap
            data={trendData}
            metric="total_views"
            title=""
            periodType={period}
          />
        </Card>
      </div>

      {/* Brand Detail Views */}
      <Card>
        <CardHeader
          action={
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewType("cards")}
                className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                  viewType === "cards" ? "bg-white shadow-sm text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                卡片
              </button>
              <button
                onClick={() => setViewType("scatter")}
                className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                  viewType === "scatter" ? "bg-white shadow-sm text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                散点图
              </button>
              <button
                onClick={() => setViewType("ranking")}
                className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                  viewType === "ranking" ? "bg-white shadow-sm text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                排名表
              </button>
            </div>
          }
        >
          <CardTitle>厂家清单</CardTitle>
        </CardHeader>

        {viewType === "cards" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
            {(brandSearch ? filteredBrands : brands)
              .sort(
                (a, b) =>
                  (b.is_self === 1 ? 1 : 0) -
                    (a.is_self === 1 ? 1 : 0) ||
                  (b.total_views || 0) - (a.total_views || 0)
              )
              .map((brand) => {
                const isSelected = selectedBrands.includes(brand.id);
                return (
                  <div
                    key={brand.id}
                    onClick={() => {
                      startTransition(() => {
                        router.push(`/brand/${brand.id}`);
                      });
                    }}
                    className={`border rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-px ${
                      isSelected
                        ? "border-gray-400 shadow-sm"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {brand.name}
                      </p>
                      {brand.is_self === 1 && (
                        <Badge variant="self" size="sm">自</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 tabular-nums">
                      <span>{formatNumber(brand.follower || 0)}粉</span>
                      <span>{brand.video_count || 0}视频</span>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-gray-900 tabular-nums">
                      {formatNumber(brand.total_views || 0)}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {viewType === "scatter" && (
          <BrandScatterPlot
            data={selectedBrandData}
            title="视频数 vs 播放量分布"
            onBrandClick={(id) => {
              startTransition(() => {
                router.push(`/brand/${id}`);
              });
            }}
          />
        )}

        {viewType === "ranking" && (
          <BrandRankingTable data={selectedBrandData} title="品牌排名总览" />
        )}
      </Card>
    </div>
  );
}
