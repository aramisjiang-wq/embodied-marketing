"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { BrandPeriodStat } from "@/lib/types";
import { getSmartPalette, getSelfBrandColors } from "@/lib/colorPalette";

interface ComparisonChartProps {
  data: BrandPeriodStat[];
  metric: "video_count" | "total_views";
  title?: string;
}

function formatNumber(num: number): string {
  if (num >= 100000000) return (num / 100000000).toFixed(1) + "亿";
  if (num >= 10000) return (num / 10000).toFixed(0) + "万";
  return num.toLocaleString();
}

export function ComparisonChart({ data, metric, title }: ComparisonChartProps) {
  const selfBrandName = data.find((d) => d.is_self === 1)?.brand_name;

  // All hooks must be called unconditionally
  const nonSelfBrandsCount = useMemo(() => {
    const brandSet = new Set<string>();
    for (const item of data) brandSet.add(item.brand_name);
    if (selfBrandName) brandSet.delete(selfBrandName);
    return brandSet.size;
  }, [data, selfBrandName]);

  const palette = useMemo(() => getSmartPalette(nonSelfBrandsCount), [nonSelfBrandsCount]);

  // Compute brands and color mapping (used for both empty and non-empty states)
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

  const brandColorMap = useMemo(() => {
    const map = new Map<string, string>();
    let nonSelfIndex = 0;
    brandList.forEach((brand) => {
      if (brand === selfBrandName) {
        map.set(brand, getSelfBrandColors().solid);
      } else {
        map.set(brand, palette[nonSelfIndex]?.solid || "#94A3B8");
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

  // Group by period and brand
  const periodMap = new Map<string, Record<string, number>>();

  for (const item of data) {
    if (!periodMap.has(item.period)) {
      periodMap.set(item.period, {} as Record<string, number>);
    }
    periodMap.get(item.period)![item.brand_name] = item[metric];
  }

  const sortedPeriods = Array.from(periodMap.keys()).sort();

  const chartData = sortedPeriods.map((period) => {
    const row: Record<string, string | number> = { period };
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
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} barGap={2} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
          <XAxis
            dataKey="period"
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (isViews ? formatNumber(v) : v)}
          />
          <Tooltip
            formatter={(value, name) => [
              typeof value === "number" && isViews ? formatNumber(value) : String(value ?? ""),
              String(name ?? ""),
            ]}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              fontSize: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
            labelFormatter={(labelItem) => (
              <span style={{ fontWeight: 600 }}>{String(labelItem ?? "")}</span>
            )}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }}
            iconType="square"
            iconSize={10}
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
          {brandList.map((brand) => (
            <Bar
              key={brand}
              dataKey={brand}
              fill={brandColorMap.get(brand) || "#94A3B8"}
              radius={[2, 2, 0, 0]}
              maxBarSize={40}
              opacity={brand === selfBrandName ? 1 : 0.75}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
        <span>💡</span>
        <span>每个品牌使用独立颜色，您的品牌以 ★ 标记并使用深蓝色</span>
      </div>
    </div>
  );
}
