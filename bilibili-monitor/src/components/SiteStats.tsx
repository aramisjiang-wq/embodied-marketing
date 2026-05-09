"use client";

import { useState, useEffect, useCallback } from "react";
import { Eye, Heart } from "lucide-react";

interface SiteStatsData {
  total_views: number;
  today_views: number;
  total_likes: number;
  today_likes: number;
  unique_visitors: number;
}

interface SiteStatsProps {
  className?: string;
  variant?: "compact" | "default";
}

function formatNumber(num: number): string {
  if (num >= 10000) return (num / 10000).toFixed(1) + "万";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num.toString();
}

export function SiteStats({ className = "", variant = "compact" }: SiteStatsProps) {
  const [stats, setStats] = useState<SiteStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/site-stats");
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to fetch site stats:", error);
      setLoading(false);
    }
  }, []);

  const recordView = useCallback(async () => {
    try {
      await fetch("/api/page-view", { method: "POST" });
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    fetchStats();
    recordView();
  }, [fetchStats, recordView]);

  const handleLike = async () => {
    if (liking || liked) return;

    setLiking(true);

    try {
      const res = await fetch("/api/site-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (data.success) {
        setStats(data.data);
        setLiked(true);
      }
    } catch (error) {
      console.error("Failed to like:", error);
    } finally {
      setLiking(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className={`flex items-center gap-3 text-xs text-gray-400 ${className}`}>
        <div className="w-8 h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="w-6 h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  // 极简模式：用于导航栏集成
  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {/* 访问量 */}
        <div className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors">
          <Eye className="w-3.5 h-3.5" />
          <span className="text-xs font-medium tabular-nums">{formatNumber(stats.total_views)}</span>
        </div>

        {/* 分隔符 */}
        <div className="w-px h-3 bg-gray-200"></div>

        {/* 爱心助力 */}
        <button
          onClick={handleLike}
          disabled={liking || liked}
          className={`
            flex items-center gap-1.5 text-xs font-medium transition-all duration-200
            ${liked ? "text-rose-500" : "text-gray-500 hover:text-rose-500"}
            ${liking ? "opacity-50 cursor-wait" : ""}
          `}
          title={liked ? "已助力" : "为项目助力"}
        >
          <Heart
            className={`w-3.5 h-3.5 transition-all duration-200 ${liked ? "fill-current scale-110" : ""}`}
          />
          <span className="tabular-nums">{formatNumber(stats.total_likes)}</span>
        </button>
      </div>
    );
  }

  // 默认模式：白底卡片（用于其他场景）
  const likedColor = liked ? "text-rose-600" : "text-gray-900 group-hover:text-rose-600";

  return (
    <div className={`bg-white rounded-lg border border-gray-200 px-4 py-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          {/* 总访问量 */}
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-[10px] text-gray-400">访问</p>
              <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatNumber(stats.total_views)}</p>
            </div>
          </div>

          {/* 今日访问量 */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">今日</p>
              <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatNumber(stats.today_views)}</p>
            </div>
          </div>

          {/* 助力数 */}
          <button
            onClick={handleLike}
            disabled={liking || liked}
            className={`flex items-center gap-2 group transition-all duration-200 ${
              liked ? "" : "hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 -my-1"
            } ${liking ? "opacity-50" : ""}`}
          >
            <Heart
              className={`w-4 h-4 transition-all duration-200 ${
                liked ? "fill-rose-500 text-rose-500" : "text-gray-400 group-hover:text-rose-500"
              }`}
            />
            <div>
              <p className="text-[10px] text-gray-400">助力</p>
              <p className={`text-sm font-semibold tabular-nums ${likedColor}`}>{formatNumber(stats.total_likes)}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
