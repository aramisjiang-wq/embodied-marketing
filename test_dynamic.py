import asyncio
import json
from bilibili_api import user, select_client, request_settings

select_client('curl_cffi')
request_settings.set('impersonate', 'chrome131')

TEST_UID = 672328094

async def test():
    u = user.User(uid=TEST_UID)
    dynamics = await u.get_dynamics_new()

    videos = []
    for item in dynamics.get('items', []):
        t = item.get('type', 'UNKNOWN')
        if t == 'DYNAMIC_TYPE_AV':
            modules = item.get('modules', {})
            dynamic = modules.get('module_dynamic', {})
            author = modules.get('module_author', {})
            major = dynamic.get('major', {})

            if major.get('type') == 'MAJOR_TYPE_ARCHIVE':
                archive = major.get('archive', {})
                bvid = archive.get('bvid')
                title = archive.get('title')

                pub_ts = archive.get('pubdate')
                if pub_ts is None:
                    pub_ts = author.get('pub_ts')

                videos.append({
                    'bvid': bvid,
                    'title': title,
                    'pub_ts': pub_ts,
                    'author_pub_time': author.get('pub_ts'),
                    'all_author_keys': list(author.keys()) if author else []
                })

    print(f"提取到的视频数: {len(videos)}")
    for v in videos[:2]:
        print(json.dumps(v, ensure_ascii=False))

asyncio.run(test())
