import asyncio
import json
import time
from datetime import datetime
from bilibili_api import user, video, select_client, request_settings
from database import (
    init_database, insert_brand, insert_video, insert_video_stats,
    insert_brand_stats, get_all_brands, get_video_by_bvid, get_stats_summary
)

select_client("curl_cffi")
request_settings.set("impersonate", "chrome131")

BRANDS_DATA = [
    ("1223743334", "银河通用机器人"),
    ("349318020", "乐聚机器人"),
    ("521974986", "宇树科技"),
    ("175659048", "智元机器人"),
    ("206751234", "众巍机器人"),
    ("1894853857", "它石智航"),
    ("198765432", "松延动力"),
    ("1172054289", "优必选"),
    ("291083777", "越疆科技"),
]

async def get_user_info(uid):
    u = user.User(uid=int(uid))
    try:
        return await u.get_user_info()
    except Exception as e:
        print(f"  获取用户信息失败: {e}")
        return None

async def get_relation_info(uid):
    u = user.User(uid=int(uid))
    try:
        return await u.get_relation_info()
    except Exception as e:
        print(f"  获取关系信息失败: {e}")
        return None

async def get_dynamics(uid):
    u = user.User(uid=int(uid))
    try:
        return await u.get_dynamics_new()
    except Exception as e:
        print(f"  获取动态失败: {e}")
        return None

async def get_video_info(bvid):
    v = video.Video(bvid=bvid)
    try:
        return await v.get_info()
    except Exception as e:
        print(f"  获取视频详情失败 {bvid}: {e}")
        return None

async def fetch_all_dynamics(uid):
    all_items = []
    offset = ""
    max_pages = 10

    for page in range(max_pages):
        try:
            u = user.User(uid=int(uid))
            if offset:
                dynamics = await u.get_dynamics_new(offset=offset)
            else:
                dynamics = await u.get_dynamics_new()

            items = dynamics.get('items', [])
            if not items:
                break

            all_items.extend(items)

            if not dynamics.get('has_more'):
                break

            offset = dynamics.get('offset', '')
            print(f"  第{page+1}页: 获取{len(items)}条动态, offset={offset[:20]}...")
            await asyncio.sleep(0.5)
        except Exception as e:
            print(f"  获取动态页失败: {e}")
            break

    return all_items

def extract_videos_from_dynamics(items):
    videos = []
    for item in items:
        if item.get('type') == 'DYNAMIC_TYPE_AV':
            modules = item.get('modules', {})
            author = modules.get('module_author', {})
            dynamic = modules.get('module_dynamic', {})
            major = dynamic.get('major', {})

            if major.get('type') == 'MAJOR_TYPE_ARCHIVE':
                archive = major.get('archive', {})
                bvid = archive.get('bvid')
                title = archive.get('title')
                pub_ts = author.get('pub_ts')

                if bvid:
                    videos.append({
                        'bvid': bvid,
                        'title': title,
                        'pub_ts': pub_ts
                    })
    return videos

async def process_brand(mid, name):
    print(f"\n{'='*60}")
    print(f"处理品牌: {name} (MID: {mid})")
    print('='*60)

    brand_id = insert_brand(mid, name)
    print(f"品牌ID: {brand_id}")

    print("1. 获取用户信息...")
    user_info = await get_user_info(mid)
    if user_info:
        print(f"   昵称: {user_info.get('name')}")
        print(f"   粉丝: {user_info.get('fans', 'N/A')}")

    print("2. 获取关系信息(粉丝/关注)...")
    relation_info = await get_relation_info(mid)
    if relation_info:
        follower = relation_info.get('follower', 0)
        following = relation_info.get('following', 0)
        print(f"   粉丝: {follower}")
        print(f"   关注: {following}")

        today = datetime.now().strftime('%Y-%m-%d')
        insert_brand_stats(brand_id, today, follower, following)

    print("3. 获取动态列表(可能需要多页)...")
    all_items = await fetch_all_dynamics(mid)
    print(f"   总动态数: {len(all_items)}")

    print("4. 提取视频信息...")
    videos = extract_videos_from_dynamics(all_items)
    print(f"   提取到视频数: {len(videos)}")

    new_video_count = 0
    for v in videos:
        video_id = insert_video(brand_id, v['bvid'], v['title'], v['pub_ts'])
        if video_id:
            new_video_count += 1

    print(f"   新增视频记录: {new_video_count}")

    print("5. 获取视频详情(播放量等)...")
    today = datetime.now().strftime('%Y-%m-%d')
    for i, v in enumerate(videos):
        print(f"   [{i+1}/{len(videos)}] {v['bvid']}: {v['title'][:30]}...")

        video_info = await get_video_info(v['bvid'])
        if video_info:
            stat = video_info.get('stat', {})
            insert_video_stats(
                video_id=get_video_by_bvid(v['bvid'])[0],
                stat_date=today,
                view=stat.get('view', 0),
                like=stat.get('like', 0),
                coin=stat.get('coin', 0),
                favorite=stat.get('favorite', 0),
                reply=stat.get('reply', 0),
                danmaku=stat.get('danmaku', 0),
                share=stat.get('share', 0)
            )
            print(f"       播放: {stat.get('view', 0)}, 点赞: {stat.get('like', 0)}, "
                  f"收藏: {stat.get('favorite', 0)}, 评论: {stat.get('reply', 0)}")

        await asyncio.sleep(0.3)

    print(f"\n✅ {name} 处理完成")

async def main():
    print("="*60)
    print("B站竞品数据采集")
    print("="*60)
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"品牌数: {len(BRANDS_DATA)}")

    init_database()

    for mid, name in BRANDS_DATA:
        await process_brand(mid, name)
        await asyncio.sleep(2)

    print("\n" + "="*60)
    print("数据采集完成!")
    print("="*60)

    print("\n数据汇总:")
    summary = get_stats_summary()
    print(f"{'品牌':<15} {'MID':<12} {'视频数':<8} {'最新数据日期':<15}")
    print("-" * 60)
    for row in summary:
        name, mid, video_count, stat_count, last_date = row
        print(f"{name:<15} {mid:<12} {video_count:<8} {last_date or 'N/A':<15}")

if __name__ == "__main__":
    asyncio.run(main())
