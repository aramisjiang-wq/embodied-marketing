#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
B站竞品数据采集系统 v2.0 - Python 3.9 兼容版
适用于 macOS 系统自带的 Python 3.9
"""

import asyncio
import json
import sys
import os
import sqlite3
import random
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

# 添加bilibili-api到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bilibili-api'))

# 延迟导入，避免初始化问题
def import_bilibili_api():
    from bilibili_api import user, video, select_client, request_settings
    
    # 配置浏览器指纹伪装
    select_client("curl_cffi")
    request_settings.set("impersonate", "chrome131")
    
    return user, video

# 配置日志系统
def setup_logging():
    log_dir = os.path.join(os.path.dirname(__file__), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(
                os.path.join(log_dir, 'collect.log'), 
                encoding='utf-8'
            )
        ]
    )
    return logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'bilibili_monitor.db')

# 智能频率控制配置
CONFIG = {
    "base_delay": 3.0,
    "random_delay_range": 3.0,
    "max_retries": 3,
    "page_delay": 1.5,
    "video_detail_delay": 1.0,
    "brand_delay": 2.0,
}


def get_connection():
    return sqlite3.connect(DB_PATH)


async def safe_request(func, *args, max_retries: int = None, **kwargs):
    """安全请求包装器：带指数退避重试和智能延迟"""
    max_retries = max_retries or CONFIG["max_retries"]
    
    for attempt in range(max_retries):
        try:
            result = await func(*args, **kwargs)
            
            # 成功后添加随机延迟
            delay = CONFIG["base_delay"] + random.uniform(0, CONFIG["random_delay_range"])
            await asyncio.sleep(delay)
            
            return result
            
        except Exception as e:
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt) * CONFIG["base_delay"] + random.uniform(0, 2)
                logger.warning(f"请求失败 (第{attempt+1}次重试): {str(e)[:100]}")
                logger.info(f"等待 {wait_time:.1f} 秒后重试...")
                await asyncio.sleep(wait_time)
            else:
                logger.error(f"请求最终失败: {str(e)[:200]}")
    
    return None


async def get_user_info(uid: int, user_module):
    """获取用户基本信息"""
    async def _fetch():
        u = user_module.User(uid=uid)
        return await u.get_user_info()
    
    return await safe_request(_fetch)


async def get_relation_info(uid: int, user_module):
    """获取用户关系信息"""
    async def _fetch():
        u = user_module.User(uid=uid)
        return await u.get_relation_info()
    
    return await safe_request(_fetch)


async def fetch_all_dynamics(uid: int, user_module):
    """获取用户所有动态"""
    all_items = []
    offset = ""
    max_pages = 10
    
    for page in range(max_pages):
        try:
            async def _fetch_page(off=""):
                u = user_module.User(uid=uid)
                if off:
                    return await u.get_dynamics_new(offset=off)
                else:
                    return await u.get_dynamics_new()
            
            dynamics = await safe_request(_fetch_page, offset)
            if not dynamics:
                break
                
            items = dynamics.get('items', [])
            if not items:
                break
            
            all_items.extend(items)
            
            if not dynamics.get('has_more'):
                break
            
            offset = dynamics.get('offset', '')
            logger.info(f"品牌 {uid}: 获取第{page+1}页动态 ({len(items)} 条)")
            
            await asyncio.sleep(CONFIG["page_delay"] + random.uniform(0, 1))
            
        except Exception as e:
            logger.error(f"品牌 {uid} 获取第{page+1}页动态异常: {e}")
            break
    
    return all_items


async def get_video_info(bvid: str, video_module):
    """获取视频详细信息"""
    async def _fetch():
        v = video_module.Video(bvid=bvid)
        return await v.get_info()
    
    return await safe_request(_fetch)


def extract_videos_from_dynamics(items: List[Dict]) -> List[Dict]:
    """从动态列表中提取视频信息"""
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


def get_all_brands() -> List[tuple]:
    """获取所有品牌列表"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, mid, name FROM brands")
    result = cursor.fetchall()
    conn.close()
    return result


def get_video_by_bvid(bvid: str) -> Optional[tuple]:
    """根据bvid查询视频记录"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM videos WHERE bvid = ?", (bvid,))
    result = cursor.fetchone()
    conn.close()
    return result


def insert_video(brand_id: int, bvid: str, title: str, pub_ts: str) -> int:
    """插入或更新视频记录"""
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


def insert_video_stats(video_id: int, stat_date: str, view: int, like: int, 
                       coin: int, favorite: int, reply: int, danmaku: int, share: int):
    """插入或更新视频统计数据"""
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


def insert_brand_stats(brand_id: int, stat_date: str, follower: int, following: int):
    """插入或更新品牌统计数据"""
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


async def process_brand(brand_id: int, mid: int, name: str, user_module, video_module) -> Dict[str, Any]:
    """处理单个品牌的数据采集"""
    result = {
        "brand_id": brand_id,
        "mid": mid,
        "name": name,
        "success": False,
        "follower": 0,
        "video_count": 0,
        "new_videos": 0,
        "errors": []
    }
    
    logger.info(f"\n{'='*60}")
    logger.info(f"开始处理品牌: {name} (MID: {mid})")
    logger.info(f"{'='*60}")

    try:
        # Step 1: 获取用户基本信息
        logger.info(f"[{name}] Step 1/5: 获取用户基本信息...")
        user_info = await get_user_info(mid, user_module)
        if user_info:
            logger.info(f"[{name}] 昵称: {user_info.get('name')}")
        else:
            result["errors"].append("获取用户信息失败")

        # Step 2: 获取关系信息
        logger.info(f"[{name}] Step 2/5: 获取关系信息...")
        relation_info = await get_relation_info(mid, user_module)
        follower = 0
        following = 0
        if relation_info:
            follower = relation_info.get('follower', 0)
            following = relation_info.get('following', 0)
            result["follower"] = follower
            logger.info(f"[{name}] 粉丝: {follower:,}, 关注: {following:,}")
            
            today = datetime.now().strftime('%Y-%m-%d')
            insert_brand_stats(brand_id, today, follower, following)
        else:
            result["errors"].append("获取关系信息失败")

        # Step 3: 获取动态列表
        logger.info(f"[{name}] Step 3/5: 获取动态列表...")
        all_items = await fetch_all_dynamics(mid, user_module)
        logger.info(f"[{name}] 总动态数: {len(all_items)}")

        # Step 4: 提取视频信息
        logger.info(f"[{name}] Step 4/5: 提取视频信息...")
        videos = extract_videos_from_dynamics(all_items)
        result["video_count"] = len(videos)
        logger.info(f"[{name}] 提取到视频数: {len(videos)}")

        new_video_count = 0
        for v in videos:
            video_id = insert_video(brand_id, v['bvid'], v['title'], v['pub_ts'])
            if video_id:
                new_video_count += 1
        
        result["new_videos"] = new_video_count

        # Step 5: 获取视频详情
        logger.info(f"[{name}] Step 5/5: 获取视频详情...")
        success_count = 0
        
        for i, v in enumerate(videos):
            video_title = v['title'][:30] if v['title'] else 'N/A'
            logger.info(f"[{name}] [{i+1}/{len(videos)}] {v['bvid']}: {video_title}...")

            video_info = await get_video_info(v['bvid'], video_module)
            if video_info:
                stat = video_info.get('stat', {})
                video_row = get_video_by_bvid(v['bvid'])
                
                if video_row:
                    pub_ts = v.get('pub_ts')
                    if pub_ts:
                        stat_date = datetime.fromtimestamp(int(pub_ts)).strftime('%Y-%m') + '-01'
                    else:
                        stat_date = datetime.now().strftime('%Y-%m-%d')
                    
                    insert_video_stats(
                        video_id=video_row[0],
                        stat_date=stat_date,
                        view=stat.get('view', 0),
                        like=stat.get('like', 0),
                        coin=stat.get('coin', 0),
                        favorite=stat.get('favorite', 0),
                        reply=stat.get('reply', 0),
                        danmaku=stat.get('danmaku', 0),
                        share=stat.get('share', 0)
                    )
                    success_count += 1
            
            await asyncio.sleep(CONFIG["video_detail_delay"] + random.uniform(0, 0.5))

        logger.info(f"[{name}] 视频详情获取完成: 成功 {success_count}")
        result["success"] = True

    except Exception as e:
        logger.error(f"[{name}] 处理异常: {e}", exc_info=True)
        result["errors"].append(str(e))
    
    finally:
        logger.info(f"[{'✅' if result['success'] else '❌'}] {name} 完成 - "
                   f"粉丝: {result['follower']:,}, 视频: {result['video_count']}")
    
    return result


async def main():
    """主函数"""
    global logger
    logger = setup_logging()
    
    # 导入bilibili-api模块
    try:
        user_module, video_module = import_bilibili_api()
        logger.info("✅ bilibili-api 库加载成功")
    except Exception as e:
        logger.error(f"❌ bilibili-api 库加载失败: {e}")
        logger.error("请确保已安装依赖: pip install bilibili-api-python curl_cffi")
        return
    
    start_time = datetime.now()
    
    logger.info("=" * 70)
    logger.info("B站竞品数据采集系统 v2.0 (Python 3.9 兼容版)")
    logger.info("=" * 70)
    logger.info(f"开始时间: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")

    brands = get_all_brands()
    total_brands = len(brands)
    logger.info(f"品牌总数: {total_brands}")

    if not brands:
        logger.warning("没有品牌数据")
        return

    stats = {
        "total": total_brands,
        "success": 0,
        "failed": 0,
        "total_videos": 0,
        "total_followers": 0,
        "errors": []
    }

    for idx, (brand_id, mid, name) in enumerate(brands, 1):
        logger.info(f"\n[{idx}/{total_brands}] 处理 #{brand_id}")
        
        result = await process_brand(brand_id, mid, name, user_module, video_module)
        
        if result["success"]:
            stats["success"] += 1
            stats["total_videos"] += result["video_count"]
            stats["total_followers"] += result["follower"]
        else:
            stats["failed"] += 1
            if result["errors"]:
                stats["errors"].append(f"{name}: {'; '.join(result['errors'])}")

        if idx < total_brands:
            brand_delay = CONFIG["brand_delay"] + random.uniform(0, 2)
            logger.info(f"等待 {brand_delay:.1f} 秒...")
            await asyncio.sleep(brand_delay)

    # 输出报告
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    logger.info("\n" + "=" * 70)
    logger.info("📊 采集完成!")
    logger.info("=" * 70)
    logger.info(f"⏱️  耗时: {duration:.1f}秒 ({duration/60:.1f}分钟)")
    logger.info(f"📈 成功率: {stats['success']}/{stats['total']}")
    logger.info(f"🎬 视频: {stats['total_videos']}")
    
    if stats["failed"] > 0:
        logger.warning(f"❌ 失败: {stats['failed']}个")


if __name__ == "__main__":
    try:
        # Python 3.9 兼容性处理
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            loop.run_until_complete(main())
        finally:
            loop.close()
            
    except KeyboardInterrupt:
        print("\n⚠️ 用户中断")
    except Exception as e:
        print(f"\n❌ 致命错误: {e}")
        import traceback
        traceback.print_exc()
