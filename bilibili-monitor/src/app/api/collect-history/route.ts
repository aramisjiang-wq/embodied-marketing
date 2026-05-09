import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "..", "bilibili_monitor.db");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  try {
    const db = new Database(DB_PATH, { readonly: true });

    const logs = db
      .prepare(
        `
        SELECT 
          id,
          run_time,
          duration,
          total_brands,
          success_count,
          failed_count,
          total_videos,
          errors
        FROM run_logs
        ORDER BY id DESC
        LIMIT ?
      `
      )
      .all(limit);

    db.close();

    const typedLogs = logs as Array<Record<string, unknown>>;

    return NextResponse.json({
      success: true,
      data: {
        logs: typedLogs.map((log) => ({
          id: log.id,
          run_time: log.run_time,
          duration: Math.round(Number(log.duration || 0) * 10) / 10,
          total_brands: log.total_brands,
          success_count: log.success_count,
          failed_count: log.failed_count,
          total_videos: log.total_videos,
          errors: log.errors,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to fetch collect history:", error);

    return NextResponse.json({
      success: true,
      data: {
        logs: [],
        error: "无法加载历史记录",
      },
    });
  }
}
