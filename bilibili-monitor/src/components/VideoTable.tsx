"use client";

import { useState } from "react";

interface Video {
  id: number;
  bvid: string;
  title: string | null;
  pub_date: string | null;
  view: number;
  like: number;
  favorite: number;
  reply: number;
}

interface VideoTableProps {
  videos: Video[];
  onVideoClick?: (video: Video) => void;
}

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + "万";
  }
  return num.toLocaleString();
}

export function VideoTable({ videos, onVideoClick }: VideoTableProps) {
  const [sortBy, setSortBy] = useState<"pub_date" | "view" | "like">("pub_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const sortedVideos = [...videos].sort((a, b) => {
    let comparison = 0;
    if (sortBy === "pub_date") {
      comparison = (a.pub_date || "").localeCompare(b.pub_date || "");
    } else if (sortBy === "view") {
      comparison = a.view - b.view;
    } else if (sortBy === "like") {
      comparison = a.like - b.like;
    }
    return sortOrder === "desc" ? -comparison : comparison;
  });

  const handleSort = (column: "pub_date" | "view" | "like") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const SortIcon = ({ column }: { column: "pub_date" | "view" | "like" }) => {
    if (sortBy !== column) return null;
    return sortOrder === "asc" ? " ↑" : " ↓";
  };

  if (videos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        暂无视频数据
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
              标题
            </th>
            <th
              className="text-right py-3 px-4 text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700"
              onClick={() => handleSort("pub_date")}
            >
              发布日期{SortIcon({ column: "pub_date" })}
            </th>
            <th
              className="text-right py-3 px-4 text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700"
              onClick={() => handleSort("view")}
            >
              播放{SortIcon({ column: "view" })}
            </th>
            <th
              className="text-right py-3 px-4 text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700"
              onClick={() => handleSort("like")}
            >
              点赞{SortIcon({ column: "like" })}
            </th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
              收藏
            </th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
              评论
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedVideos.map((video) => (
            <tr
              key={video.id}
              onClick={() => onVideoClick?.(video)}
              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
            >
              <td className="py-3 px-4">
                <div className="max-w-md truncate text-sm text-gray-900">
                  {video.title || "无标题"}
                </div>
                <div className="text-xs text-gray-400">{video.bvid}</div>
              </td>
              <td className="text-right py-3 px-4 text-sm text-gray-600">
                {video.pub_date || "-"}
              </td>
              <td className="text-right py-3 px-4 text-sm font-medium text-gray-900">
                {formatNumber(video.view)}
              </td>
              <td className="text-right py-3 px-4 text-sm font-medium text-gray-900">
                {formatNumber(video.like)}
              </td>
              <td className="text-right py-3 px-4 text-sm font-medium text-gray-900">
                {formatNumber(video.favorite)}
              </td>
              <td className="text-right py-3 px-4 text-sm font-medium text-gray-900">
                {formatNumber(video.reply)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
