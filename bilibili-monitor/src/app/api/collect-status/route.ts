import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const STATUS_FILE = path.join(process.cwd(), "scripts", "collect_status.json");

interface CollectStatus {
  is_running: boolean;
  started_at: string | null;
  current_brand: string | null;
  current_brand_progress: string; // e.g., "3/5" or "15/46"
  total_brands: number;
  completed_brands: number;
  current_step: string; // e.g., "获取用户信息", "获取动态列表"
  message: string; // 当前正在做什么
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

export async function GET() {
  try {
    // 尝试读取状态文件
    const data = await fs.readFile(STATUS_FILE, "utf-8");
    const status: CollectStatus = JSON.parse(data);
    
    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch {
    // 文件不存在或读取失败，返回默认状态
    return NextResponse.json({
      success: true,
      data: {
        is_running: false,
        started_at: null,
        current_brand: null,
        current_brand_progress: "0/0",
        total_brands: 0,
        completed_brands: 0,
        current_step: "空闲",
        message: "系统就绪，等待下次采集",
        logs: [],
      },
    });
  }
}
