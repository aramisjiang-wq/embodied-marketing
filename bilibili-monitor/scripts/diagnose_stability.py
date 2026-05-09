#!/usr/bin/env python3
"""
B站数据采集稳定性诊断工具
用途：分析失败品牌的根本原因，验证API可用性
"""

import asyncio
import json
import sys
import os
from datetime import datetime
from typing import Optional, Dict, List

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bilibili-api'))
from bilibili_api import user, video, select_client, request_settings

# 配置浏览器指纹
select_client("curl_cffi")
request_settings.set("impersonate", "chrome131")

# 失败品牌清单（从日志中提取）
FAILED_BRANDS = [
    {"id": 1, "mid": "521974986", "name": "宇树科技"},
    {"id": 10, "mid": "3546595559737798", "name": "银河通用机器人"},
    {"id": 11, "mid": "3546728498202679", "name": "众擎机器人"},
    {"id": 14, "mid": "519804427", "name": "傅利叶智能"},
    {"id": 18, "mid": "3546561487309464", "name": "星动纪元"},
]

# 成功品牌（作为对照）
SUCCESS_BRANDS = [
    {"id": 4, "mid": "3494380742642452", "name": "智元机器人"},
    {"id": 12, "mid": "3546665977907667", "name": "加速进化机器人"},
]


async def test_user_info(uid: str) -> Dict:
    """测试1：获取用户基本信息"""
    try:
        u = user.User(uid=uid)
        info = await u.get_user_info()
        
        if isinstance(info, dict):
            return {
                "status": "success",
                "data": {
                    "name": info.get('name'),
                    "level": info.get('level', {}).get('current_level', '?'),
                    "sex": info.get('sex'),
                    "sign": info.get('sign', '')[:50]
                }
            }
        else:
            return {
                "status": "error",
                "reason": f"返回类型异常: {type(info)}",
                "raw_value": str(info)[:100]
            }
            
    except Exception as e:
        return {
            "status": "error",
            "reason": str(e)[:200],
            "type": type(e).__name__
        }


async def test_dynamics_new(uid: str) -> Dict:
    """测试2：使用 get_dynamics_new() 获取动态"""
    try:
        u = user.User(uid=uid)
        result = await u.get_dynamics_new(offset="")
        
        if isinstance(result, dict):
            items = result.get('items', [])
            has_more = result.get('has_more', False)
            
            return {
                "status": "success",
                "data": {
                    "total_items": len(items),
                    "has_more": has_more,
                    "offset": result.get('offset', '')[:50] if result.get('offset') else None,
                    "sample_types": list(set(item.get('type') for item in items[:5]))
                }
            }
        else:
            return {
                "status": "error",
                "reason": f"返回类型异常: {type(result)}",
                "raw_value": str(result)[:100]
            }
            
    except Exception as e:
        return {
            "status": "error",
            "reason": str(e)[:200],
            "type": type(e).__name__
        }


async def test_videos_list(uid: str) -> Dict:
    """测试3：尝试使用 get_videos() (备用接口)"""
    try:
        u = user.User(uid=uid)
        result = await u.get_videos(pn=1, ps=10)
        
        if isinstance(result, dict):
            videos = result.get('list', {}).get('vlist', [])
            return {
                "status": "success",
                "data": {
                    "total_videos": result.get('page', {}).get('count', 0),
                    "returned_count": len(videos),
                    "sample_titles": [v.get('title', '')[:30] for v in videos[:3]]
                }
            }
        else:
            return {
                "status": "error",
                "reason": f"返回类型异常: {type(result)}"
            }
            
    except Exception as e:
        error_msg = str(e)[:200]
        # 特别检测412错误
        if "412" in error_msg or "precondition" in error_msg.lower():
            return {
                "status": "blocked",
                "reason": "412 Precondition Failed - 被反爬机制拦截",
                "suggestion": "需要使用其他接口或增加伪装"
            }
        return {
            "status": "error",
            "reason": error_msg,
            "type": type(e).__name__
        }


async def diagnose_brand(brand: Dict) -> Dict:
    """对单个品牌进行全面诊断"""
    print(f"\n{'='*60}")
    print(f"🔍 诊断品牌: {brand['name']} (MID: {brand['mid']})")
    print(f"{'='*60}")
    
    diagnosis = {
        "brand_id": brand["id"],
        "brand_name": brand["name"],
        "mid": brand["mid"],
        "timestamp": datetime.now().isoformat(),
        "tests": {}
    }
    
    # 测试1: 用户信息
    print("\n📋 测试1/3: 获取用户基本信息...")
    result1 = await test_user_info(brand['mid'])
    diagnosis["tests"]["user_info"] = result1
    
    if result1["status"] == "success":
        info = result1["data"]
        print(f"  ✅ 成功 - 昵称: {info['name']}, 等级: LV{info['level']}")
    else:
        print(f"  ❌ 失败 - {result1.get('reason', '未知错误')}")
    
    await asyncio.sleep(2)  # 避免请求过快
    
    # 测试2: 动态接口
    print("\n📋 测试2/3: 使用 get_dynamics_new() 接口...")
    result2 = await test_dynamics_new(brand['mid'])
    diagnosis["tests"]["dynamics_new"] = result2
    
    if result2["status"] == "success":
        data = result2["data"]
        print(f"  ✅ 成功 - 获取 {data['total_items']} 条动态, has_more: {data['has_more']}")
        if data['total_items'] == 0:
            print(f"  ⚠️  警告: 返回空数据（可能原因：账号隐私设置/API限制）")
    else:
        print(f"  ❌ 失败 - {result2.get('reason', '未知错误')}")
    
    await asyncio.sleep(2)
    
    # 测试3: 视频列表接口（备用）
    print("\n📋 测试3/3: 尝试 get_videos() 备用接口...")
    result3 = await test_videos_list(brand['mid'])
    diagnosis["tests"]["videos_list"] = result3
    
    if result3["status"] == "success":
        data = result3["data"]
        print(f"  ✅ 成功 - 总视频数: {data['total_videos']}, 返回: {data['returned_count']} 条")
        if data['sample_titles']:
            print(f"  📹 示例: {data['sample_titles'][0]}")
    elif result3["status"] == "blocked":
        print(f"  🚫 被拦截 - {result3['reason']}")
    else:
        print(f"  ❌ 失败 - {result3.get('reason', '未知错误')}")
    
    # 综合诊断结论
    print("\n📊 诊断结论:")
    dynamics_ok = result2["status"] == "success" and result2["data"]["total_items"] > 0
    videos_ok = result3["status"] == "success" and result3["data"].get("total_videos", 0) > 0
    
    if dynamics_ok or videos_ok:
        diagnosis["conclusion"] = "partial_success"
        print("  ✅ 至少有一个接口可用，建议在采集中使用多源策略")
    elif result2["status"] == "success" and result2["data"]["total_items"] == 0:
        diagnosis["conclusion"] = "empty_data"
        print("  ⚠️  接口正常但返回空数据，可能是账号设置或API限制")
        print("  💡 建议: 手动访问该账号B站空间确认是否真的无动态")
    else:
        diagnosis["conclusion"] = "failed"
        print("  ❌ 所有接口均失败，该品牌可能无法通过API采集")
    
    return diagnosis


async def main():
    """主函数：运行所有诊断"""
    print("\n" + "="*70)
    print("🔬 B站数据采集稳定性诊断工具")
    print(f"⏰ 运行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)
    
    all_results = []
    
    # 诊断失败品牌
    print("\n\n🔴 第一部分：诊断失败品牌")
    for brand in FAILED_BRANDS:
        result = await diagnose_brand(brand)
        all_results.append(result)
        await asyncio.sleep(3)  # 品牌间延迟
    
    # 对照：诊断成功品牌
    print("\n\n🟢 第二部分：对照测试成功品牌")
    for brand in SUCCESS_BRANDS:
        result = await diagnose_brand(brand)
        all_results.append(result)
        await asyncio.sleep(3)
    
    # 输出汇总报告
    print("\n\n" + "="*70)
    print("📊 诊断汇总报告")
    print("="*70)
    
    failed_count = sum(1 for r in all_results if r.get("conclusion") == "failed")
    empty_count = sum(1 for r in all_results if r.get("conclusion") == "empty_data")
    success_count = sum(1 for r in all_results if r.get("conclusion") == "partial_success")
    
    print(f"\n总诊断品牌数: {len(all_results)}")
    print(f"✅ 可用（至少1个接口）: {success_count}")
    print(f"⚠️  空数据（接口正常但无内容）: {empty_count}")
    print(f"❌ 完全失败: {failed_count}")
    
    # 保存完整结果到JSON
    output_file = os.path.join(os.path.dirname(__file__), 'logs', f'diagnosis_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            "run_time": datetime.now().isoformat(),
            "summary": {
                "total": len(all_results),
                "partial_success": success_count,
                "empty_data": empty_count,
                "failed": failed_count
            },
            "details": all_results
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n💾 完整诊断结果已保存到: {output_file}")
    print("\n" + "="*70)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断诊断")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ 诊断过程发生致命错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
