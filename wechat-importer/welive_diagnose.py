# -*- coding: utf-8 -*-
"""
WeLive 微信聊天记录同步工具 - 完整版
自动诊断 + 一键导入到 CRM
"""
import subprocess
import json
import sys
import os
import time
from datetime import datetime

# ============ 配置 ============

# WeLive 程序目录
WELIVE_DIR = r"D:\小象智能AI\CRM\welive-windows-x64"

# CRM 地址
CRM_BASE_URL = "https://58f4e50.r8.cpolar.top"
CRM_API_KEY = "wechat-monitor-2026-secret-key"

# 每个联系人最多读取消息数
MAX_MESSAGES = 5000

# ==============================

WELIVE_EXE = os.path.join(WELIVE_DIR, "welive.exe")


def run_welive(*args):
    """运行 welive 命令"""
    cmd = [WELIVE_EXE] + list(args)
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True,
            encoding='utf-8', errors='replace',
            cwd=WELIVE_DIR, timeout=120
        )
        output = result.stdout.strip()
        # 尝试解析 JSON
        for parser in [
            lambda o: json.loads(o),
            lambda o: json.loads(o[o.find('{'):o.rfind('}')+1]) if '{' in o else None,
            lambda o: json.loads(o[o.find('['):o.rfind(']')+1]) if '[' in o else None,
        ]:
            try:
                return parser(output)
            except:
                continue
        return {"_raw": output[:500]}
    except Exception as e:
        return {"_error": str(e)}


def print_step(n, title):
    print()
    print("=" * 60)
    print(f"  步骤 {n}/5: {title}")
    print("=" * 60)
    print()


def main():
    print("=" * 60)
    print("  小象智能 CRM - WeLive 一键同步")
    print("=" * 60)

    # 1. 检查环境
    print_step(1, "检查环境")
    if not os.path.exists(WELIVE_EXE):
        print(f"❌ 找不到 WeLive: {WELIVE_EXE}")
        print("   请修改脚本中的 WELIVE_DIR")
        input("\n按回车退出...")
        return
    print(f"✅ WeLive: {WELIVE_EXE}")

    try:
        import requests
        print("✅ requests 库已安装")
    except ImportError:
        print("⚠  正在安装 requests...")
        subprocess.run([sys.executable, "-m", "pip", "install", "requests"], capture_output=True)
        import requests
        print("✅ requests 安装完成")

    # 2. 获取会话列表
    print_step(2, "获取会话列表")
    sessions = run_welive("sessions")
    if isinstance(sessions, list):
        print(f"✅ 找到 {len(sessions)} 个会话")
    else:
        print(f"⚠  会话数据格式异常: {type(sessions)}")
        sessions = []

    # 3. 诊断消息读取问题
    print_step(3, "诊断消息读取")
    
    # 找一个有消息的会话
    test_session = None
    for s in sessions:
        if isinstance(s, dict):
            username = s.get('username', '')
            if '@chatroom' not in username and 'gh_' not in username and username != 'filehelper':
                test_session = username
                break
    
    if test_session:
        print(f"测试会话: {test_session}")
        print()
        
        # 试试不同的命令
        tests = [
            ("messages", ["messages", "--session-id", test_session, "--limit", "3"]),
            ("message-count", ["message-count", "--session-id", test_session]),
            ("message-tables", ["message-tables", "--session-id", test_session]),
            ("session-pack", ["session-pack", "--session-id", test_session, "--limit", "3"]),
            ("message-dates", ["message-dates", "--session-id", test_session]),
        ]
        
        for name, args in tests:
            result = run_welive(*args)
            if isinstance(result, dict) and result.get("_error"):
                continue
            print(f"  {name}: {json.dumps(result, ensure_ascii=False)[:200]}")
        
        # 也试试 export
        print()
        print("  尝试 export-session...")
        out_file = os.path.join(WELIVE_DIR, "_test_export.json")
        result = run_welive("export-session", "--session-id", test_session,
                           "--out", out_file, "--limit", "5", "--lite")
        if os.path.exists(out_file):
            with open(out_file, 'r', encoding='utf-8') as f:
                content = f.read(500)
            print(f"  导出文件内容预览: {content[:300]}")
            os.unlink(out_file)
        else:
            print(f"  导出文件不存在，返回: {str(result)[:200]}")
        
        # 直接 exec SQL 看看表结构
        print()
        print("  尝试直接查询数据库...")
        dbs = run_welive("message-dbs")
        print(f"  message-dbs: {json.dumps(dbs, ensure_ascii=False)[:200]}")
    else:
        print("❌ 没有找到测试会话")

    # 4. 读取联系人
    print_step(4, "获取联系人")
    contacts = run_welive("contacts")
    if isinstance(contacts, list):
        print(f"✅ 找到 {len(contacts)} 个联系人")
    else:
        print(f"⚠  联系人数据格式: {type(contacts)}")
        contacts = []

    # 5. 尝试导出并上传
    print_step(5, "导出并同步到 CRM")
    
    # 先确认用哪种方式读取消息
    # ... 这里等诊断完再实现
    
    print()
    print("诊断完成。请把上面的输出截图发给我，我来调整同步方式。")
    input("\n按回车退出...")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n已取消")
    except Exception as e:
        print(f"\n出错: {e}")
        import traceback
        traceback.print_exc()
        input("\n按回车退出...")
