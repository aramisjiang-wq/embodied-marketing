"use client";

import { useState, useEffect, useCallback } from "react";
import { useFilter } from "@/components/layout/FilterContext";
import { Card, CardHeader, CardTitle, Badge } from "@/components/ui";
import type { VideoWithBrand } from "@/lib/types";

export function ThisWeekVideos() {
  const { selectedBrands } = useFilter();
  const [videos, setVideos] = useState<VideoWithBrand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVideos = useCallback(async () => {
    if (selectedBrands.length === 0) {
      setVideos([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ids = selectedBrands.join(",");
      const res = await fetch(`/api/this-week-videos?brandIds=${ids}`);
      const data = await res.json();

      if (data.success) {
        setVideos(data.data || []);
      } else {
        setError(data.error || "加载失败");
      }
    } catch (err) {
      console.error("Failed to load this week videos:", err);
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }, [selectedBrands]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  if (selectedBrands.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>📹 本周新视频</CardTitle>
            {!loading && videos.length > 0 && (
              <Badge variant="default">共 {videos.length} 条</Badge>
            )}
          </div>

          <button
            onClick={loadVideos}
            disabled={loading}
            className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
            title="刷新数据"
          >
            {loading ? "加载中..." : "刷新"}
          </button>
        </div>
      </CardHeader>

      <div className="min-h-[100px]">
        {loading && videos.length === 0 ? (
          <div className="py-8 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
              加载中...
            </div>
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={loadVideos}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700"
            >
              重试
            </button>
          </div>
        ) : videos.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            <p>📭 本周暂无新发布视频</p>
            <p className="text-xs mt-1">请检查数据采集是否正常运行</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto custom-scrollbar">
            {videos.map((video, index) => (
              <div
                key={`${video.bvid}-${index}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex-1 min-w-0 mr-4">
                  <a
                    href={`https://www.bilibili.com/video/${video.bvid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors truncate block"
                    title={video.title || undefined}
                  >
                    {video.title || "未命名视频"}
                  </a>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-500 tabular-nums min-w-[36px]">
                    {video.pub_date
                      ? new Date(video.pub_date).toLocaleDateString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit'
                        })
                      : "-"
                    }
                  </span>

                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium whitespace-nowrap">
                    {video.brand_name}
                  </span>

                  <svg
                    className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
