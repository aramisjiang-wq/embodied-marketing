import asyncio
import json
import sys
import os
import sqlite3
import random
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bilibili-api'))
from bilibili_api import user, video

try:
    from bilibili_api import Credential
except ImportError:
    Credential = None

try:
    from bilibili_api import select_client, request_settings
except ImportError:
    select_client = None
    request_settings = None
    try:
        from bilibili_api import settings as bili_settings
    except ImportError:
        bili_settings = None

# 配置浏览器指纹伪装（关键！）
if select_client and request_settings:
    try:
        select_client("curl_cffi")
        request_settings.set("impersonate", "chrome131")
    except Exception:
        pass
elif "bili_settings" in globals() and bili_settings:
    try:
        bili_settings.http_client = bili_settings.HTTPClient.HTTPX
    except Exception:
        pass

# 配置日志系统
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('logs/collect.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# 确保日志目录存在
os.makedirs('logs', exist_ok=True)

# 状态文件路径（用于前端显示采集进度）
STATUS_FILE = os.path.join(os.path.dirname(__file__), 'collect_status.json')

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'bilibili_monitor.db')

# 智能频率控制配置
CONFIG = {
    "base_delay": 3.0,           # 基础延迟（秒）
    "random_delay_range": 3.0,   # 随机延迟范围（秒）
    "max_retries": 3,            # 最大重试次数
    "page_delay": 1.5,           # 分页请求延迟（秒）
    "request_delay": 1.5,        # 普通分页请求延迟（秒）
    "video_detail_delay": 1.0,   # 视频详情请求延迟（秒）
    "brand_delay": 2.0,          # 品牌间延迟（秒）
}

BILIBILI_SESSDATA = os.environ.get("BILIBILI_SESSDATA", "")
BILIBILI_BILI_JCT = os.environ.get("BILIBILI_BILI_JCT", "")
BILIBILI_BUVID3 = os.environ.get("BILIBILI_BUVID3", "")

_credential = (
    Credential(
        sessdata=BILIBILI_SESSDATA,
        bili_jct=BILIBILI_BILI_JCT,
        buvid3=BILIBILI_BUVID3 or None,
    )
    if Credential and BILIBILI_SESSDATA and BILIBILI_BILI_JCT
    else None
)


def create_user(uid: str):
    """创建兼容不同 bilibili-api-python 版本的 User 对象。"""
    uid_int = int(uid)
    if _credential is not None:
        try:
            return user.User(uid=uid_int, credential=_credential)
        except TypeError:
            pass
    return user.User(uid=uid_int)


def create_video(bvid: str):
    """创建兼容不同 bilibili-api-python 版本的 Video 对象。"""
    if _credential is not None:
        try:
            return video.Video(bvid=bvid, credential=_credential)
        except TypeError:
            pass
    return video.Video(bvid=bvid)


def get_connection():
    return sqlite3.connect(DB_PATH)


async def safe_request(func, *args, max_retries: int = None, **kwargs):
    """
    安全请求包装器：带指数退避重试和智能延迟
    
    Args:
        func: 异步函数
        max_retries: 最大重试次数（默认使用配置值）
        
    Returns:
        函数返回值或None（如果所有重试都失败）
    """
    max_retries = max_retries or CONFIG["max_retries"]
    last_exception = None
    
    for attempt in range(max_retries):
        try:
            result = await func(*args, **kwargs)
            
            # 成功后添加随机延迟，避免被风控
            delay = CONFIG["base_delay"] + random.uniform(0, CONFIG["random_delay_range"])
            logger.debug(f"请求成功，等待 {delay:.1f} 秒...")
            await asyncio.sleep(delay)
            
            return result
            
        except Exception as e:
            last_exception = e
            if attempt < max_retries - 1:
                # 指数退避策略：等待时间 = 2^attempt * 基础延迟 + 随机扰动
                wait_time = (2 ** attempt) * CONFIG["base_delay"] + random.uniform(0, 2)
                logger.warning(f"请求失败 (第{attempt+1}次重试): {str(e)[:100]}")
                logger.info(f"等待 {wait_time:.1f} 秒后重试...")
                await asyncio.sleep(wait_time)
            else:
                logger.error(f"请求最终失败（已重试{max_retries}次）: {str(e)[:200]}")
    
    return None


async def get_user_info(uid: str) -> Optional[Dict]:
    """获取用户基本信息（容错增强版）"""
    try:
        async def _fetch():
            u = create_user(uid)
            result = await u.get_user_info()

            # 兼容多种返回类型
            if isinstance(result, int):
                logger.debug(f"user_info 返回 int: {result}, 可能是API变更")
                return None
            elif isinstance(result, dict):
                return result
            else:
                logger.warning(f"user_info 返回异常类型: {type(result)}")
                return None

        return await safe_request(_fetch)

    except Exception as e:
        logger.error(f"获取用户信息失败 (MID: {uid}): {e}")
        return None


async def get_relation_info(uid: str) -> Optional[Dict]:
    """获取用户关系信息（粉丝/关注数）（容错增强版）"""
    try:
        async def _fetch():
            u = create_user(uid)
            result = await u.get_relation_info()

            # 兼容多种返回类型
            if isinstance(result, dict):
                return result
            elif isinstance(result, int):
                logger.debug(f"relation_info 返回 int: {result}")
                return None
            else:
                logger.warning(f"relation_info 返回异常类型: {type(result)}")
                return None

        return await safe_request(_fetch)

    except Exception as e:
        logger.error(f"获取关系信息失败 (MID: {uid}): {e}")
        return None


async def fetch_all_dynamics(uid: str) -> List[Dict]:
    """获取用户所有动态（分页）- 增强版，支持更多页面"""
    all_items = []
    offset = ""
    max_pages = 20  # 增加到20页（约400条动态），确保获取所有视频

    for page in range(max_pages):
        try:
            async def _fetch_page(off=""):
                u = create_user(uid)
                if off:
                    return await u.get_dynamics_new(offset=off)
                else:
                    return await u.get_dynamics_new()

            dynamics = await safe_request(_fetch_page, offset)
            if not dynamics:
                logger.warning(f"品牌 {uid} 第{page+1}页动态获取失败或无数据")
                break

            items = dynamics.get('items', [])
            if not items:
                logger.info(f"品牌 {uid} 第{page+1}页无更多动态，停止分页")
                break

            all_items.extend(items)
            logger.info(f"品牌 {uid}: 获取第{page+1}页动态 ({len(items)} 条, 累计 {len(all_items)} 条)")

            if not dynamics.get('has_more'):
                logger.info(f"品牌 {uid}: 已获取全部动态 (共 {len(all_items)} 条)")
                break

            offset = dynamics.get('offset', '')

            # 分页间延迟（稍微增加以避免风控）
            await asyncio.sleep(CONFIG["page_delay"] + random.uniform(0.5, 1.5))

        except Exception as e:
            logger.error(f"品牌 {uid} 获取第{page+1}页动态异常: {e}")
            break

    logger.info(f"品牌 {uid}: 动态获取完成，共 {len(all_items)} 条")
    return all_items


async def fetch_videos_list(uid: str) -> List[Dict]:
    """获取用户视频列表（备用接口）- 使用 get_videos() 接口
    
    当 get_dynamics_new() 无法获取数据时使用此接口
    注意：此接口可能触发412错误，已内置重试机制
    """
    all_videos = []
    page = 1
    ps = 30  # 每页30个视频
    max_pages = 10  # 最多获取10页（约300个视频）

    try:
        u = create_user(uid)

        while page <= max_pages:
            try:
                async def _fetch_video_page(p=1, size=30):
                    result = await u.get_videos(pn=p, ps=size)
                    return result

                result = await safe_request(_fetch_video_page, page, ps)

                if not result:
                    logger.warning(f"品牌 {uid} 视频列表第{page}页获取失败")
                    break

                video_list = result.get('list', {}).get('vlist', [])
                page_info = result.get('page', {})

                if not video_list:
                    logger.info(f"品牌 {uid}: 视频列表第{page}页无更多数据")
                    break

                for v in video_list:
                    bvid = v.get('bvid')
                    title = v.get('title')
                    created = v.get('created')

                    if bvid:
                        all_videos.append({
                            'bvid': bvid,
                            'title': title,
                            'pub_ts': str(created) if created else None,
                            'source': 'video_list'  # 标记来源
                        })

                total_count = page_info.get('count', 0)
                current_count = len(all_videos)

                logger.info(f"品牌 {uid}: 获取视频列表第{page}页 ({len(video_list)} 个, 累计 {current_count}/{total_count})")

                if current_count >= total_count or len(video_list) < ps:
                    logger.info(f"品牌 {uid}: 已获取全部视频 (共 {current_count} 个)")
                    break

                page += 1

                await asyncio.sleep(CONFIG["request_delay"] + random.uniform(0.5, 1.5))

            except Exception as e:
                error_msg = str(e).lower()
                
                if '412' in error_msg or 'precondition' in error_msg:
                    logger.error(f"品牌 {uid} 视频列表第{page}页: 被412拦截，停止获取")
                    break
                else:
                    logger.warning(f"品牌 {uid} 视频列表第{page}页异常: {e}")
                    break

        logger.info(f"品牌 {uid}: 视频列表获取完成，共 {len(all_videos)} 个视频")

    except Exception as e:
        logger.error(f"品牌 {uid} 获取视频列表失败: {e}")

    return all_videos


async def get_video_info(bvid: str) -> Optional[Dict]:
    """获取视频详细信息"""
    async def _fetch():
        v = create_video(bvid)
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


async def process_brand(brand_id: int, mid: str, name: str, status: Dict = None) -> Dict[str, Any]:
    """
    处理单个品牌的数据采集

    Args:
        brand_id: 品牌ID
        mid: B站MID（字符串类型）
        name: 品牌名称
        status: 全局状态字典（用于实时更新进度）

    Returns:
        包含采集结果的字典
    """
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

    # 更新状态：当前品牌
    if status:
        status["current_brand"] = name
        status["current_step"] = f"开始处理 {name}..."
        update_status(status)

    logger.info(f"\n{'='*60}")
    logger.info(f"开始处理品牌: {name} (MID: {mid})")
    logger.info(f"{'='*60}")

    try:
        # Step 1: 获取用户基本信息
        if status:
            status["current_step"] = "获取用户基本信息"
            update_status(status)

        logger.info(f"[{name}] Step 1/5: 获取用户基本信息...")
        user_info = await get_user_info(mid)
        if user_info:
            level = user_info.get('level', {})
            level_str = f"LV{level.get('current_level', '?')}" if isinstance(level, dict) else f"LV{level}"
            logger.info(f"[{name}] 昵称: {user_info.get('name')}, 等级: {level_str}")
            
            # 记录日志到状态
            if status:
                status["logs"].append({
                    "time": datetime.now().isoformat(),
                    "level": "info",
                    "brand": name,
                    "message": f"获取用户信息成功 - {user_info.get('name')} ({level_str})"
                })
                update_status(status)
        else:
            result["errors"].append("获取用户信息失败")
            logger.warning(f"[{name}] ⚠️ 获取用户信息失败")
            
            if status:
                status["logs"].append({
                    "time": datetime.now().isoformat(),
                    "level": "warning",
                    "brand": name,
                    "message": "获取用户信息失败"
                })
                update_status(status)

        # Step 2: 获取关系信息（粉丝/关注）
        if status:
            status["current_step"] = "获取粉丝和关注数"
            update_status(status)

        logger.info(f"[{name}] Step 2/5: 获取关系信息...")
        relation_info = await get_relation_info(mid)
        follower = 0
        following = 0
        if relation_info:
            follower = relation_info.get('follower', 0)
            following = relation_info.get('following', 0)
            result["follower"] = follower
            logger.info(f"[{name}] 粉丝: {follower:,}, 关注: {following:,}")

            # 保存品牌统计
            today = datetime.now().strftime('%Y-%m-%d')
            insert_brand_stats(brand_id, today, follower, following)
            
            if status:
                status["logs"].append({
                    "time": datetime.now().isoformat(),
                    "level": "info",
                    "brand": name,
                    "message": f"粉丝: {follower:,}, 关注: {following:,}"
                })
                update_status(status)
        else:
            result["errors"].append("获取关系信息失败")
            logger.warning(f"[{name}] ⚠️ 获取关系信息失败")

        # Step 3: 获取动态列表（主接口）
        if status:
            status["current_step"] = "获取动态列表"
            update_status(status)

        logger.info(f"[{name}] Step 3/5: 获取动态列表...")
        all_items = await fetch_all_dynamics(mid)
        logger.info(f"[{name}] 总动态数: {len(all_items)}")

        # 🔥 关键修复：如果动态接口返回0，自动切换到视频列表接口
        videos_from_backup = []
        data_source = "dynamics_new"  # 标记数据来源

        if len(all_items) == 0:
            logger.warning(f"[{name}] ⚠️ 动态接口返回0条，尝试使用视频列表备用接口...")
            
            if status:
                status["logs"].append({
                    "time": datetime.now().isoformat(),
                    "level": "warning",
                    "brand": name,
                    "message": "动态接口无数据，切换到视频列表接口"
                })
                update_status(status)

            videos_from_backup = await fetch_videos_list(mid)
            
            if len(videos_from_backup) > 0:
                logger.info(f"✅ [{name}] 备用接口成功获取 {len(videos_from_backup)} 个视频")
                data_source = "video_list_backup"
                
                if status:
                    status["logs"].append({
                        "time": datetime.now().isoformat(),
                        "level": "info",
                        "brand": name,
                        "message": f"备用接口成功: {len(videos_from_backup)} 个视频"
                    })
                    update_status(status)
            else:
                logger.error(f"❌ [{name}] 备用接口也未能获取到数据")
                
                if status:
                    status["logs"].append({
                        "time": datetime.now().isoformat(),
                        "level": "error",
                        "brand": name,
                        "message": "主备接口均失败，该品牌可能无公开视频或API受限"
                    })
                    update_status(status)
        else:
            if status:
                status["logs"].append({
                    "time": datetime.now().isoformat(),
                    "level": "info",
                    "brand": name,
                    "message": f"获取到 {len(all_items)} 条动态 (来源: get_dynamics_new)"
                })
                update_status(status)

        # Step 4: 提取视频信息（支持双数据源）
        if status:
            status["current_step"] = "提取视频信息"
            update_status(status)

        logger.info(f"[{name}] Step 4/5: 提取视频信息...")

        # 根据数据来源选择提取方式
        if data_source == "video_list_backup":
            videos = videos_from_backup  # 备用接口已直接返回视频列表
        else:
            videos = extract_videos_from_dynamics(all_items)  # 主接口需要从动态中提取

        result["video_count"] = len(videos)
        logger.info(f"[{name}] 提取到视频数: {len(videos)} (数据源: {data_source})")

        new_video_count = 0
        for v in videos:
            video_id = insert_video(brand_id, v['bvid'], v['title'], v['pub_ts'])
            if video_id:
                new_video_count += 1

        result["new_videos"] = new_video_count
        logger.info(f"[{name}] 新增/更新视频记录: {new_video_count}")

        if status:
            status["logs"].append({
                "time": datetime.now().isoformat(),
                "level": "info",
                "brand": name,
                "message": f"提取到 {len(videos)} 个视频，新增/更新 {new_video_count} 条记录"
            })
            update_status(status)

        # Step 5: 获取视频详情（播放量等）
        if status:
            status["current_step"] = "获取视频详情（播放量等）"
            update_status(status)

        logger.info(f"[{name}] Step 5/5: 获取视频详情...")
        success_count = 0
        fail_count = 0

        for i, v in enumerate(videos):
            video_title = v['title'][:30] if v['title'] else 'N/A'
            logger.info(f"[{name}] [{i+1}/{len(videos)}] {v['bvid']}: {video_title}...")

            # 更新进度
            if status:
                progress = f"{i+1}/{len(videos)}"
                status["current_brand_progress"] = progress
                status["current_step"] = f"获取视频详情: {video_title}"
                update_status(status)

            video_info = await get_video_info(v['bvid'])
            if video_info:
                stat = video_info.get('stat', {})
                video_row = get_video_by_bvid(v['bvid'])

                if video_row:
                    # 使用视频发布月份作为统计日期
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
            else:
                fail_count += 1
                logger.warning(f"[{name}] ❌ 获取视频详情失败: {v['bvid']}")

            # 视频详情间延迟
            await asyncio.sleep(CONFIG["video_detail_delay"] + random.uniform(0, 0.5))

        logger.info(f"[{name}] 视频详情获取完成: 成功 {success_count}, 失败 {fail_count}")
        result["success"] = True

        # 记录完成日志
        if status:
            status["logs"].append({
                "time": datetime.now().isoformat(),
                "level": "info",
                "brand": name,
                "message": f"处理完成 - 视频: {result['video_count']}, 新增: {result['new_videos']}, 详情成功: {success_count}, 失败: {fail_count}"
            })
            update_status(status)

    except Exception as e:
        logger.error(f"[{name}] 处理过程中发生异常: {e}", exc_info=True)
        result["errors"].append(str(e))
        
        if status:
            status["logs"].append({
                "time": datetime.now().isoformat(),
                "level": "error",
                "brand": name,
                "message": f"处理异常: {str(e)[:200]}"
            })
            update_status(status)

    finally:
        logger.info(f"[{'✅' if result['success'] else '❌'}] {name} 处理完成 - "
                   f"粉丝: {result['follower']:,}, 视频: {result['video_count']}, 新增: {result['new_videos']}")

    return result


# 状态管理函数（用于前端显示采集进度）
def update_status(status: Dict):
    """更新采集状态到 JSON 文件"""
    try:
        with open(STATUS_FILE, 'w', encoding='utf-8') as f:
            json.dump(status, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"无法写入状态文件: {e}")

def init_status(total_brands: int):
    """初始化采集状态"""
    status = {
        "is_running": True,
        "started_at": datetime.now().isoformat(),
        "current_brand": None,
        "current_brand_progress": "0/0",
        "total_brands": total_brands,
        "completed_brands": 0,
        "current_step": "初始化",
        "message": "开始数据采集...",
        "logs": []
    }
    update_status(status)
    return status

def clear_status(stats: Dict = None):
    """清除采集状态（标记为已完成）"""
    status = {
        "is_running": False,
        "started_at": None,
        "current_brand": None,
        "current_brand_progress": "0/0",
        "total_brands": 0,
        "completed_brands": 0,
        "current_step": "空闲",
        "message": "系统就绪，等待下次采集 (每天零点自动运行)",
        "logs": [],
        "last_run_summary": {
            "total_videos": stats.get("total_videos", 0) if stats else 0,
            "success_count": stats.get("success", 0) if stats else 0,
            "total_brands": stats.get("total", 0) if stats else 0,
            "duration": round(stats.get("duration", 0), 1) if stats else 0,
            "completed_at": datetime.now().isoformat()
        } if stats else None
    }
    update_status(status)


async def main():
    """主函数：批量采集所有品牌数据"""
    start_time = datetime.now()

    logger.info("=" * 70)
    logger.info("B站竞品数据采集系统 v2.1 (增强版)")
    logger.info("=" * 70)
    logger.info(f"开始时间: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"配置参数:")
    logger.info(f"  - 基础延迟: {CONFIG['base_delay']}秒")
    logger.info(f"  - 随机延迟范围: 0-{CONFIG['random_delay_range']}秒")
    logger.info(f"  - 最大重试次数: {CONFIG['max_retries']}次")
    logger.info(f"  - 最大分页数: 20页 (约400条动态)")
    logger.info(f"  - 浏览器指纹: chrome131")
    logger.info("=" * 70)

    # 获取所有品牌
    brands = get_all_brands()
    total_brands = len(brands)
    logger.info(f"\n待处理品牌总数: {total_brands}")

    if not brands:
        logger.warning("没有品牌数据，请先在系统中添加品牌")
        return

    # 初始化状态管理
    status = init_status(total_brands)
    logger.info("✅ 状态文件已初始化，可通过 /api/collect-status 查看进度")

    # 统计结果
    stats = {
        "total": total_brands,
        "success": 0,
        "failed": 0,
        "total_videos": 0,
        "total_followers": 0,
        "errors": []
    }

    # 批量处理每个品牌
    for idx, (brand_id, mid, name) in enumerate(brands, 1):
        logger.info(f"\n[{idx}/{total_brands}] 开始处理品牌 #{brand_id}")

        # 更新全局进度
        status["completed_brands"] = idx - 1
        status["current_brand_progress"] = f"{idx}/{total_brands}"
        update_status(status)

        result = await process_brand(brand_id, mid, name, status)

        # 更新统计
        if result["success"]:
            stats["success"] += 1
            stats["total_videos"] += result["video_count"]
            stats["total_followers"] += result["follower"]
            
            # 更新完成数量
            status["completed_brands"] = idx
            update_status(status)
        else:
            stats["failed"] += 1
            if result["errors"]:
                error_msg = f"{name}: {'; '.join(result['errors'])}"
                stats["errors"].append(error_msg)
                
                # 记录失败日志
                status["logs"].append({
                    "time": datetime.now().isoformat(),
                    "level": "error",
                    "brand": name,
                    "message": f"处理失败: {'; '.join(result['errors'][:2])}"
                })
                update_status(status)

        # 品牌间延迟（避免连续请求同一IP）
        if idx < total_brands:
            brand_delay = CONFIG["brand_delay"] + random.uniform(0, 2)
            logger.info(f"\n等待 {brand_delay:.1f} 秒后处理下一个品牌...")
            await asyncio.sleep(brand_delay)

    # 输出最终报告
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    logger.info("\n" + "=" * 70)
    logger.info("📊 数据采集完成报告")
    logger.info("=" * 70)
    logger.info(f"⏱️  总耗时: {duration:.1f} 秒 ({duration/60:.1f} 分钟)")
    logger.info(f"📈 成功率: {stats['success']}/{stats['total']} ({stats['success']/stats['total']*100:.1f}%)")
    logger.info(f"🎬 视频总数: {stats['total_videos']}")
    logger.info(f"👥 粉丝总数: {stats['total_followers']: ,}")

    if stats["failed"] > 0:
        logger.warning(f"❌ 失败品牌数: {stats['failed']}")
        for error in stats["errors"]:
            logger.warning(f"  ⚠️  {error}")
    else:
        logger.info("✅ 所有品牌处理成功!")

    logger.info(f"结束时间: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 70)

    # 计算并添加duration到stats
    stats["duration"] = duration

    # 清除状态（保留上次采集摘要）
    clear_status(stats)
    logger.info("✅ 状态已清除，系统标记为就绪")

    # 保存运行日志到数据库（可选）
    save_run_log(stats, duration)


def save_run_log(stats: Dict, duration: float):
    """保存本次运行日志到数据库"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS run_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                duration REAL,
                total_brands INTEGER,
                success_count INTEGER,
                failed_count INTEGER,
                total_videos INTEGER,
                errors TEXT
            )
        """)
        
        cursor.execute("""
            INSERT INTO run_logs 
            (duration, total_brands, success_count, failed_count, total_videos, errors)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            duration,
            stats["total"],
            stats["success"],
            stats["failed"],
            stats["total_videos"],
            json.dumps(stats["errors"], ensure_ascii=False) if stats["errors"] else None
        ))
        
        conn.commit()
        conn.close()
        logger.info("运行日志已保存到数据库")
        
    except Exception as e:
        logger.error(f"保存运行日志失败: {e}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.warning("\n用户中断程序执行")
    except Exception as e:
        logger.critical(f"程序发生致命错误: {e}", exc_info=True)
        sys.exit(1)
