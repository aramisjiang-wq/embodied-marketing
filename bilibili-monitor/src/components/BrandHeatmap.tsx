"use client";

import { useMemo } from "react";
import type { BrandPeriodStat } from "@/lib/types";
import { getSmartPalette, getSelfBrandColors, type ColorPalette } from "@/lib/colorPalette";

interface HeatmapProps {
  data: BrandPeriodStat[];
  metric: "video_count" | "total_views";
  title?: string;
  periodType?: "week" | "month";
}

function formatNumber(num: number): string {
  if (num >= 100000000) return (num / 100000000).toFixed(1) + "亿";
  if (num >= 10000) return (num / 10000).toFixed(0) + "万";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

/**
 * 将周格式转换为可读的日期范围
 * 支持多种格式：
 * - "2025-W51" → "12/15-21"
 * - "05/11-05/17" → "05/11-05/17" (已经是可读格式，直接返回)
 */
function formatWeekPeriod(period: string): string {
  // 如果已经是 MM/DD-MM/DD 格式，直接返回
  if (/^\d{2}\/\d{2}-\d{2}\/\d{2}$/.test(period)) {
    return period;
  }

  // 处理 ISO 周格式 "2025-W51"
  const match = period.match(/(\d{4})-W(\d{1,2})/);
  if (!match) return period;

  const year = parseInt(match[1]);
  const weekNum = parseInt(match[2]);

  const janFirst = new Date(year, 0, 1);
  const firstDay = janFirst.getDay();

  const daysToPrevMonday = (6 - firstDay + 7) % 7 || 7;
  const firstMonday = new Date(janFirst);
  firstMonday.setDate(janFirst.getDate() + daysToPrevMonday);

  const monday = new Date(firstMonday);
  monday.setDate(firstMonday.getDate() + (weekNum - 1) * 7);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatShortDate = (date: Date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day.toString().padStart(2, "0")}`;
  };

  return `${formatShortDate(monday)}-${formatShortDate(sunday)}`;
}

/**
 * 智能格式化周期显示
 * 月格式保持不变，周格式转换为日期范围
 */
function formatPeriodDisplay(period: string | null | undefined, periodType: "week" | "month"): string {
  if (!period || typeof period !== "string") return "-";
  if (periodType === "week") {
    // 检测所有周格式：ISO周格式 或 日期范围格式
    if (period.includes("-W") || /^\d{2}\/\d{2}-\d{2}\/\d{2}$/.test(period)) {
      return formatWeekPeriod(period);
    }
  }
  return period;
}

function getHeatmapColor(value: number, min: number, max: number): string {
  if (max === min) return "#f3f4f6"; // gray-100
  
  const normalized = (value - min) / (max - min);
  
  // 从浅色到深色的渐变（蓝-青-绿-黄-橙-红）
  const colors = [
    "#f0f9ff", // 极浅蓝
    "#e0f2fe", // 浅蓝
    "#bae6fd", // 中浅蓝
    "#7dd3fc", // 中蓝
    "#38bdf8", // 深蓝
    "#22d3ee", // 青色
    "#14b8a6", // 蓝绿色
    "#10b981", // 绿色
    "#84cc16", // 黄绿色
    "#fbbf24", // 黄色
    "#f59e0b", // 橙色
    "#ef4444", // 红色
  ];
  
  const index = Math.floor(normalized * (colors.length - 1));
  return colors[Math.min(index, colors.length - 1)];
}

function getTextColor(value: number, min: number, max: number): string {
  if (max === min) return "#374151"; // gray-700
  
  const normalized = (value - min) / (max - min);
  
  // 高值用白色文字，低值用深色文字
  return normalized > 0.7 ? "#ffffff" : "#374151";
}

export function BrandHeatmap({ data, metric, title, periodType = "month" }: HeatmapProps) {
  const brandSet = new Set<string>();
  const periodSet = new Set<string>();
  const selfBrandName = data.find((d) => d.is_self === 1)?.brand_name;

  const dataMap = new Map<string, Map<string, number>>();
  let minValue = Infinity;
  let maxValue = -Infinity;

  for (const item of data) {
    if (!item.period || typeof item.period !== "string") continue;

    brandSet.add(item.brand_name);
    periodSet.add(item.period);

    if (!dataMap.has(item.brand_name)) {
      dataMap.set(item.brand_name, new Map());
    }

    const value = item[metric];
    dataMap.get(item.brand_name)!.set(item.period, value);

    minValue = Math.min(minValue, value);
    maxValue = Math.max(maxValue, value);
  }

  if (minValue === Infinity) minValue = 0;
  if (maxValue === -Infinity) maxValue = 0;

  const brands = Array.from(brandSet).sort((a, b) => {
    if (a === selfBrandName) return -1;
    if (b === selfBrandName) return 1;
    return a.localeCompare(b);
  });

  const periods = Array.from(periodSet).sort();

  const brandsWithData = brands.filter(brand => {
    const brandData = dataMap.get(brand);
    return brandData && brandData.size > 0;
  });
  const brandsWithoutData = brands.length - brandsWithData.length;

  const palette = useMemo(() => getSmartPalette(brands.length), [brands.length]);
  const brandColorMap = useMemo(() => {
    const map = new Map<string, ColorPalette>();
    brands.forEach((brand, index) => {
      map.set(brand, brand === selfBrandName ? getSelfBrandColors() : palette[index]);
    });
    return map;
  }, [brands, palette, selfBrandName]);

  if (data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        暂无数据
      </div>
    );
  }

  return (
    <div>
      {title && (
        <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-4">
          {title}
        </h3>
      )}

      {/* Data Status Indicator */}
      <div className="mb-3 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">数据覆盖:</span>
          <span className="font-medium text-green-600">{brandsWithData.length}/{brands.length} 个品牌</span>
        </div>
        {brandsWithoutData > 0 && (
          <div className="flex items-center gap-1 text-orange-500">
            <span>⚠️</span>
            <span>{brandsWithoutData}个品牌暂无数据（需运行数据采集）</span>
          </div>
        )}
      </div>

      {/* Heatmap Container */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b border-gray-200 sticky left-0 bg-white z-10 min-w-[120px]">
                品牌
              </th>
              {periods.map((period) => (
                <th
                  key={period}
                  className="px-2 py-2 text-center text-xs font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap"
                >
                  {formatPeriodDisplay(period, periodType)}
                  {periodType === "week" && period.includes("-W") && (
                    <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                      {period}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {brands.map((brand) => (
              <tr key={brand} className="group hover:bg-gray-50 transition-colors">
                {/* Brand Name with color indicator */}
                <td 
                  className={`px-3 py-2 text-sm font-medium border-b border-gray-100 sticky left-0 bg-white z-10 ${
                    brand === selfBrandName ? "text-blue-900" : "text-gray-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: brandColorMap.get(brand)?.solid }}
                    ></div>
                    <span className="truncate">
                      {brand}
                      {brand === selfBrandName && (
                        <span className="ml-1 text-xs text-blue-600">★</span>
                      )}
                    </span>
                  </div>
                </td>

                {/* Data Cells */}
                {periods.map((period) => {
                  const hasData = dataMap.has(brand);
                  const value = hasData ? (dataMap.get(brand)?.get(period) || 0) : 0;
                  const isNoDataBrand = !hasData || dataMap.get(brand)?.size === 0;

                  // For brands without any data, show gray background
                  let bgColor: string;

                  if (isNoDataBrand) {
                    bgColor = "#f9fafb"; // gray-50
                  } else {
                    bgColor = getHeatmapColor(value, minValue, maxValue);
                  }

                  return (
                    <td
                      key={period}
                      className={`px-2 py-2 text-center text-xs border-b border-gray-100 relative group/cell ${
                        isNoDataBrand ? "" : "cursor-pointer"
                      }`}
                      style={{
                        backgroundColor: bgColor,
                        minWidth: "60px",
                      }}
                    >
                      <div className={isNoDataBrand ? "text-gray-300" : getTextColor(value, minValue, maxValue)}>
                        {isNoDataBrand ? "-" : (metric === "total_views" ? formatNumber(value) : value)}
                      </div>

                      {/* Tooltip on hover - only show for brands with data */}
                      {!isNoDataBrand && (
                        <>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover/cell:opacity-100 group-hover/cell:visible transition-all z-20 whitespace-nowrap pointer-events-none shadow-lg">
                            <div className="font-semibold">{brand}</div>
                            <div>{formatPeriodDisplay(period, periodType)} ({period})</div>
                            <div className="mt-1">
                              {metric === "video_count" ? "视频数" : "播放量"}:{" "}
                              <strong>{formatNumber(value)}</strong>
                            </div>
                            {/* Arrow */}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>低</span>
          <div className="flex gap-0.5">
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((ratio) => {
              const value = minValue + ratio * (maxValue - minValue);
              return (
                <div
                  key={ratio}
                  className="w-8 h-4 rounded-sm"
                  style={{
                    backgroundColor: getHeatmapColor(value, minValue, maxValue),
                  }}
                ></div>
              );
            })}
          </div>
          <span>高</span>
        </div>

        <div className="text-xs text-gray-400">
          范围: {formatNumber(minValue)} - {formatNumber(maxValue)}
        </div>
      </div>

      {/* Info */}
      <div className="mt-2 text-xs text-gray-400">
        💡 鼠标悬停查看详细数值 | 颜色越深表示数值越高
      </div>
    </div>
  );
}
