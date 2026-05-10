"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Play,
  ArrowLeft,
  ExternalLink,
  MoreHorizontal,
  Trash2,
  TrendingUp,
  BarChart3,
  Clock,
  Loader2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, Button, Badge } from "@/components/ui";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { BrandWithStats } from "@/lib/types";

interface BrandDetailPageProps {
  brand?: BrandWithStats;
}

function formatNumber(num: number): string {
  if (!num || num === 0) return "0";
  if (num >= 10000) return (num / 10000).toFixed(1) + "万";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num.toLocaleString();
}

export default function BrandDetailPage({ brand: initialBrand }: BrandDetailPageProps) {
  const router = useRouter();
  const params = useParams();
  const brandId = params.id as string;

  const [brand, setBrand] = useState<BrandWithStats | null>(initialBrand || null);
  const [loading, setLoading] = useState(!initialBrand);
  const [error, setError] = useState<string | null>(null);

  // UI状态
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // 数据获取
  useEffect(() => {
    if (initialBrand) {
      setBrand(initialBrand);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchBrandData() {
      if (!brandId) {
        setError("缺少品牌ID参数");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/brands/${brandId}?videos=true&stats=true`, {
          signal: controller.signal,
        });
        const data = await res.json();

        if (data.success && data.data) {
          // 构造完整的数据结构（API可能分片返回）
          const fullBrand: BrandWithStats = {
            ...data.data,
            videos: data.videos || [],
            monthly_stats: data.monthlyStats || [],
          };

          setBrand(fullBrand);
        } else {
          setError(data.error || "品牌数据不存在");
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error("Failed to fetch brand:", err);
          setError("网络请求失败，请稍后重试");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchBrandData();

    return () => {
      controller.abort();
    };
  }, [brandId, initialBrand]);

  // 数据准备（带空值保护）- 必须在所有 Hooks 在早期返回之前调用
  const videos = useMemo(() => brand?.videos || [], [brand?.videos]);
  const monthlyStats = useMemo(() => brand?.monthly_stats || [], [brand?.monthly_stats]);

  // 生成完整12个月时间轴（按月份升序，供趋势图使用）
  const chartData = useMemo(() => {
    return [...monthlyStats].sort((a, b) => a.month.localeCompare(b.month));
  }, [monthlyStats]);

  // 生成完整的月度数据列表（用于表格展示，最新月份在前）
  const tableMonthlyData = useMemo(() => {
    return [...chartData].sort((a, b) => b.month.localeCompare(a.month));
  }, [chartData]);

  // 最新月份标识（使用表格数据，确保包含当前月份）
  const latestMonth = tableMonthlyData.length > 0 ? tableMonthlyData[0].month : null;

  // 安全性检查：如果 brand 数据不存在且不是加载中，显示错误状态
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-500" />
          <p className="text-sm text-gray-500">正在加载品牌数据...</p>
        </div>
      </div>
    );
  }

  if (error || !brand) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 max-w-md mx-auto px-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">无法加载品牌数据</h2>
          <p className="text-sm text-gray-500">{error || "该品牌可能不存在或数据格式异常"}</p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="secondary" onClick={() => router.push("/")}>
              ← 返回首页
            </Button>
            <Button variant="ghost" onClick={() => window.location.reload()}>
              🔄 重试
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
    setShowMoreMenu(false);
  };

  const handleConfirmDelete = async () => {
    try {
      const res = await fetch(`/api/brands/${brand.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/");
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to delete brand:", error);
    } finally {
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="space-y-3 fade-in">
      {/* ========================================== */}
      {/* 面包屑导航 */}
      {/* ========================================== */}
      <nav className="flex items-center gap-2 text-xs text-gray-400">
        <Link href="/" className="hover:text-gray-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>首页</span>
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{brand.name}</span>
      </nav>

      {/* ========================================== */}
      {/* 品牌信息卡片（Header） */}
      {/* ========================================== */}
      <Card padding="sm" className="relative overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          {/* 左侧：品牌信息 */}
          <div className="flex items-center gap-2 flex-1">
            <div className="space-y-1 flex-1">
              {/* 品牌名称 + 标签 */}
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{brand.name}</h1>
                {brand.is_self === 1 && (
                  <Badge variant="self">自有品牌</Badge>
                )}
              </div>

              {/* MID 和 B站链接 */}
              <p className="text-xs text-gray-500">
                MID:{" "}
                <code className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">
                  {brand.mid}
                </code>
                <span className="mx-1.5">·</span>
                <a
                  href={`https://space.bilibili.com/${brand.mid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                >
                  查看 B 站主页
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>

              {/* 关键指标行 */}
              <div className="flex items-center gap-3 pt-0.5 text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <strong className="text-gray-900 font-semibold tabular-nums">{videos.length}</strong> 个视频
                </span>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  最后采集: {new Date().toLocaleDateString("zh-CN", { month: 'numeric', day: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* 右侧：操作区 */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 返回按钮 */}
            <Button variant="secondary" size="sm" onClick={() => router.back()}>
              ← 返回
            </Button>

            {/* 更多菜单（包含删除） */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="text-gray-400 hover:text-gray-600"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>

              {/* 下拉菜单 */}
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)}></div>
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                    <button
                      onClick={handleDeleteClick}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      删除此品牌
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ========================================== */}
      {/* 月度趋势图 + 数据明细 - 左右布局 */}
      {/* ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* 左侧：折线图 */}
        <Card padding="sm">
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                发布趋势
              </div>
            </CardTitle>
            <p className="text-[10px] text-gray-400">近12个月</p>
          </CardHeader>

          {chartData.length > 0 ? (
            <div className="mt-3" style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(value) => `${parseInt(value.slice(5))}月`}
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    width={25}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    formatter={(value) => [`${value} 个视频`, "发布数量"]}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="video_count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6", r: 4, strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "#2563eb", stroke: "#fff", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-xs">暂无数据</p>
            </div>
          )}
        </Card>

        {/* 右侧：数据表格（最近12个月，与图表对应） */}
        <Card padding="sm">
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                月度数据
              </div>
            </CardTitle>
          </CardHeader>

          <div className="mt-2">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-1.5 px-2 text-left font-semibold text-gray-600">月份</th>
                  <th className="py-1.5 px-2 text-right font-semibold text-gray-600">视频</th>
                  <th className="py-1.5 px-2 text-right font-semibold text-gray-600">播放</th>
                </tr>
              </thead>
              <tbody>
                {tableMonthlyData.slice(0, 12).map((stat) => (
                  <tr
                    key={stat.month}
                    className={`border-b border-gray-100 hover:bg-blue-50/50 ${
                      stat.month === latestMonth ? "bg-blue-50/30" : ""
                    }`}
                  >
                    <td className="py-1.5 px-2">
                      <span className="font-medium text-gray-900">{stat.month}</span>
                      {stat.month === latestMonth && (
                        <Badge className="ml-1" variant="self">新</Badge>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right font-semibold text-gray-900 tabular-nums">
                      {stat.video_count}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-700 tabular-nums">
                      {formatNumber(stat.total_views)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ========================================== */}
      {/* 视频列表 */}
      {/* ========================================== */}
      <Card padding="md">
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              视频列表 ({videos.length})
            </div>
          </CardTitle>
        </CardHeader>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-2 px-3 text-left text-[11px] font-semibold text-gray-600">
                  视频标题
                </th>
                <th className="py-2 px-3 text-right text-[11px] font-semibold text-gray-600">
                  播放
                </th>
                <th className="py-2 px-3 text-right text-[11px] font-semibold text-gray-600">
                  点赞
                </th>
                <th className="py-2 px-3 text-right text-[11px] font-semibold text-gray-600">
                  收藏
                </th>
                <th className="py-2 px-3 text-right text-[11px] font-semibold text-gray-600">
                  评论
                </th>
                <th className="py-2 px-3 text-right text-[11px] font-semibold text-gray-600">
                  发布时间
                </th>
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr
                  key={video.bvid}
                  className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors"
                >
                  <td className="py-2 px-3">
                    <a
                      href={`https://www.bilibili.com/video/${video.bvid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline line-clamp-1"
                    >
                      {video.title}
                    </a>
                  </td>
                  <td className="py-2 px-3 text-right font-medium text-gray-900 tabular-nums">
                    {formatNumber(video.view)}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-600 tabular-nums">
                    {formatNumber(video.like)}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-600 tabular-nums">
                    {formatNumber(video.favorite)}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-600 tabular-nums">
                    {formatNumber(video.reply)}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-500 text-[10px] whitespace-nowrap">
                    {video.pub_date || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {videos.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Play className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>该品牌暂无视频数据</p>
            </div>
          )}
        </div>
      </Card>

      {/* ========================================== */}
      {/* 删除确认弹窗 */}
      {/* ========================================== */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 fade-in">
            <h3 className="text-lg font-bold text-gray-900 mb-2">确认删除</h3>
            <p className="text-sm text-gray-600 mb-6">
              确定要删除品牌 <strong>{brand.name}</strong> 吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(false)}>
                取消
              </Button>
              <Button variant="danger" size="sm" onClick={handleConfirmDelete}>
                确认删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
