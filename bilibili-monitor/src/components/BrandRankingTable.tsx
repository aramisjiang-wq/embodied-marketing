"use client";

import { useState, useMemo, startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Search,
  ChevronUp,
  ChevronDown,
  Crown,
  Loader2,
} from "lucide-react";
import type { BrandWithStats } from "@/lib/types";
import { getSmartPalette, getSelfBrandColors, type ColorPalette } from "@/lib/colorPalette";

interface BrandData extends BrandWithStats {
  is_self?: number;
}

interface RankingTableProps {
  data: BrandData[];
  title?: string;
  showSortSelector?: boolean;
}

type SortField = "video_count" | "total_views";
type SortOrder = "asc" | "desc";

function formatNumber(num: number): string {
  if (num >= 100000000) return (num / 100000000).toFixed(1) + "亿";
  if (num >= 10000) return (num / 10000).toFixed(1) + "万";
  return num.toLocaleString();
}

export function BrandRankingTable({ data, title, showSortSelector = true }: RankingTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("total_views");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // 年份筛选状态
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("全部");
  const [yearData, setYearData] = useState<BrandData[] | null>(null);
  const [yearLoading, setYearLoading] = useState(false);

  // 初始化：拉取可用年份列表
  useEffect(() => {
    fetch("/api/ranking")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setAvailableYears(json.data.years || []);
      })
      .catch(() => {});
  }, []);

  // 年份切换：拉取对应年份数据
  useEffect(() => {
    if (selectedYear === "全部") {
      setYearData(null);
      return;
    }
    setYearLoading(true);
    fetch(`/api/ranking?year=${selectedYear}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setYearData(json.data.brands || []);
      })
      .catch(() => setYearData(null))
      .finally(() => setYearLoading(false));
    setCurrentPage(1);
  }, [selectedYear]);

  // 当前展示的数据源：选了年份用年份数据，否则用父级传入的全量数据
  const activeData: BrandData[] = yearData ?? data;

  // 使用智能调色板生成颜色
  const palette = useMemo(() => getSmartPalette(activeData.length), [activeData.length]);

  // 创建品牌ID到颜色的映射
  const brandColorMap = useMemo(() => {
    const map = new Map<number, ColorPalette>();
    let nonSelfIndex = 0;

    const sortedData = [...activeData].sort((a, b) => (b.total_views || 0) - (a.total_views || 0));

    sortedData.forEach((brand) => {
      if (brand.is_self === 1) {
        map.set(brand.id, getSelfBrandColors());
      } else {
        map.set(brand.id, palette[nonSelfIndex] || palette[0]);
        nonSelfIndex++;
      }
    });

    return map;
  }, [activeData, palette]);

  const filteredAndSorted = useMemo(() => {
    let filtered = activeData;

    if (searchTerm) {
      filtered = activeData.filter((brand) =>
        brand.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return [...filtered].sort((a, b) => {
      const aVal: number = (a[sortField] as number) || 0;
      const bVal: number = (b[sortField] as number) || 0;
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [activeData, searchTerm, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredAndSorted.length / pageSize);
  const paginatedData = filteredAndSorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const selfBrand = activeData.find((b) => b.is_self === 1);
  const selfRank =
    selfBrand &&
    [...activeData]
      .sort((a, b) => (b.total_views || 0) - (a.total_views || 0))
      .findIndex((b) => b.id === selfBrand.id) + 1;

  if (activeData.length === 0 && !yearLoading) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400">
        暂无数据
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          {title && (
            <h3 className="text-xs text-gray-500 uppercase tracking-wide">
              {title}
            </h3>
          )}
          <div className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
            排序: {sortField === "total_views" ? "总播放量" : "视频数"} ({sortOrder === "desc" ? "降序" : "升序"})
          </div>
          {/* 年份标签 */}
          {selectedYear !== "全部" && (
            <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded">
              {selectedYear} 年发布视频
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* 年份选择器 */}
          {availableYears.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">年份:</span>
              <div className="flex gap-1">
                {["全部", ...availableYears].map((y) => (
                  <button
                    key={y}
                    onClick={() => setSelectedYear(y)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                      selectedYear === y
                        ? "bg-blue-600 text-white font-medium"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 排序选择器（只保留播放量和视频数） */}
          {showSortSelector && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">排序依据:</span>
              <select
                value={sortField}
                onChange={(e) => {
                  setSortField(e.target.value as SortField);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="total_views">总播放量</option>
                <option value="video_count">视频数</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 年份数据加载中 */}
      {yearLoading && (
        <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">加载 {selectedYear} 年数据...</span>
        </div>
      )}

      {/* 主体内容：加载中时隐藏 */}
      {!yearLoading && (<>

      {/* 自己的品牌高亮卡片 */}
      {selfBrand && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                您的品牌：{selfBrand.name}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-blue-700">
              <span>排名：第 {selfRank || "-"} 名</span>
              <span>视频：{selfBrand.video_count || 0}</span>
              <span>播放：{formatNumber(selfBrand.total_views || 0)}</span>
            </div>
          </div>
        </div>
      )}

      {/* 搜索和筛选 */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索品牌名称..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="text-xs text-gray-500 whitespace-nowrap">
          共 {filteredAndSorted.length} 个品牌
        </div>
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1">
                  排名
                  {sortField === "name" &&
                    (sortOrder === "asc" ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    ))}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1">
                  品牌名称
                  {sortField === "name" &&
                    (sortOrder === "asc" ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    ))}
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort("video_count")}
              >
                <div className="flex items-center justify-end gap-1">
                  视频数
                  {sortField === "video_count" &&
                    (sortOrder === "asc" ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    ))}
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort("total_views")}
              >
                <div className="flex items-center justify-end gap-1">
                  总播放量
                  {sortField === "total_views" &&
                    (sortOrder === "asc" ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    ))}
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort("follower")}
              >
                <div className="flex items-center justify-end gap-1">
                  粉丝数
                  {sortField === "follower" &&
                    (sortOrder === "asc" ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    ))}
                </div>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((brand) => {
              const globalIndex =
                [...activeData]
                  .sort((a, b) => (b.total_views || 0) - (a.total_views || 0))
                  .findIndex((b) => b.id === brand.id) + 1;
              const isSelf = brand.is_self === 1;

              return (
                <tr
                  key={brand.id}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                    isSelf ? "bg-blue-50 hover:bg-blue-100" : ""
                  }`}
                  onClick={() => {
                    startTransition(() => router.push(`/brand/${brand.id}`));
                  }}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {globalIndex <= 3 && (
                        <span className="text-lg">{globalIndex === 1 ? "🥇" : globalIndex === 2 ? "🥈" : "🥉"}</span>
                      )}
                      {!isSelf && (
                        <span className="text-gray-600 font-medium">#{globalIndex}</span>
                      )}
                      {isSelf && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full font-medium">
                          我的
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {/* 颜色标识条 */}
                      <div
                        className="w-1.5 h-8 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: brandColorMap.get(brand.id)?.solid || "#94A3B8",
                          boxShadow: isSelf ? `0 0 6px ${brandColorMap.get(brand.id)?.border}` : "none"
                        }}
                      ></div>
                      <span
                        className={`font-medium ${
                          isSelf ? "text-blue-900" : "text-gray-900"
                        }`}
                      >
                        {brand.name}
                      </span>
                      {isSelf && (
                        <ArrowUpRight className="w-3 h-3 text-blue-600" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-gray-700">
                    {brand.video_count || 0}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="font-medium text-gray-900">
                      {formatNumber(brand.total_views || 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-gray-700">
                    {formatNumber(brand.follower || 0)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <button
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      onClick={(e) => {
                        e.stopPropagation();
                        startTransition(() => router.push(`/brand/${brand.id}`));
                      }}
                    >
                      详情 →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="text-gray-500">
            显示 {(currentPage - 1) * pageSize + 1} -{" "}
            {Math.min(currentPage * pageSize, filteredAndSorted.length)} /{" "}
            {filteredAndSorted.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <span className="text-gray-600">
              第 {currentPage} / {totalPages} 页
            </span>
            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      </>)}
    </div>
  );
}
