"use client";

import { useState, useMemo, startTransition } from "react";
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
  showSortSelector?: boolean; // 是否显示排序选择器
}

type SortField = "video_count" | "total_views" | "follower" | "name";
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

  // 使用智能调色板生成颜色
  const palette = useMemo(() => getSmartPalette(data.length), [data.length]);

  // 创建品牌ID到颜色的映射
  const brandColorMap = useMemo(() => {
    const map = new Map<number, ColorPalette>();
    let nonSelfIndex = 0;
    
    // 先按播放量排序确定颜色分配顺序
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
      let aVal: number | string = a[sortField] || 0;
      let bVal: number | string = b[sortField] || 0;

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, searchTerm, sortField, sortOrder]);

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
  const selfRank =
    selfBrand &&
    [...data]
      .sort((a, b) => (b.total_views || 0) - (a.total_views || 0))
      .findIndex((b) => b.id === selfBrand.id) + 1;

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400">
        暂无数据
      </div>
    );
  }

  return (
    <div>
      {/* Header with title and sort selector */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {title && (
            <h3 className="text-xs text-gray-500 uppercase tracking-wide">
              {title}
            </h3>
          )}
          {/* Ranking basis indicator */}
          <div className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
            排序: {sortField === "total_views" ? "总播放量" : sortField === "video_count" ? "视频数" : sortField === "follower" ? "粉丝数" : "品牌名"} ({sortOrder === "desc" ? "降序" : "升序"})
          </div>
        </div>

        {/* Sort selector */}
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
              <option value="follower">粉丝数</option>
              <option value="name">品牌名称</option>
            </select>
          </div>
        )}
      </div>

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
                [...data]
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
    </div>
  );
}
