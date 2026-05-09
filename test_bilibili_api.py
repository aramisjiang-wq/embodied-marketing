import asyncio
import json
import time
from bilibili_api import user, video, search, Credential, select_client, request_settings
from bilibili_api.exceptions import ResponseCodeException

# 启用 curl_cffi 伪装浏览器，解决412风控问题
select_client("curl_cffi")
request_settings.set("impersonate", "chrome131")

print("✅ 已启用 curl_cffi 浏览器伪装模式")
print("="*60)

TEST_UID = 672328094


async def test_user_info():
    print("\n" + "="*60)
    print("📊 测试1: 获取用户基本信息")
    print("="*60)

    u = user.User(uid=TEST_UID)
    try:
        info = await u.get_user_info()
        print(f"✅ 成功获取用户信息")
        print(f"   昵称: {info.get('name', 'N/A')}")
        print(f"   性别: {info.get('sex', 'N/A')}")
        print(f"   粉丝数: {info.get('fans', 'N/A')}")
        print(f"   关注数: {info.get('attention', 'N/A')}")
        print(f"   签名: {info.get('sign', 'N/A')[:50]}...")
        return info
    except Exception as e:
        print(f"❌ 失败: {e}")
        return None


async def test_relation_info():
    print("\n" + "="*60)
    print("📊 测试2: 获取用户关系数据(粉丝/关注)")
    print("="*60)

    u = user.User(uid=TEST_UID)
    try:
        rel = await u.get_relation_info()
        print(f"✅ 成功获取关系信息")
        print(f"   粉丝数: {rel.get('follower', 'N/A')}")
        print(f"   关注数: {rel.get('following', 'N/A')}")
        print(f"   悄悄关注: {rel.get('whisper', 'N/A')}")
        print(f"   黑名单: {rel.get('black', 'N/A')}")
        return rel
    except Exception as e:
        print(f"❌ 失败: {e}")
        return None


async def test_user_videos():
    print("\n" + "="*60)
    print("📊 测试3: 获取用户视频列表")
    print("="*60)

    u = user.User(uid=TEST_UID)
    try:
        videos = await u.get_videos(pn=1, ps=5)
        print(f"✅ 成功获取视频列表")

        if videos.get('list') is not None:
            vlist = videos['list']
            print(f"   视频总数: {videos.get('count', videos.get('vlist', [{}]).__len__() if isinstance(videos.get('vlist'), list) else 'N/A')}")
            print(f"   本页视频数: {len(vlist)}")

            for i, v in enumerate(vlist[:3]):
                print(f"\n   视频{i+1}:")
                print(f"     标题: {v.get('title', 'N/A')}")
                print(f"     bvid: {v.get('bvid', 'N/A')}")
                print(f"     播放: {v.get('play', 'N/A')}")
                print(f"     弹幕: {v.get('video_semantic', 'N/A')}")
                print(f"     点赞: {v.get('like', 'N/A')}")
                print(f"     收藏: {v.get('favorite', 'N/A')}")
                print(f"     投币: {v.get('coin', 'N/A')}")
                print(f"     发布时间: {v.get('pubdate', 'N/A')}")
        return videos
    except Exception as e:
        print(f"❌ 失败: {e}")
        return None


async def test_video_detail():
    print("\n" + "="*60)
    print("📊 测试4: 获取视频详细信息")
    print("="*60)

    v = video.Video(bvid="BV1uv411q7Mv")
    try:
        info = await v.get_info()
        print(f"✅ 成功获取视频详情")
        print(f"   标题: {info.get('title', 'N/A')}")
        print(f"   描述: {info.get('desc', 'N/A')[:100]}...")
        print(f"   播放数: {info.get('stat', {}).get('view', 'N/A')}")
        print(f"   点赞数: {info.get('stat', {}).get('like', 'N/A')}")
        print(f"   硬币数: {info.get('stat', {}).get('coin', 'N/A')}")
        print(f"   收藏数: {info.get('stat', {}).get('favorite', 'N/A')}")
        print(f"   分享数: {info.get('stat', {}).get('share', 'N/A')}")
        print(f"   弹幕数: {info.get('stat', {}).get('danmaku', 'N/A')}")
        print(f"   评论数: {info.get('stat', {}).get('reply', 'N/A')}")
        print(f"   时长: {info.get('duration', 'N/A')}秒")
        print(f"   分区: {info.get('tname', 'N/A')}")
        print(f"   作者: {info.get('owner', {}).get('name', 'N/A')}")
        return info
    except Exception as e:
        print(f"❌ 失败: {e}")
        return None


async def test_overview_stat():
    print("\n" + "="*60)
    print("📊 测试5: 获取UP主数据总览")
    print("="*60)

    u = user.User(uid=TEST_UID)
    try:
        stat = await u.get_overview_stat()
        print(f"✅ 成功获取数据总览")
        print(f"   数据: {json.dumps(stat, ensure_ascii=False, indent=4)}")
        return stat
    except Exception as e:
        print(f"❌ 失败: {e}")
        return None


async def test_dynamics():
    print("\n" + "="*60)
    print("📊 测试6: 获取用户动态")
    print("="*60)

    u = user.User(uid=TEST_UID)
    try:
        dynamics = await u.get_dynamics_new()
        print(f"✅ 成功获取动态")
        print(f"   动态数: {len(dynamics.get('items', []))}")

        for i, item in enumerate(dynamics.get('items', [])[:2]):
            print(f"\n   动态{i+1}:")
            print(f"     类型: {item.get('type', 'N/A')}")
            print(f"     ID: {item.get('id_str', 'N/A')}")

        return dynamics
    except Exception as e:
        print(f"❌ 失败: {e}")
        return None


async def test_search():
    print("\n" + "="*60)
    print("📊 测试7: 搜索功能")
    print("="*60)

    try:
        result = await search.search(keyword="Python", search_type=search.SearchObjectType.VIDEO)
        print(f"✅ 成功搜索")
        print(f"   结果数: {result.get('numResults', 'N/A')}")

        if result.get('result'):
            for i, item in enumerate(result['result'][:2]):
                print(f"\n   结果{i+1}:")
                print(f"     标题: {item.get('title', 'N/A')}")
                print(f"     作者: {item.get('author', 'N/A')}")
                print(f"     播放: {item.get('play', 'N/A')}")

        return result
    except Exception as e:
        print(f"❌ 失败: {e}")
        return None


async def test_error_handling():
    print("\n" + "="*60)
    print("📊 测试8: 错误处理机制")
    print("="*60)

    print("   测试不存在的用户UID...")
    u = user.User(uid=999999999999)
    try:
        info = await u.get_user_info()
        print(f"   返回数据: {info}")
    except ResponseCodeException as e:
        print(f"   ✅ 正确捕获异常: code={e.code}, msg={e.msg}")
    except Exception as e:
        print(f"   ⚠️ 其他异常: {type(e).__name__}: {e}")


async def test_concurrent_requests():
    print("\n" + "="*60)
    print("📊 测试9: 并发请求性能")
    print("="*60)

    u = user.User(uid=TEST_UID)
    start = time.time()

    tasks = [
        u.get_user_info(),
        u.get_relation_info(),
        u.get_overview_stat(),
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)
    elapsed = time.time() - start

    success_count = sum(1 for r in results if not isinstance(r, Exception))
    print(f"   ✅ 并发请求完成")
    print(f"   成功: {success_count}/{len(tasks)}")
    print(f"   耗时: {elapsed:.2f}秒")

    return results


async def main():
    print("\n" + "="*60)
    print("🚀 B站数据获取能力验证测试")
    print("="*60)
    print(f"测试目标UID: {TEST_UID} (一个活跃UP主)")

    results = {}

    results['user_info'] = await test_user_info()
    await asyncio.sleep(1)

    results['relation'] = await test_relation_info()
    await asyncio.sleep(1)

    results['videos'] = await test_user_videos()
    await asyncio.sleep(1)

    results['video_detail'] = await test_video_detail()
    await asyncio.sleep(1)

    results['overview'] = await test_overview_stat()
    await asyncio.sleep(1)

    results['dynamics'] = await test_dynamics()
    await asyncio.sleep(1)

    results['search'] = await test_search()
    await asyncio.sleep(1)

    await test_error_handling()

    await test_concurrent_requests()

    print("\n" + "="*60)
    print("📋 测试总结")
    print("="*60)

    success = sum(1 for k, v in results.items() if v is not None)
    print(f"成功测试: {success}/{len(results)}")

    print("\n数据结构完整性:")
    for name, data in results.items():
        if data:
            print(f"  ✅ {name}: {len(json.dumps(data))} bytes")

    print("\n推荐用于监控的字段:")
    print("  - 粉丝数: relation.follower")
    print("  - 关注数: relation.following")
    print("  - 视频播放数: video.stat.view")
    print("  - 视频点赞数: video.stat.like")
    print("  - 视频收藏数: video.stat.favorite")
    print("  - 动态更新: dynamics.items")

    print("\n" + "="*60)


if __name__ == "__main__":
    asyncio.run(main())
