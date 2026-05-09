"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Cell,
} from "recharts";
import type { BrandWithStats } from "@/lib/types";
import { getSmartPalette, getSelfBrandColors } from "@/lib/colorPalette";

interface BrandData extends BrandWithStats {
  is_self?: number;
}

interface ScatterPlotProps {
  data: BrandData[];
  title?: string;
  onBrandClick?: (brandId: number) => void;
}

function formatAxisValue(value: number): string {
  if (value >= 10000) return (value / 10000).toFixed(0) + "万";
  if (value >= 1000) return (value / 1000).toFixed(0) + "K";
  return value.toString();
}

export function BrandScatterPlot({ data, title, onBrandClick }: ScatterPlotProps) {
  const palette = useMemo(() => getSmartPalette(data.length), [data.length]);

  const brandColorMap = useMemo(() => {
    const map = new Map<number, { solid: string; border: string }>();
    data.forEach((brand, index) => {
      if (brand.is_self === 1) {
        map.set(brand.id, getSelfBrandColors());
      } else {
        let nonSelfIndex = 0;
        for (let i = 0; i < data.length; i++) {
          if (data[i].id === brand.id && data[i].is_self !== 1) break;
          if (data[i].is_self !== 1) nonSelfIndex++;
        }
        map.set(brand.id, palette[nonSelfIndex] || palette[index]);
      }
    });
    return map;
  }, [data, palette]);

  if (data.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center text-gray-400">
        暂无数据
      </div>
    );
  }

  const chartData = data.map((brand) => ({
    x: brand.video_count || 0,
    y: brand.total_views || 0,
    z: brand.follower || 1,
    name: brand.name,
    id: brand.id,
    isSelf: brand.is_self === 1,
    color: brandColorMap.get(brand.id),
  }));

  const selfBrand = data.find((b) => b.is_self === 1);

  return (
    <div>
      {title && (
        <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-4">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={420} minWidth={300}>
        <ScatterChart
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <XAxis
            type="number"
            dataKey="x"
            name="视频数"
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            tickFormatter={formatAxisValue}
            label={{
              value: "视频发布数量",
              position: "bottom",
              offset: 0,
              style: { fontSize: "12px", fill: "#6b7280" },
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="播放量"
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatAxisValue}
            label={{
              value: "总播放量",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              style: { fontSize: "12px", fill: "#6b7280" },
            }}
          />
          <ZAxis type="number" dataKey="z" range={[60, 400]} name="粉丝数" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              fontSize: "12px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
            formatter={(value, name) => {
              if (name === "粉丝数") return [formatAxisValue(Number(value ?? 0)), name];
              return [String(value ?? ""), name];
            }}
            labelFormatter={(labelItem) => {
              const itemName = String(labelItem ?? "");
              const item = chartData.find((d) => d.name === itemName);
              return item?.isSelf ? `★ ${itemName} (您的品牌)` : itemName;
            }}
          />
          <Scatter data={chartData} onClick={(scatterData) => {
            const data = scatterData as { id?: number };
            if (onBrandClick && data?.id) onBrandClick(data.id);
          }}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color?.solid || "#94A3B8"}
                fillOpacity={entry.isSelf ? 1 : 0.65}
                stroke={entry.color?.border || "#d1d5db"}
                strokeWidth={entry.isSelf ? 2.5 : 1.5}
                style={{
                  cursor: "pointer",
                  filter: entry.isSelf ? "drop-shadow(0 0 4px rgba(30, 64, 175, 0.4))" : "none",
                }}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* 图例 */}
      <div className="mt-4 space-y-3">
        {selfBrand && (
          <div className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <div
              className="w-4 h-4 rounded-full shadow-sm"
              style={{
                backgroundColor: getSelfBrandColors().solid,
                boxShadow: `0 0 6px ${getSelfBrandColors().border}`,
              }}
            ></div>
            <span className="text-sm font-medium text-blue-900">★ {selfBrand.name} (您的品牌)</span>
          </div>
        )}
        <div className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 pt-1 whitespace-nowrap">其他品牌：</div>
          <div className="flex flex-wrap gap-3">
            {data
              .filter((b) => b.is_self !== 1)
              .slice(0, Math.min(10, data.length - 1))
              .map((brand) => {
                const color = brandColorMap.get(brand.id);
                return (
                  <div key={brand.id} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color?.solid || "#94A3B8" }}></div>
                    <span className="text-xs text-gray-600">{brand.name}</span>
                  </div>
                );
              })}
            {data.filter((b) => b.is_self !== 1).length > 10 && (
              <span className="text-xs text-gray-400 pt-1">
                +{data.filter((b) => b.is_self !== 1).length - 10} 个
              </span>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500 pl-2">
          💡 气泡大小 = 粉丝数 | 点击气泡查看详情
        </div>
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
        <p className="font-medium mb-1">📊 图表解读：</p>
        <ul className="list-disc list-inside space-y-1 text-gray-500">
          <li><strong>右上角</strong>：高播放量 + 高视频数（高产高质 🏆）</li>
          <li><strong>左上角</strong>：低视频数 + 高播放量（精品策略 💎）</li>
          <li><strong>右下角</strong>：高视频数 + 低播放量（需优化 ⚠️）</li>
          <li><strong>蓝色高亮</strong>：您的品牌，带发光效果</li>
        </ul>
      </div>
    </div>
  );
}
