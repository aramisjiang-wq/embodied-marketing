import sqlite3
from datetime import datetime

conn = sqlite3.connect('bilibili_monitor.db')
cursor = conn.cursor()

print('='*80)
print('品牌列表')
print('='*80)
cursor.execute('SELECT id, mid, name FROM brands')
for row in cursor.fetchall():
    print(f'ID: {row[0]}, MID: {row[1]}, 名称: {row[2]}')

print()
print('='*80)
print('视频统计汇总')
print('='*80)
cursor.execute('''
    SELECT b.name, COUNT(v.id) as video_count, SUM(vs.view) as total_views
    FROM brands b
    LEFT JOIN videos v ON b.id = v.brand_id
    LEFT JOIN video_stats vs ON v.id = vs.video_id
    GROUP BY b.id
    ORDER BY total_views DESC
''')
print(f"{'品牌':<15} {'视频数':<10} {'总播放':<15}")
print('-'*50)
for row in cursor.fetchall():
    name, count, views = row
    views_str = f"{views or 0:,}" if views else "0"
    print(f'{name:<15} {count:<10} {views_str:<15}')

print()
print('='*80)
print('宇树科技 - 详细视频数据 (按播放量排序)')
print('='*80)
cursor.execute('''
    SELECT v.bvid, v.title, v.pub_date, vs.view, vs.like, vs.favorite, vs.reply
    FROM videos v
    JOIN video_stats vs ON v.id = vs.video_id
    JOIN brands b ON v.brand_id = b.id
    WHERE b.name = "宇树科技"
    ORDER BY vs.view DESC
''')
print(f"{'bvid':<15} {'发布日期':<12} {'播放':<12} {'点赞':<10} {'收藏':<10} {'评论'}")
print('-'*80)
for row in cursor.fetchall():
    bvid, title, pub_date, view, like, favorite, reply = row
    pub_date = pub_date or 'N/A'
    print(f'{bvid:<15} {str(pub_date):<12} {view or 0:<12,} {like or 0:<10,} {favorite or 0:<10,} {reply or 0}')

print()
print('='*80)
print('品牌粉丝数据')
print('='*80)
cursor.execute('''
    SELECT b.name, bs.stat_date, bs.follower, bs.following
    FROM brand_stats bs
    JOIN brands b ON bs.brand_id = b.id
    ORDER BY b.name
''')
print(f"{'品牌':<15} {'日期':<12} {'粉丝数':<15} {'关注数'}")
print('-'*50)
for row in cursor.fetchall():
    name, stat_date, follower, following = row
    print(f'{name:<15} {stat_date:<12} {follower or 0:<15,} {following or 0}')

conn.close()
