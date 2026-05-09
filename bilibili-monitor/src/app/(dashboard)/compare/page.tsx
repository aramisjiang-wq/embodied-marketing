"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Plus } from "lucide-react";
import { useFilter } from "@/components/layout/FilterContext";
import { Card, CardHeader, CardTitle, Button, Badge, SearchInput } from "@/components/ui";
import { MultiBrandLineChart } from "@/components/MultiBrandLineChart";
import type { BrandWithStats, BrandPeriodStat } from "@/lib/types";

interface CompareData {
  brands: BrandWithStats[];
  trends: BrandPeriodStat[];
  summary: Record<string, Record<string, number>>;
}

const MAX_COMPARE_BRANDS = 5;
const MIN_COMPARE_BRANDS = 2;

export default function ComparePage() {
  const { brands: filterBrands, period, setPeriod } = useFilter();
  const [compareBrands, setCompareBrands] = useState<number[]>([]);
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddList, setShowAddList] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const selectedBrandData = filterBrands.filter((b) => compareBrands.includes(b.id));
  const loadingRef = useRef(false);
  const isMaxReached = compareBrands.length >= MAX_COMPARE_BRANDS;
  const isMinReached = compareBrands.length >= MIN_COMPARE_BRANDS;

  // 当选择数量变化时，如果已经显示对比结果但数量不足，返回选择界面
  useEffect(() => {
    if (showComparison && compareBrands.length < MIN_COMPARE_BRANDS) {
      setShowComparison(false);
    }
  }, [compareBrands.length, showComparison]);

  const loadCompareData = useCallback(async () => {
    if (compareBrands.length < MIN_COMPARE_BRANDS) {
      setData(null);
      setLoading(false);
      return;
    }

    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const ids = compareBrands.join(",");

    try {
      const res = await fetch(`/api/compare?brandIds=${ids}&period=${period}`);
      const result = await res.json();
      if (result.success && result.data) {
        const trends: BrandPeriodStat[] = result.data;
        const brandMap = new Map<number, string>();

        trends.forEach((t) => {
          if (!brandMap.has(t.brand_id)) {
            brandMap.set(t.brand_id, t.brand_name || '');
          }
        });

        const summary: Record<string, Record<string, number>> = {};

        compareBrands.forEach((brandId) => {
          const brandName = filterBrands.find(b => b.id === brandId)?.name ||
                         brandMap.get(brandId) ||
                         `厂家${brandId}`;

          const brandTrends = trends.filter((t) => t.brand_id === brandId);

          if (brandTrends.length > 0) {
            summary[brandName] = {
              video_count: brandTrends.reduce((sum, t) => sum + (t.video_count || 0), 0),
              total_views: brandTrends.reduce((sum, t) => sum + (t.total_views || 0), 0),
              avg_views: Math.round(
                brandTrends.reduce((sum, t) => sum + (t.total_views || 0), 0) /
                Math.max(brandTrends.reduce((sum, t) => sum + (t.video_count || 0), 0), 1)
              ),
              total_likes: brandTrends.reduce((sum, t) => sum + (t.total_likes || 0), 0),
              avg_like_rate: Math.round(
                (brandTrends.reduce((sum, t) => sum + (t.total_likes || 0), 0) /
                Math.max(brandTrends.reduce((sum, t) => sum + (t.total_views || 0), 0), 1)) * 10000
              ) / 100,
              follower: filterBrands.find(b => b.id === brandId)?.follower || 0,
            };
          } else {
            const brand = filterBrands.find(b => b.id === brandId);
            summary[brandName] = {
              video_count: brand?.video_count || 0,
              total_views: brand?.total_views || 0,
              avg_views: 0,
              total_likes: 0,
              avg_like_rate: 0,
              follower: brand?.follower || 0,
            };
          }
        });

        const currentSelectedData = filterBrands.filter((b) => compareBrands.includes(b.id));
        const completeData: CompareData = {
          brands: currentSelectedData,
          trends: trends,
          summary: summary,
        };

        setData(completeData);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [compareBrands, period, filterBrands]);

  useEffect(() => {
    loadCompareData();
  }, [loadCompareData]);

  function formatNumber(num: number): string {
    if (num >= 100000000) return (num / 100000000).toFixed(1) + "亿";
    if (num >= 10000) return (num / 10000).toFixed(1) + "万";
    return num.toLocaleString();
  }

  const filteredBrands = search.trim()
    ? filterBrands.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    : filterBrands;

  const sortedBrands = [...filteredBrands].sort((a, b) => {
    if (a.is_self === 1) return -1;
    if (b.is_self === 1) return 1;
    return (b.total_views || 0) - (a.total_views || 0);
  });

  const toggleBrand = (id: number) => {
    if (compareBrands.includes(id)) {
      setCompareBrands((prev) => prev.filter((bid) => bid !== id));
    } else {
      if (compareBrands.length >= MAX_COMPARE_BRANDS) return;
      setCompareBrands((prev) => [...prev, id]);
    }
  };

  if (!filterBrands.length) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <p className="text-sm font-medium text-gray-900 mb-2">暂无厂家数据</p>
          <p className="text-xs text-gray-500 mb-4">请先在品牌管理中添加厂家</p>
          <Button onClick={() => window.location.href = "/brands"}>
            前往品牌管理
          </Button>
        </div>
      </div>
    );
  }

  if (!showComparison) {
    return (
      <div className="space-y-4 fade-in">
        <Card>
          <CardHeader
            action={
              compareBrands.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setCompareBrands([])}>
                  清空
                </Button>
              )
            }
          >
            <div className="flex items-center gap-2">
              <CardTitle>选择对比厂家</CardTitle>
              <Badge variant={compareBrands.length === 0 ? "default" : compareBrands.length >= MIN_COMPARE_BRANDS ? "success" : "warning"}>
                已选 {compareBrands.length}/{MAX_COMPARE_BRANDS}
              </Badge>
            </div>
          </CardHeader>

          {compareBrands.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4 pb-4 border-b border-gray-100">
              {selectedBrandData.map((brand) => (
                <span
                  key={brand.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-900 text-white rounded-lg text-xs font-medium"
                >
                  {brand.name}
                  {brand.is_self === 1 && (
                    <span className="px-1 py-px text-[8px] bg-yellow-400 text-gray-900 rounded font-bold">自</span>
                  )}
                  <button
                    onClick={() => toggleBrand(brand.id)}
                    className="hover:bg-gray-700 rounded-full p-0.5 transition-colors ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {compareBrands.length === 0 && (
            <div className="py-8 text-center mb-4">
              <p className="text-sm text-gray-500 mb-2">请选择 {MIN_COMPARE_BRANDS}-{MAX_COMPARE_BRANDS} 个厂家进行对比</p>
              <p className="text-xs text-gray-400">点击下方按钮添加厂家</p>
            </div>
          )}

          {compareBrands.length === 1 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-2">
              <span>ℹ️</span>
              再选择 {MIN_COMPARE_BRANDS - compareBrands.length} 个厂家即可开始对比（最多可选 {MAX_COMPARE_BRANDS} 个）
            </div>
          )}

          {compareBrands.length >= MIN_COMPARE_BRANDS && isMaxReached === false && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 flex items-center gap-2">
              <span>✅</span>
              还可再选 {MAX_COMPARE_BRANDS - compareBrands.length} 个厂家，或点击"开始对比"
            </div>
          )}

          <Button
            variant="secondary"
            className="w-full justify-center"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => !isMaxReached && setShowAddList(!showAddList)}
            disabled={isMaxReached}
          >
            {isMaxReached
              ? `已达上限 (${MAX_COMPARE_BRANDS}个)`
              : showAddList
                ? "收起"
                : `添加厂家 (${filterBrands.length - compareBrands.length} 个可选)`
            }
          </Button>

          {compareBrands.length >= MIN_COMPARE_BRANDS && (
            <Button
              className="w-full justify-center mt-3"
              onClick={() => setShowComparison(true)}
            >
              开始对比 ({compareBrands.length}个厂家)
            </Button>
          )}

          {showAddList && (
            <div className="mt-4 space-y-3">
              <SearchInput
                placeholder="搜索要添加的厂家..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
              />

              <div className="max-h-52 overflow-y-auto pr-1 custom-scrollbar space-y-0.5">
                {sortedBrands.map((brand) => {
                  const isSelected = compareBrands.includes(brand.id);
                  const isDisabled = isSelected || (isMaxReached && !isSelected);

                  return (
                    <button
                      key={brand.id}
                      onClick={() => !isDisabled && toggleBrand(brand.id)}
                      disabled={isDisabled}
                      className={`
                        w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium
                        transition-all duration-150 border flex items-center justify-between
                        ${
                          isSelected
                            ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                            : isMaxReached
                              ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                              : "bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                        }
                      `}
                    >
                      <span className="flex items-center gap-2">
                        {brand.name}
                        {brand.is_self === 1 && (
                          <Badge variant="warning" size="sm">自</Badge>
                        )}
                      </span>
                      {isSelected ? (
                        <span className="text-[10px] text-gray-400">已添加</span>
                      ) : isMaxReached ? (
                        <span className="text-[10px] text-gray-300">已达上限</span>
                      ) : (
                        <Plus className="w-3.5 h-3.5 text-gray-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400">
                  {compareBrands.length === 0
                    ? `已选择 0/${MAX_COMPARE_BRANDS}，还需选择 ${MIN_COMPARE_BRANDS} 个`
                    : compareBrands.length < MIN_COMPARE_BRANDS
                      ? `已选择 ${compareBrands.length}/${MAX_COMPARE_BRANDS}，还需选择 ${MIN_COMPARE_BRANDS - compareBrands.length} 个`
                      : isMaxReached
                        ? `已选满 ${MAX_COMPARE_BRANDS} 个，点击"开始对比"`
                        : `已选择 ${compareBrands.length}/${MAX_COMPARE_BRANDS}，还可再选 ${MAX_COMPARE_BRANDS - compareBrands.length} 个`
                  }
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in">
      {/* 已选厂家标签 */}
      <Card>
        <CardHeader
          action={
            <Button variant="ghost" size="sm" onClick={() => setShowComparison(false)}>
              重新选择
            </Button>
          }
        >
          <div className="flex items-center gap-2">
            <CardTitle>对比厂家</CardTitle>
            <Badge variant={compareBrands.length >= MAX_COMPARE_BRANDS ? "success" : "default"}>{compareBrands.length}/{MAX_COMPARE_BRANDS}</Badge>
          </div>
        </CardHeader>

        <div className="flex flex-wrap gap-1.5">
          {selectedBrandData.map((brand) => (
            <span
              key={brand.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-900 text-white rounded-lg text-xs font-medium"
            >
              {brand.name}
              {brand.is_self === 1 && (
                <span className="px-1 py-px text-[8px] bg-yellow-400 text-gray-900 rounded font-bold">自</span>
              )}
              <button
                onClick={() => toggleBrand(brand.id)}
                className="hover:bg-gray-700 rounded-full p-0.5 transition-colors ml-0.5"
                title="移除"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </Card>

      {/* 加载状态 */}
      {loading && (
        <div className="py-12 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500">
            <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
            加载对比数据...
          </div>
        </div>
      )}

      {/* 数据汇总 */}
      {!loading && data?.summary && (
        <Card padding="none">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <CardTitle>数据汇总</CardTitle>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">指标</th>
                  {Object.entries(data.summary).map(([key]) => (
                    <th key={key} className="px-4 py-3 text-right text-xs font-medium">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { label: "视频总数", key: "video_count" },
                  { label: "总播放量", key: "total_views" },
                  { label: "平均播放量", key: "avg_views" },
                  { label: "粉丝数", key: "follower" },
                ].map(({ label, key }) => (
                  <tr key={key} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap text-xs">{label}</td>
                    {Object.entries(data.summary).map(([brandName, stats]: [string, Record<string, number>]) => (
                      <td key={brandName} className="px-4 py-3 text-right tabular-nums text-xs">
                        {formatNumber(stats[key] || 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 flex items-center gap-1">
              <span>📅</span>
              <span>数据范围：最近12个月</span>
            </p>
          </div>
        </Card>
      )}

      {/* 趋势图表 - 使用 Recharts 组件 */}
      {!loading && data && data.trends && data.trends.length > 0 && (
        <div className="space-y-4">
          {/* 发布视频趋势 */}
          <Card>
            <CardHeader
              action={
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
              }
            >
              <CardTitle>{period === "week" ? "每周" : "每月"}发布视频数</CardTitle>
            </CardHeader>

            <MultiBrandLineChart data={data.trends} metric="video_count" />
          </Card>

          {/* 播放量趋势 */}
          <Card>
            <CardHeader
              action={
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
              }
            >
              <CardTitle>{period === "week" ? "每周" : "每月"}播放量</CardTitle>
            </CardHeader>

            <MultiBrandLineChart data={data.trends} metric="total_views" />
          </Card>
        </div>
      )}

      {!loading && (!data || !data.trends || data.trends.length === 0) && compareBrands.length >= MIN_COMPARE_BRANDS && (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-400">暂无对比数据</p>
          <p className="text-xs text-gray-300 mt-1">请检查数据是否已采集</p>
        </div>
      )}
    </div>
  );
}
