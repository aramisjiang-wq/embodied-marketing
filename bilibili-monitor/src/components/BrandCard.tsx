"use client";

import { ChevronRight } from "lucide-react";

interface BrandCardProps {
  id: number;
  name: string;
  follower: number;
  videoCount: number;
  totalViews: number;
  trend?: number;
  onClick?: () => void;
}

function formatNumber(num: number): string {
  if (num >= 100000000) {
    return (num / 100000000).toFixed(1) + "亿";
  }
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + "万";
  }
  return num.toLocaleString();
}

export function BrandCard({
  id: _id,
  name,
  follower,
  videoCount,
  totalViews,
  trend,
  onClick,
}: BrandCardProps) {
  void _id; // reserved for future use (e.g., analytics tracking)
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{name}</h3>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <span className="text-gray-500">粉丝</span>
          <p className="font-medium text-gray-900">{formatNumber(follower)}</p>
        </div>
        <div>
          <span className="text-gray-500">视频</span>
          <p className="font-medium text-gray-900">{videoCount}</p>
        </div>
        <div>
          <span className="text-gray-500">播放</span>
          <p className="font-medium text-gray-900">{formatNumber(totalViews)}</p>
        </div>
      </div>

      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1 text-sm">
          <span
            className={`font-medium ${
              isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-gray-400"
            }`}
          >
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {Math.abs(trend || 0)}%
          </span>
          <span className="text-gray-400">较上月</span>
        </div>
      )}
    </div>
  );
}
