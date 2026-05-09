"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { BrandPeriodStat } from "@/lib/types";
import { getSmartPalette, getSelfBrandColors, type ColorPalette } from "@/lib/colorPalette";

interface MultiBrandLineChartProps {
  data: BrandPeriodStat[];
  metric: "video_count" | "total_views";
  title?: string;
}

function formatValue(num: number, isViews: boolean): string {
  if (isViews) {
    if (num >= 100000000) return (num / 100000000).toFixed(1) + "亿";
    if (num >= 10000) return (num / 10000).toFixed(1) + "万";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  }
  return num.toLocaleString();
}

function formatPeriodLabel(period: string): string {
  if (/^\d{2}\/\d{2}-\d{2}\/\d{2}$/.test(period)) return period;
  if (period.length === 7 && period.includes("-")) return period.slice(5);
  return period;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value?: number;
    name?: string;
    color?: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string | number;
  isViews: boolean;
}

function CustomTooltip({ active, payload, label, isViews }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[160px]">
        <p className="font-medium text-gray-900 mb-2 pb-2 border-b border-gray-100">
          {String(label ?? "")}
        </p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-3 mb-1.5 last:mb-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-600">{entry.name}:</span>
            </div>
            <span className="font-semibold text-gray-900">
              {formatValue(Number(entry.value ?? 0), isViews)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function MultiBrandLineChart({ data, metric, title }: MultiBrandLineChartProps) {
  const selfBrandName = useMemo(() => data.find((d) => d.is_self === 1)?.brand_name, [data]);

  const brandList = useMemo(() => {
    const brandSet = new Set<string>();
    for (const item of data) brandSet.add(item.brand_name);
    const list = Array.from(brandSet);
    list.sort((a, b) => {
      if (a === selfBrandName) return -1;
      if (b === selfBrandName) return 1;
      return a.localeCompare(b);
    });
    return list;
  }, [data, selfBrandName]);

  const nonSelfBrandsCount = useMemo(() => {
    if (!selfBrandName) return brandList.length;
    return brandList.filter((b) => b !== selfBrandName).length;
  }, [brandList, selfBrandName]);

  const palette = useMemo(() => getSmartPalette(nonSelfBrandsCount), [nonSelfBrandsCount]);

  const brandColorMap = useMemo(() => {
    const map = new Map<string, ColorPalette>();
    let nonSelfIndex = 0;
    brandList.forEach((brand) => {
      if (brand === selfBrandName) {
        map.set(brand, getSelfBrandColors());
      } else {
        map.set(brand, palette[nonSelfIndex] || { solid: "#94A3B8", border: "#D1D5DB" });
        nonSelfIndex++;
      }
    });
    return map;
  }, [brandList, palette, selfBrandName]);

  if (data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        暂无数据
      </div>
    );
  }

  const periodMap = new Map<string, Record<string, number>>();
  for (const item of data) {
    if (!periodMap.has(item.period)) {
      periodMap.set(item.period, {});
    }
    periodMap.get(item.period)![item.brand_name] = item[metric];
  }

  const sortedPeriods = Array.from(periodMap.keys()).sort();

  const chartData = sortedPeriods.map((period) => {
    const row: Record<string, string | number> = {
      period: formatPeriodLabel(period),
      fullPeriod: period,
    };
    for (const brand of brandList) {
      row[brand] = periodMap.get(period)?.[brand] || 0;
    }
    return row;
  });

  const isViews = metric === "total_views";

  return (
    <div>
      {title && (
        <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-4">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={320} minWidth={300}>
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="period"
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            interval={Math.floor(sortedPeriods.length / 12)}
          />
          <YAxis
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatValue(Number(v), isViews)}
            width={65}
          />
          <Tooltip content={<CustomTooltip isViews={isViews} />} />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => {
              const isSelf = value === selfBrandName;
              return (
                <span style={{
                  fontWeight: isSelf ? 700 : 400,
                  color: isSelf ? "#1E40AF" : "#374151",
                }}>
                  {isSelf ? `★ ${value}` : value}
                </span>
              );
            }}
          />
          {brandList.map((brand) => {
            const colors = brandColorMap.get(brand);
            return (
              <Line
                key={brand}
                type="monotone"
                dataKey={brand}
                name={brand}
                stroke={colors?.solid || "#94A3B8"}
                strokeWidth={2.5}
                dot={{
                  fill: colors?.solid || "#94A3B8",
                  r: 4,
                  strokeWidth: 0,
                }}
                activeDot={{
                  r: 6,
                  stroke: colors?.solid || "#94A3B8",
                  strokeWidth: 2,
                }}
                strokeDasharray={brand === selfBrandName ? undefined : "4 2"}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
        <span>💡</span>
        <span>您的品牌以 ★ 标记，使用实线；其他品牌使用虚线</span>
      </div>
    </div>
  );
}
