"use client";

import { useState, useMemo, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Search,
  ChevronUp,
  ChevronDown,
  Crown,
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
  /** 统计口径：自然年（pub_date 落在该年内的视频） */
  calendarYear: number;
  onCalendarYearChange: (year: number) => void;
  /** 可选年份下限，默认 2018 */
  minCalendarYear?: number;
}

type SortField = "video_count" | "total_views";
type SortOrder = "asc" | "desc";

function formatNumber(num: number): string {
  if (num >= 100000000) return (num / 100000000).toFixed(1) + "亿";
  if (num >= 10000) return (num / 10000).toFixed(1) + "万";
  return num.toLocaleString();
}

export function BrandRankingTable({
  data,
  title,
  showSortSelector = true,
  calendarYear,
  onCalendarYearChange,
  minCalendarYear = 2018,
}: RankingTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("total_views");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const maxCalendarYear = new Date().getFullYear();

  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = maxCalendarYear; y >= minCalendarYear; y -= 1) {
      list.push(y);
    }
    return list;
  }, [maxCalendarYear, minCalendarYear]);

  useEffect(() => {
    setCurrentPage(1);
  }, [data, calendarYear, sortField, sortOrder, searchTerm]);

  // 播放量顺序分配颜色条（与产品“排名以播放量/视频数为准”一致，颜色按年度总播放序）
  const palette = useMemo(() => getSmartPalette(data.length), [data.length]);

  const brandColorMap = useMemo(() => {
    const map = new Map<number, ColorPalette>();
    let nonSelfIndex = 0;
    const sortedData = [...data].sort((a, b) => (b.total_views || 0) - (a.total_views || 0));
    sortedData.forEach((brand) => {
      if (brand.is_self === 1) {
        map.set(brand.id, getSelfBrandColors());
      } else {
        map.set(brand.id, palette[nonSelfIndex] || palette[0]);
        nonSelfIndex++;
      }
    });
    return map;
  }, [data, palette]);

  const filteredAndSorted = useMemo(() => {
    let filtered = data;
    if (searchTerm) {
      filtered = data.filter((brand) =>
        brand.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return [...filtered].sort((a, b) => {
      const aVal = (a[sortField] || 0) as number;
      const bVal = (b[sortField] || 0) as number;
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return (a.name || "").localeCompare(b.name || "", "zh-CN");
    });
  }, [data, searchTerm, sortField, sortOrder]);

  const rankByBrandId = useMemo(() => {
    const map = new Map<number, number>();
    filteredAndSorted.forEach((b, i) => map.set(b.id, i + 1));
    return map;
  }, [filteredAndSorted]);

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

  const selfBrand = data.find((b) => b.is_self === 1);
  const selfRank = selfBrand ? rankByBrandId.get(selfBrand.id) ?? null : null;

  const sortLabel =
    sortField === "total_views" ? "年度总播放量" : "年度发布视频数";

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400">
        暂无数据
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {title && (
            <h3 className="text-xs text-gray-500 uppercase tracking-wide">
              {title}
            </h3>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs text-gray-500">自然年</span>
            <select
              value={calendarYear}
              onChange={(e) => {
                const y = Number.parseInt(e.target.value, 10);
                if (!Number.isFinite(y)) return;
                onCalendarYearChange(y);
              }}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y} 年
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded max-w-xl leading-snug">
            口径：{calendarYear} 年内按发布日期统计的视频条数与播放量（累计至最近采集）；粉丝数仅展示，不参与排名
          </div>
        </div>

        {showSortSelector && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">排序依据（排名）</span>
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
            <span className="text-xs text-gray-400">
              {sortLabel}（{sortOrder === "desc" ? "降序" : "升序"}）
            </span>
          </div>
        )}
      </div>

      {selfBrand && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                您的品牌：{selfBrand.name}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-blue-700">
              <span>按当前排序：第 {selfRank ?? "-"} 名</span>
              <span>视频：{selfBrand.video_count || 0}</span>
              <span>播放：{formatNumber(selfBrand.total_views || 0)}</span>
            </div>
          </div>
        </div>
      )}

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

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                排名
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                品牌名称
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
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                粉丝数
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((brand) => {
              const rank = rankByBrandId.get(brand.id) ?? 0;
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
                      {rank > 0 && rank <= 3 && (
                        <span className="text-lg">
                          {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
                        </span>
                      )}
                      {!isSelf && (
                        <span className="text-gray-600 font-medium">#{rank}</span>
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
                      <div
                        className="w-1.5 h-8 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            brandColorMap.get(brand.id)?.solid || "#94A3B8",
                          boxShadow: isSelf
                            ? `0 0 6px ${brandColorMap.get(brand.id)?.border}`
                            : "none",
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
    </div>
  );
}
