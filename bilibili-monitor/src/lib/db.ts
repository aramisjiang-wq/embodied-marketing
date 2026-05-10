import Database from "better-sqlite3";
import path from "path";
import type {
  Brand,
  Video,
  BrandStat,
  BrandWithStats,
  MonthlyStat,
  VideoWithStats,
  BrandPeriodStat,
  VideoWithBrand,
} from "./types";

const DB_PATH = path.join(process.cwd(), "bilibili_monitor.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initSchema();
  }
  return db;
}

function initSchema() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      is_self INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: add is_self column to existing databases that predate this field
  const brandCols = (database.prepare("PRAGMA table_info(brands)").all() as { name: string }[])
    .map((c) => c.name);
  if (!brandCols.includes("is_self")) {
    database.exec("ALTER TABLE brands ADD COLUMN is_self INTEGER DEFAULT 0");
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bvid TEXT UNIQUE NOT NULL,
      brand_id INTEGER NOT NULL,
      title TEXT,
      pub_ts INTEGER,
      pub_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (brand_id) REFERENCES brands(id),
      UNIQUE(brand_id, bvid)
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS video_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER NOT NULL,
      stat_date DATE NOT NULL,
      view INTEGER DEFAULT 0,
      like INTEGER DEFAULT 0,
      coin INTEGER DEFAULT 0,
      favorite INTEGER DEFAULT 0,
      reply INTEGER DEFAULT 0,
      danmaku INTEGER DEFAULT 0,
      share INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (video_id) REFERENCES videos(id),
      UNIQUE(video_id, stat_date)
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS brand_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id INTEGER NOT NULL,
      stat_date DATE NOT NULL,
      follower INTEGER DEFAULT 0,
      following INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (brand_id) REFERENCES brands(id),
      UNIQUE(brand_id, stat_date)
    )
  `);

  database.exec(`CREATE INDEX IF NOT EXISTS idx_videos_brand ON videos(brand_id)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_videos_pubdate ON videos(pub_date)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_video_stats_video ON video_stats(video_id)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_video_stats_date ON video_stats(stat_date)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_brand_stats_brand ON brand_stats(brand_id)`);

  // 网站统计表
  database.exec(`
    CREATE TABLE IF NOT EXISTS site_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stat_date DATE NOT NULL,
      page_views INTEGER DEFAULT 0,
      unique_visitors INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(stat_date)
    )
  `);

  // 爱心助力记录表
  database.exec(`
    CREATE TABLE IF NOT EXISTS site_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT,
      user_agent TEXT,
      liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(`CREATE INDEX IF NOT EXISTS idx_site_stats_date ON site_stats(stat_date)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_site_likes_time ON site_likes(liked_at)`);

  // 用户表
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      open_id TEXT UNIQUE NOT NULL,
      union_id TEXT,
      name TEXT NOT NULL,
      en_name TEXT,
      email TEXT,
      mobile TEXT,
      avatar_url TEXT,
      role TEXT DEFAULT 'viewer' CHECK(role IN ('admin', 'editor', 'viewer')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
      last_login_at TIMESTAMP,
      login_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 登录日志表
  database.exec(`
    CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 操作日志表
  database.exec(`
    CREATE TABLE IF NOT EXISTS action_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 索引
  database.exec(`CREATE INDEX IF NOT EXISTS idx_users_open_id ON users(open_id)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_login_logs_time ON login_logs(login_at)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_action_logs_user ON action_logs(user_id)`);
}

export function getAllBrands(): Brand[] {
  const database = getDb();
  return database.prepare("SELECT * FROM brands ORDER BY name").all() as Brand[];
}

export function getBrandById(id: number): Brand | undefined {
  const database = getDb();
  return database.prepare("SELECT * FROM brands WHERE id = ?").get(id) as Brand | undefined;
}

export function getBrandWithStatsById(id: number): BrandWithStats | undefined {
  const database = getDb();
  return database.prepare(`
    SELECT
      b.*,
      COALESCE(bs.follower, 0) as follower,
      COALESCE(bs.following, 0) as following,
      COUNT(DISTINCT v.id) as video_count,
      COALESCE(SUM(vs.view), 0) as total_views,
      MAX(vs.stat_date) as last_update
    FROM brands b
    LEFT JOIN brand_stats bs ON b.id = bs.brand_id
    LEFT JOIN videos v ON b.id = v.brand_id
    LEFT JOIN video_stats vs ON v.id = vs.video_id
    WHERE b.id = ?
    GROUP BY b.id
  `).get(id) as BrandWithStats | undefined;
}

export function getBrandByMid(mid: string): Brand | undefined {
  const database = getDb();
  return database.prepare("SELECT * FROM brands WHERE mid = ?").get(mid) as Brand | undefined;
}

export function createBrand(mid: string, name: string): Brand {
  const database = getDb();
  const stmt = database.prepare("INSERT INTO brands (mid, name) VALUES (?, ?)");
  const result = stmt.run(mid, name);
  return {
    id: result.lastInsertRowid as number,
    mid,
    name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function updateBrand(id: number, name: string): void {
  const database = getDb();
  database.prepare("UPDATE brands SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(name, id);
}

export function deleteBrand(id: number): void {
  const database = getDb();
  database.prepare("DELETE FROM video_stats WHERE video_id IN (SELECT id FROM videos WHERE brand_id = ?)")
    .run(id);
  database.prepare("DELETE FROM videos WHERE brand_id = ?").run(id);
  database.prepare("DELETE FROM brand_stats WHERE brand_id = ?").run(id);
  database.prepare("DELETE FROM brands WHERE id = ?").run(id);
}

export function getBrandsWithStats(): BrandWithStats[] {
  const database = getDb();
  return database.prepare(`
    SELECT
      b.*,
      COALESCE(bs.follower, 0) as follower,
      COALESCE(bs.following, 0) as following,
      COUNT(DISTINCT v.id) as video_count,
      COALESCE(SUM(vs.view), 0) as total_views,
      MAX(vs.stat_date) as last_update
    FROM brands b
    LEFT JOIN brand_stats bs ON b.id = bs.brand_id
    LEFT JOIN videos v ON b.id = v.brand_id
    LEFT JOIN video_stats vs ON v.id = vs.video_id
    GROUP BY b.id
    ORDER BY total_views DESC
  `).all() as BrandWithStats[];
}

export function getVideosByBrand(brandId: number): VideoWithStats[] {
  const database = getDb();
  return database.prepare(`
    SELECT v.*,
           COALESCE(vs.view, 0) as view,
           COALESCE(vs.like, 0) as like,
           COALESCE(vs.coin, 0) as coin,
           COALESCE(vs.favorite, 0) as favorite,
           COALESCE(vs.reply, 0) as reply
    FROM videos v
    LEFT JOIN video_stats vs ON v.id = vs.video_id
    WHERE v.brand_id = ?
    ORDER BY v.pub_ts DESC
  `).all(brandId) as VideoWithStats[];
}

export function getVideoByBvid(bvid: string): Video | undefined {
  const database = getDb();
  return database.prepare("SELECT * FROM videos WHERE bvid = ?").get(bvid) as Video | undefined;
}

export function createVideo(
  brandId: number,
  bvid: string,
  title: string | null,
  pubTs: number | null
): Video {
  const database = getDb();
  const pubDate = pubTs
    ? new Date(pubTs * 1000).toISOString().split("T")[0]
    : null;

  const stmt = database.prepare(
    "INSERT OR IGNORE INTO videos (brand_id, bvid, title, pub_ts, pub_date) VALUES (?, ?, ?, ?, ?)"
  );
  stmt.run(brandId, bvid, title, pubTs, pubDate);

  const existing = database.prepare("SELECT * FROM videos WHERE bvid = ?").get(bvid) as Video;
  return existing;
}

export function createVideoStat(
  videoId: number,
  statDate: string,
  view: number,
  like: number,
  coin: number,
  favorite: number,
  reply: number,
  danmaku: number,
  share: number
): void {
  const database = getDb();
  database.prepare(`
    INSERT OR REPLACE INTO video_stats
    (video_id, stat_date, view, like, coin, favorite, reply, danmaku, share)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(videoId, statDate, view, like, coin, favorite, reply, danmaku, share);
}

export function createBrandStat(
  brandId: number,
  statDate: string,
  follower: number,
  following: number
): void {
  const database = getDb();
  database.prepare(`
    INSERT OR REPLACE INTO brand_stats
    (brand_id, stat_date, follower, following)
    VALUES (?, ?, ?, ?)
  `).run(brandId, statDate, follower, following);
}

export function getMonthlyStats(brandId?: number): MonthlyStat[] {
  const database = getDb();
  const whereClause = brandId ? "WHERE v.brand_id = ?" : "";

  return database.prepare(`
    SELECT
      strftime('%Y-%m', v.pub_date) as month,
      COUNT(DISTINCT v.id) as video_count,
      COALESCE(SUM(vs.view), 0) as total_views,
      COALESCE(SUM(vs.like), 0) as total_likes,
      COALESCE(SUM(vs.favorite), 0) as total_favorites
    FROM videos v
    LEFT JOIN video_stats vs ON v.id = vs.video_id
    ${whereClause}
    GROUP BY strftime('%Y-%m', v.pub_date)
    ORDER BY month DESC
  `).all(brandId ? [brandId] : []) as MonthlyStat[];
}

export function getBrandMonthlyStats(brandId: number): MonthlyStat[] {
  const database = getDb();

  const rawData = database.prepare(`
    SELECT
      strftime('%Y-%m', v.pub_date) as month,
      COUNT(DISTINCT v.id) as video_count,
      COALESCE(SUM(vs.view), 0) as total_views,
      COALESCE(SUM(vs.like), 0) as total_likes,
      COALESCE(SUM(vs.favorite), 0) as total_favorites
    FROM videos v
    LEFT JOIN video_stats vs ON v.id = vs.video_id
    WHERE v.brand_id = ? AND v.pub_date IS NOT NULL
    GROUP BY strftime('%Y-%m', v.pub_date)
    ORDER BY month ASC
  `).all([brandId]) as { month: string; video_count: number; total_views: number; total_likes?: number; total_favorites?: number }[];

  const now = new Date();
  const monthlyByMonth = new Map(rawData.map((item) => [item.month, item]));

  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const existingData = monthlyByMonth.get(month);

    return {
      month,
      video_count: existingData?.video_count || 0,
      total_views: existingData?.total_views || 0,
      total_likes: existingData?.total_likes || 0,
      total_favorites: existingData?.total_favorites || 0,
    };
  });
}

export function getComparisonData(brandIds: number[], months: number = 12): BrandPeriodStat[] {
  const database = getDb();
  const placeholders = brandIds.map(() => "?").join(",");

  // 获取原始数据（只返回有视频的月份）
  const rawData = database.prepare(`
    SELECT
      strftime('%Y-%m', v.pub_date) as month,
      v.brand_id,
      b.name as brand_name,
      COUNT(DISTINCT v.id) as video_count,
      COALESCE(SUM(vs.view), 0) as total_views,
      COALESCE(SUM(vs.like), 0) as total_likes,
      COALESCE(SUM(vs.favorite), 0) as total_favorites
    FROM videos v
    LEFT JOIN video_stats vs ON v.id = vs.video_id
    JOIN brands b ON v.brand_id = b.id
    WHERE v.brand_id IN (${placeholders})
      AND v.pub_date IS NOT NULL
    GROUP BY strftime('%Y-%m', v.pub_date), v.brand_id, b.name
    ORDER BY month ASC
  `).all(...brandIds) as { month: string; brand_id: number; brand_name: string; video_count: number; total_views: number; total_likes: number; total_favorites: number }[];

  if (rawData.length === 0) {
    return [];
  }

  // 生成完整的月份序列（包含当前月份在内的最近N个月）
  const result: BrandPeriodStat[] = [];
  const now = new Date();
  // 从上个月往前推(months-1)个月，然后循环months+1次以包含当前月
  // 简化方案：直接从(months-1)个月前开始，包含当前月共months个月份
  const startDate = new Date(now.getFullYear(), now.getMonth() - (months - 1) + 1, 1);

  // 获取所有品牌ID和名称
  const brands = [...new Map(rawData.map(d => [d.brand_id, d.brand_name])).entries()]
    .map(([id, name]) => ({ id, name }));

  for (let i = 0; i < months; i++) {
    const monthStr = startDate.toISOString().slice(0, 7); // "2026-05"

    for (const brand of brands) {
      const existingData = rawData.find(
        (d) => d.month === monthStr && d.brand_id === brand.id
      );

      result.push({
        period: monthStr,
        brand_id: brand.id,
        brand_name: brand.name,
        is_self: 0,
        video_count: existingData?.video_count || 0,
        total_views: existingData?.total_views || 0,
      });
    }

    startDate.setMonth(startDate.getMonth() + 1);
  }

  return result;
}

export function getLatestBrandStats(): Map<number, BrandStat> {
  const database = getDb();
  const stats = database.prepare(`
    SELECT bs.* FROM brand_stats bs
    JOIN (
      SELECT brand_id, MAX(stat_date) as max_date
      FROM brand_stats
      GROUP BY brand_id
    ) latest ON bs.brand_id = latest.brand_id AND bs.stat_date = latest.max_date
  `).all() as BrandStat[];

  const map = new Map<number, BrandStat>();
  stats.forEach((stat) => map.set(stat.brand_id, stat));
  return map;
}

export function getWeeklyStats(brandIds: number[]): BrandPeriodStat[] {
  const database = getDb();
  const placeholders = brandIds.map(() => "?").join(",");

  const today = new Date();

  // 生成最近12个自然周（周一到周日）
  const weekRanges: { start: string; end: string; label: string }[] = [];

  for (let i = 0; i < 12; i++) {
    // 计算当前周的起始日（周一）
    const currentDay = new Date(today);
    currentDay.setDate(today.getDate() - i * 7);

    // 获取本周的周一
    const dayOfWeek = currentDay.getDay(); // 0=周日, 1=周一, ..., 6=周六
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 周日需要回退6天到周一
    const monday = new Date(currentDay);
    monday.setDate(currentDay.getDate() + mondayOffset);

    // 获取本周的周日
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6); // 周一+6天=周日

    // 格式化日期范围 (YYYY-MM-DD)
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      const day = d.getDate().toString().padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const startStr = formatDate(monday);
    const endStr = formatDate(sunday);

    // 生成周标签: "05/11-05/17" (MM/DD-MM/DD格式)
    const label = `${(monday.getMonth() + 1).toString().padStart(2, "0")}/${monday.getDate().toString().padStart(2, "0")}-${(sunday.getMonth() + 1).toString().padStart(2, "0")}/${sunday.getDate().toString().padStart(2, "0")}`;

    weekRanges.push({ start: startStr, end: endStr, label });
  }

  // 按时间倒序排列（最新的在前）
  weekRanges.reverse();

  try {
    // 简化版 SQL：直接遍历每个周范围进行查询
    const results: BrandPeriodStat[] = [];

    for (const weekRange of weekRanges) {
      const weekData = database.prepare(`
        SELECT
          ? as period,
          v.brand_id,
          b.name as brand_name,
          b.is_self,
          COUNT(DISTINCT v.id) as video_count,
          COALESCE(SUM(vs.view), 0) as total_views
        FROM brands b
        LEFT JOIN videos v ON v.brand_id = b.id
          AND v.pub_date >= ?
          AND v.pub_date <= ?
          AND v.pub_date IS NOT NULL
        LEFT JOIN video_stats vs ON v.id = vs.video_id
        WHERE b.id IN (${placeholders})
        GROUP BY v.brand_id, b.name, b.is_self
      `).all(
        weekRange.label,
        weekRange.start,
        weekRange.end,
        ...brandIds
      ) as BrandPeriodStat[];

      results.push(...weekData);
    }

    return results;
  } catch (error) {
    console.error("Error in getWeeklyStats:", error);
    // 返回空数组而不是崩溃
    return [];
  }
}

export function getMonthlyBrandStats(brandIds: number[]): BrandPeriodStat[] {
  const database = getDb();
  const placeholders = brandIds.map(() => "?").join(",");
  return database.prepare(`
    SELECT
      strftime('%Y-%m', v.pub_date) as period,
      v.brand_id,
      b.name as brand_name,
      b.is_self,
      COUNT(DISTINCT v.id) as video_count,
      COALESCE(SUM(vs.view), 0) as total_views
    FROM videos v
    JOIN brands b ON v.brand_id = b.id
    LEFT JOIN video_stats vs ON v.id = vs.video_id
    WHERE v.brand_id IN (${placeholders})
      AND v.pub_date IS NOT NULL
    GROUP BY strftime('%Y-%m', v.pub_date), v.brand_id
    ORDER BY period DESC
  `).all(...brandIds) as BrandPeriodStat[];
}

/**
 * 获取系统运行状态信息
 */
export function getSystemStatus(): { status: string; lastUpdate: string | null; totalBrands: number; totalVideos: number } {
  const database = getDb();

  try {
    // 获取最新数据采集时间
    const latestStat = database.prepare(`
      SELECT MAX(created_at) as last_update FROM video_stats
    `).get() as { last_update: string | null };

    // 获取品牌和视频总数
    const stats = database.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM brands) as total_brands,
        (SELECT COUNT(*) FROM videos) as total_videos
    `).get() as { total_brands: number; total_videos: number };

    // 判断系统状态
    let status = 'idle';
    if (latestStat?.last_update) {
      const lastUpdate = new Date(latestStat.last_update);
      const now = new Date();
      const diffHours = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

      if (diffHours < 2) {
        status = 'running';
      } else if (diffHours < 24) {
        status = 'idle';
      } else {
        status = 'stale';
      }
    }

    return {
      status,
      lastUpdate: latestStat?.last_update ? new Date(latestStat.last_update).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }) : null,
      totalBrands: stats.total_brands || 0,
      totalVideos: stats.total_videos || 0,
    };
  } catch (error) {
    console.error("获取系统状态失败:", error);
    return {
      status: 'error',
      lastUpdate: null,
      totalBrands: 0,
      totalVideos: 0,
    };
  }
}

export function getYearlyMonthlyStats(
  brandIds: number[],
  year: number
): BrandPeriodStat[] {
  const database = getDb();
  const placeholders = brandIds.map(() => "?").join(",");

  const rawData = database.prepare(`
    SELECT
      strftime('%Y-%m', v.pub_date) as period,
      v.brand_id,
      b.name as brand_name,
      b.is_self,
      COUNT(DISTINCT v.id) as video_count,
      COALESCE(SUM(vs.view), 0) as total_views
    FROM videos v
    JOIN brands b ON v.brand_id = b.id
    LEFT JOIN video_stats vs ON v.id = vs.video_id
    WHERE v.brand_id IN (${placeholders})
      AND v.pub_date IS NOT NULL
      AND strftime('%Y', v.pub_date) = ?
    GROUP BY strftime('%Y-%m', v.pub_date), v.brand_id, b.name, b.is_self
    ORDER BY period ASC
  `).all([...brandIds, year.toString()]) as {
    period: string;
    brand_id: number;
    brand_name: string;
    is_self?: number;
    video_count: number;
    total_views: number;
  }[];

  const result: BrandPeriodStat[] = [];
  const brands = [...new Map(rawData.map(d => [d.brand_id, d.brand_name])).entries()]
    .map(([id, name]) => ({ id, name }));

  for (let month = 1; month <= 12; month++) {
    const period = `${year}-${month.toString().padStart(2, '0')}`;

    for (const brand of brands) {
      const existingData = rawData.find(
        (d) => d.period === period && d.brand_id === brand.id
      );

      result.push({
        period,
        brand_id: brand.id,
        brand_name: brand.name,
        is_self: existingData?.is_self || 0,
        video_count: existingData?.video_count || 0,
        total_views: existingData?.total_views || 0,
      });
    }
  }

  return result;
}

export function getThisWeekVideos(brandIds: number[]): VideoWithBrand[] {
  const database = getDb();
  const placeholders = brandIds.map(() => "?").join(",");

  const today = new Date();
  const dayOfWeek = today.getDay();

  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  try {
    const videos = database.prepare(`
      SELECT
        v.bvid,
        v.title,
        v.pub_date,
        b.name as brand_name,
        v.brand_id
      FROM videos v
      JOIN brands b ON v.brand_id = b.id
      WHERE v.brand_id IN (${placeholders})
        AND v.pub_date >= ?
        AND v.pub_date <= ?
        AND v.pub_date IS NOT NULL
        AND v.title IS NOT NULL
        AND v.title != ''
      ORDER BY v.pub_date DESC, v.id DESC
    `).all(
      ...brandIds,
      formatDate(monday),
      formatDate(sunday)
    ) as VideoWithBrand[];

    return videos;
  } catch (error) {
    console.error("[DB/getThisWeekVideos] Error:", error);
    return [];
  }
}

// ============================================
// 网站统计相关函数
// ============================================

export interface SiteStats {
  total_views: number;        // 总访问量
  today_views: number;       // 今日访问量
  total_likes: number;       // 总助力数
  today_likes: number;       // 今日助力数
  unique_visitors: number;   // 独立访客数
}

/**
 * 记录一次页面访问
 */
export function recordPageView(ipAddress?: string): void {
  const database = getDb();
  const today = new Date().toISOString().split('T')[0];

  // 更新今日统计（如果不存在则插入）
  database.prepare(`
    INSERT INTO site_stats (stat_date, page_views, unique_visitors, likes, updated_at)
    VALUES (?, 1, 1, 0, CURRENT_TIMESTAMP)
    ON CONFLICT(stat_date) DO UPDATE SET
      page_views = page_views + 1,
      updated_at = CURRENT_TIMESTAMP
  `).run(today);

  // 如果提供了IP，记录独立访客（简化版：仅当日首次访问计数）
  if (ipAddress) {
    const existingVisitor = database.prepare(`
      SELECT COUNT(*) as count FROM site_stats WHERE stat_date = ?
    `).get(today) as { count: number };

    if (existingVisitor && existingVisitor.count > 0) {
      // 已经有记录，不做额外处理（实际项目中可以用更复杂的UV计算）
    }
  }
}

/**
 * 记录一次爱心助力
 */
export function recordLike(ipAddress?: string, userAgent?: string): boolean {
  try {
    const database = getDb();
    const today = new Date().toISOString().split('T')[0];

    // 插入助力记录
    database.prepare(`
      INSERT INTO site_likes (ip_address, user_agent) VALUES (?, ?)
    `).run(ipAddress || null, userAgent || null);

    // 更新今日统计中的likes字段
    database.prepare(`
      INSERT INTO site_stats (stat_date, page_views, unique_visitors, likes, updated_at)
      VALUES (?, 0, 0, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(stat_date) DO UPDATE SET
        likes = likes + 1,
        updated_at = CURRENT_TIMESTAMP
    `).run(today);

    return true;
  } catch (error) {
    console.error("[DB/recordLike] Error:", error);
    return false;
  }
}

/**
 * 获取网站统计数据
 */
export function getSiteStats(): SiteStats {
  const database = getDb();
  const today = new Date().toISOString().split('T')[0];

  try {
    // 获取总访问量（所有日期的page_views之和）
    const totalResult = database.prepare(`
      SELECT COALESCE(SUM(page_views), 0) as total_views,
             COALESCE(SUM(likes), 0) as total_likes,
             COALESCE(SUM(unique_visitors), 0) as unique_visitors
      FROM site_stats
    `).get() as { total_views: number; total_likes: number; unique_visitors: number };

    // 获取今日统计
    const todayResult = database.prepare(`
      SELECT COALESCE(page_views, 0) as today_views,
             COALESCE(likes, 0) as today_likes
      FROM site_stats WHERE stat_date = ?
    `).get(today) as { today_views: number; today_likes: number } | undefined;

    return {
      total_views: totalResult?.total_views || 0,
      today_views: todayResult?.today_views || 0,
      total_likes: totalResult?.total_likes || 0,
      today_likes: todayResult?.today_likes || 0,
      unique_visitors: totalResult?.unique_visitors || 0,
    };
  } catch (error) {
    console.error("[DB/getSiteStats] Error:", error);
    return {
      total_views: 0,
      today_views: 0,
      total_likes: 0,
      today_likes: 0,
      unique_visitors: 0,
    };
  }
}

/**
 * 获取最近N天的访问趋势数据
 */
export function getSiteStatsTrend(days: number = 7): Array<{
  date: string;
  views: number;
  likes: number;
}> {
  const database = getDb();

  try {
    const rawData = database.prepare(`
      SELECT stat_date as date,
             COALESCE(page_views, 0) as views,
             COALESCE(likes, 0) as likes
      FROM site_stats
      WHERE stat_date >= date('now', ? || ' days')
      ORDER BY stat_date ASC
    `).all(-days) as Array<{ date: string; views: number; likes: number }>;

    return rawData;
  } catch (error) {
    console.error("[DB/getSiteStatsTrend] Error:", error);
    return [];
  }
}
