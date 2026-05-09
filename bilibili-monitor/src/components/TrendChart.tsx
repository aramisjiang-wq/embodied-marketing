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

interface MonthlyStat {
  month: string;
  video_count: number;
  total_views: number;
  total_likes?: number;
  total_favorites?: number;
}

interface TrendChartProps {
  data: MonthlyStat[];
  type?: "bar" | "line";
  showVideos?: boolean;
  showViews?: boolean;
}

function formatView(num: number): string {
  if (num >= 100000000) return (num / 100000000).toFixed(1) + "亿";
  if (num >= 10000) return (num / 10000).toFixed(1) + "万";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

function formatMonth(monthStr: string): string {
  if (!monthStr) return "";
  const parts = monthStr.split("-");
  if (parts.length === 2) {
    const year = parts[0].slice(2);
    const mon = parts[1];
    return `${year}/${mon}`;
  }
  return monthStr.slice(5);
}

const COLORS = {
  primary: "#1f2937",
  secondary: "#6b7280",
  accent: "#3b82f6",
  videoBar: "#94a3b8",
};

interface TooltipPayloadEntry {
  value?: number | string;
  name?: string;
  color?: string;
  payload?: { fullMonth?: string };
}

// Component declared outside render
function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[140px]">
        <p className="font-medium text-gray-900 mb-2 pb-2 border-b border-gray-100">
          {payload[0]?.payload?.fullMonth || label}
        </p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-3 mb-1.5 last:mb-0">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">
                {entry.name === "播放量" ? "总播放" : "视频数"}:
              </span>
            </div>
            <span className="font-semibold text-gray-900">
              {entry.name === "播放量"
                ? formatView(Number(entry.value ?? 0))
                : `${entry.value ?? 0} 个`}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function TrendChart({
  data,
  type = "bar",
  showVideos = true,
  showViews = true,
}: TrendChartProps) {
  // 按时间正序排列（从早到晚）
  const sortedData = [...data]
    .filter((item) => item.month)
    .sort((a, b) => (a.month || "").localeCompare(b.month || ""));

  if (sortedData.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-sm">暂无数据</p>
          <p className="text-xs mt-1 text-gray-300">完成数据采集后将在此显示趋势</p>
        </div>
      </div>
    );
  }

  const chartData = sortedData.map((item) => ({
    month: formatMonth(item.month),
    fullMonth: item.month,
    videos: item.video_count,
    views: item.total_views,
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
            yAxisId="left"
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (showViews ? formatView(v) : v)}
          />
          {showVideos && (
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#9ca3af"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
            iconType="circle"
            iconSize={8}
          />
          {showViews && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="views"
              name="播放量"
              stroke={COLORS.accent}
              strokeWidth={2.5}
              dot={{ fill: COLORS.accent, r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, stroke: COLORS.accent, strokeWidth: 2 }}
            />
          )}
          {showVideos && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="videos"
              name="视频数"
              stroke={COLORS.videoBar}
              strokeWidth={2}
              dot={{ fill: COLORS.videoBar, r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, stroke: COLORS.videoBar, strokeWidth: 2 }}
              strokeDasharray="4 2"
            />
          )}
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
            yAxisId="left"
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (showViews ? formatView(v) : v)}
          />
          {showVideos && (
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#9ca3af"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
          )}
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f9fafb", opacity: 0.5 }} />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
            iconType="square"
            iconSize={8}
          />
          {showViews && (
            <Bar
              yAxisId="left"
              dataKey="views"
              name="播放量"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS.accent}
                  opacity={0.75 + (index / chartData.length) * 0.25}
                />
              ))}
            </Bar>
          )}
          {showVideos && (
            <Bar
              yAxisId="right"
              dataKey="videos"
              name="视频数"
              fill={COLORS.videoBar}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              opacity={0.65}
            />
          )}
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
