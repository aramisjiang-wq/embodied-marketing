"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, Clock, CheckCircle, History } from "lucide-react";

interface CollectStatus {
  is_running: boolean;
  started_at: string | null;
  current_brand: string | null;
  current_brand_progress: string;
  total_brands: number;
  completed_brands: number;
  current_step: string;
  message: string;
  logs: Array<{
    time: string;
    level: string;
    brand: string;
    message: string;
  }>;
  last_run_summary?: {
    total_videos: number;
    success_count: number;
    total_brands: number;
    duration: number;
    completed_at: string;
  } | null;
}

interface RunLog {
  id: number;
  run_time: string;
  duration: number;
  total_brands: number;
  success_count: number;
  failed_count: number;
  total_videos: number;
  errors: string | null;
}

interface CollectProgressProps {
  className?: string;
}

export function CollectProgress({ className = "" }: CollectProgressProps) {
  const [status, setStatus] = useState<CollectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<RunLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/collect-status");
      const data = await res.json();
      if (data.success) {
        setStatus(data.data);
        setLoading(false);
      }
    } catch {
      // silent
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    
    // 如果正在运行，每3秒轮询一次
    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchStatus]);

  const fetchHistory = async () => {
    if (showHistory && history.length === 0) {
      setHistoryLoading(true);
      try {
        const res = await fetch("/api/collect-history?limit=10");
        const data = await res.json();
        if (data.success) {
          setHistory(data.data.logs || []);
        }
      } catch {
        // silent
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
    fetchHistory();
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 p-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-400">
          <Activity className="w-4 h-4 animate-pulse" />
          <span className="text-sm">加载状态...</span>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const progress = status.total_brands > 0 
    ? (status.completed_brands / status.total_brands) * 100 
    : 0;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${status.is_running ? "text-blue-500 animate-pulse" : "text-gray-400"}`} />
          <span className="text-sm font-medium text-gray-900">数据采集</span>
          
          {/* Status Badge */}
          {status.is_running ? (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
              采集中
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs">
              <CheckCircle className="w-3 h-3" />
              就绪
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleHistory}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            <History className="w-3 h-3" />
            历史
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {expanded ? "收起" : "详情"}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {status.is_running && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600">
              {status.current_brand || "准备中..."}
            </span>
            <span className="text-xs text-gray-500">
              {status.completed_brands}/{status.total_brands} 品牌
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-400 mt-1">{status.current_step}</p>
        </div>
      )}

      {/* Last Run Summary */}
      {!status.is_running && status.last_run_summary && (
        <div className="mb-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-xs font-medium text-gray-700 mb-1.5">✅ 上次采集完成</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
            <div>📹 视频: <span className="font-semibold text-gray-900">{status.last_run_summary.total_videos}</span></div>
            <div>⏱️ 耗时: <span className="font-semibold text-gray-900">{status.last_run_summary.duration}秒</span></div>
            <div>✅ 成功: <span className="font-semibold text-gray-900">{status.last_run_summary.success_count}/{status.last_run_summary.total_brands}</span></div>
            <div>🕐 时间: <span className="font-semibold text-gray-900">{new Date(status.last_run_summary.completed_at).toLocaleString("zh-CN", { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
          </div>
        </div>
      )}

      {/* Status Message */}
      {!status.is_running && !status.last_run_summary && (
        <p className="text-sm text-gray-600 mb-2">{status.message}</p>
      )}

      {/* Update Schedule Info */}
      <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3" />
          <span>每天 00:00 自动更新 · 数据每日刷新一次</span>
        </div>
        {status.last_run_summary && (
          <div className="flex items-center gap-1">
            <span className="text-gray-500">上次更新:</span>
            <span className="font-medium text-gray-600">
              {new Date(status.last_run_summary.completed_at).toLocaleString("zh-CN", {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          {/* Current Step Info */}
          {status.is_running && status.started_at && (
            <div className="text-xs text-gray-500">
              <span>开始时间: {new Date(status.started_at).toLocaleString("zh-CN")}</span>
            </div>
          )}

          {/* Recent Logs */}
          {status.logs.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {status.logs.slice(-10).map((log, index) => (
                <div key={index} className="flex items-start gap-2 text-xs">
                  <span className="text-gray-400 whitespace-nowrap">
                    {new Date(log.time).toLocaleTimeString("zh-CN", { 
                      hour: "2-digit", 
                      minute: "2-digit",
                      second: "2-digit"
                    })}
                  </span>
                  <span className={`font-medium ${
                    log.level === "error" ? "text-red-500" :
                    log.level === "warning" ? "text-yellow-600" :
                    "text-gray-600"
                  }`}>
                    {log.brand}
                  </span>
                  <span className="text-gray-500 flex-1">{log.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {status.logs.length === 0 && !status.is_running && (
            <div className="text-center py-4 text-gray-400 text-xs">
              {status.last_run_summary ? "实时日志已清除（可在下方查看历史记录）" : "暂无采集日志"}
            </div>
          )}
        </div>
      )}

      {/* History Section */}
      {showHistory && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <History className="w-3 h-3" />
              采集历史记录
            </h4>
            <span className="text-xs text-gray-400">{history.length} 条记录</span>
          </div>

          {historyLoading ? (
            <div className="text-center py-4 text-gray-400 text-xs">加载中...</div>
          ) : history.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.map((log) => (
                <div key={log.id} className="p-2 bg-gray-50 rounded-lg text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-700">
                      {new Date(log.run_time).toLocaleString("zh-CN", { 
                        month: 'numeric', 
                        day: 'numeric',
                        hour: '2-digit', 
                        minute: '2-digit'
                      })}
                    </span>
                    <span className={`${log.failed_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {log.success_count}/{log.total_brands} 成功
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-gray-500">
                    <div>📹 {log.total_videos}视频</div>
                    <div>⏱️ {log.duration}秒</div>
                    <div>{log.failed_count > 0 ? `❌ ${log.failed_count}失败` : '✅ 无错误'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400 text-xs">暂无历史记录</div>
          )}
        </div>
      )}
    </div>
  );
}
