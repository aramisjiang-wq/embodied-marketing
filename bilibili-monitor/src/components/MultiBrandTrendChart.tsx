"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface MultiBrandData {
  month: string;
  [brandName: string]: string | number;
}

interface MultiBrandTrendChartProps {
  data: MultiBrandData[];
  brands: string[];
  metric: "total_views" | "video_count";
  type?: "bar" | "line";
}

const BRAND_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
];

function formatView(num: number): string {
  if (num >= 100000000) return (num / 100000000).toFixed(1) + "亿";
  if (num >= 10000) return (num / 10000).toFixed(1) + "万";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

function formatMonth(monthStr: string): string {
  if (!monthStr) return "";
  const parts = monthStr.split("-");
  if (parts.length === 2) return `${parts[0].slice(2)}/${parts[1]}`;
  return monthStr.slice(5);
}

// Component must be declared outside render
function CustomTooltip({
  active, payload, label, metric,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string; payload?: Record<string, unknown> }>;
  label?: string;
  metric: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[160px]">
        <p className="font-medium text-gray-900 mb-2 pb-2 border-b border-gray-100">
          {(payload[0]?.payload?.fullMonth as string | undefined) || String(label ?? "")}
        </p>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3 mb-1.5 last:mb-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-600">{entry.name}:</span>
            </div>
            <span className="font-semibold text-gray-900">
              {metric === "total_views" ? formatView(entry.value ?? 0) : `${entry.value ?? 0} 个`}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function MultiBrandTrendChart({
  data,
  brands,
  metric,
  type = "bar",
}: MultiBrandTrendChartProps) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-sm">暂无数据</p>
          <p className="text-xs mt-1 text-gray-300">完成数据采集后将在此显示趋势</p>
        </div>
      </div>
    );
  }

  if (!brands || !Array.isArray(brands) || brands.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-sm">请选择品牌</p>
        </div>
      </div>
    );
  }

  const sortedData = [...data]
    .filter((item) => item && item.month)
    .sort((a, b) => (a.month || "").localeCompare(b.month || ""));

  if (sortedData.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-sm">暂无有效数据</p>
        </div>
      </div>
    );
  }

  const chartData = sortedData.map((item) => ({
    month: formatMonth(item.month),
    fullMonth: item.month,
    ...brands.reduce(
      (acc, brand) => ({ ...acc, [brand]: item[brand] || 0 }),
      {},
    ),
  }));

  return (
    <ResponsiveContainer width="100%" height={320} minWidth={300}>
      {type === "line" ? (
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            interval={Math.floor(chartData.length / 12)}
          />
          <YAxis
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (metric === "total_views" ? formatView(v) : v)}
          />
          <Tooltip content={<CustomTooltip metric={metric} />} />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} iconType="circle" iconSize={8} />
          {brands.map((brand, index) => (
            <Line
              key={brand}
              type="monotone"
              dataKey={brand}
              name={brand}
              stroke={BRAND_COLORS[index % BRAND_COLORS.length]}
              strokeWidth={2.5}
              dot={{ fill: BRAND_COLORS[index % BRAND_COLORS.length], r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, stroke: BRAND_COLORS[index % BRAND_COLORS.length], strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      ) : (
        <BarChart data={chartData} barGap={4} barCategoryGap="12%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={50}
          />
          <YAxis
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (metric === "total_views" ? formatView(v) : v)}
          />
          <Tooltip content={<CustomTooltip metric={metric} />} cursor={{ fill: "#9fafb", opacity: 0.5 }} />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} iconType="square" iconSize={8} />
          {brands.map((brand, index) => (
            <Bar key={brand} dataKey={brand} name={brand} radius={[4, 4, 0, 0]} maxBarSize={40}>
              {chartData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={BRAND_COLORS[index % BRAND_COLORS.length]} opacity={0.75 + (idx / chartData.length) * 0.25} />
              ))}
            </Bar>
          ))}
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
