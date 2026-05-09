import sqlite3
from datetime import datetime
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'bilibili_monitor.db')

def get_connection():
    return sqlite3.connect(DB_PATH)

def init_database():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS brands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mid TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    cursor.execute('''
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
    ''')

    cursor.execute('''
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
    ''')

    cursor.execute('''
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
    ''')

    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_videos_brand ON videos(brand_id)
    ''')
    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_videos_pubdate ON videos(pub_date)
    ''')
    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_video_stats_video ON video_stats(video_id)
    ''')
    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_video_stats_date ON video_stats(stat_date)
    ''')

    conn.commit()
    conn.close()
    print(f"数据库初始化完成: {DB_PATH}")

def insert_brand(mid, name):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT OR IGNORE INTO brands (mid, name) VALUES (?, ?)",
            (mid, name)
        )
        conn.commit()
        brand_id = cursor.lastrowid
        if brand_id == 0:
            cursor.execute("SELECT id FROM brands WHERE mid = ?", (mid,))
            brand_id = cursor.fetchone()[0]
    finally:
        conn.close()
    return brand_id

def insert_video(brand_id, bvid, title, pub_ts):
    conn = get_connection()
    cursor = conn.cursor()
    pub_date = datetime.fromtimestamp(int(pub_ts)).strftime('%Y-%m-%d') if pub_ts else None
    try:
        cursor.execute(
            """INSERT OR IGNORE INTO videos (brand_id, bvid, title, pub_ts, pub_date)
               VALUES (?, ?, ?, ?, ?)""",
            (brand_id, bvid, title, pub_ts, pub_date)
        )
        conn.commit()
        video_id = cursor.lastrowid
        if video_id == 0:
            cursor.execute("SELECT id FROM videos WHERE bvid = ?", (bvid,))
            video_id = cursor.fetchone()[0]
    finally:
        conn.close()
    return video_id

def insert_video_stats(video_id, stat_date, view, like, coin, favorite, reply, danmaku, share):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """INSERT OR REPLACE INTO video_stats
               (video_id, stat_date, view, like, coin, favorite, reply, danmaku, share)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (video_id, stat_date, view, like, coin, favorite, reply, danmaku, share)
        )
        conn.commit()
    finally:
        conn.close()

def insert_brand_stats(brand_id, stat_date, follower, following):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """INSERT OR REPLACE INTO brand_stats
               (brand_id, stat_date, follower, following)
               VALUES (?, ?, ?, ?)""",
            (brand_id, stat_date, follower, following)
        )
        conn.commit()
    finally:
        conn.close()

def get_all_brands():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, mid, name FROM brands")
    result = cursor.fetchall()
    conn.close()
    return result

def get_video_by_bvid(bvid):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, brand_id FROM videos WHERE bvid = ?", (bvid,))
    result = cursor.fetchone()
    conn.close()
    return result

def get_stats_summary():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            b.name,
            b.mid,
            COUNT(DISTINCT v.id) as video_count,
            COUNT(DISTINCT vs.id) as stat_count,
            MAX(vs.stat_date) as last_stat_date
        FROM brands b
        LEFT JOIN videos v ON b.id = v.brand_id
        LEFT JOIN video_stats vs ON v.id = vs.video_id
        GROUP BY b.id
    """)

    result = cursor.fetchall()
    conn.close()
    return result

if __name__ == "__main__":
    init_database()
    print("数据库表结构创建完成")
