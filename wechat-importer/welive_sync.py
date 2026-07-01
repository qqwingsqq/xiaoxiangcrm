# -*- coding: utf-8 -*-
"""
WeLive 微信聊天记录一键同步到 CRM
自动诊断 + 自动同步，一步到位
"""
import subprocess
import json
import sys
import os
import time
from datetime import datetime

# ============ 配置 ============

# WeLive 程序目录（如果不对，请修改这里）
WELIVE_DIR = r"D:\小象智能AI\CRM\welive-windows-x64"

# CRM 配置
CRM_BASE_URL = "https://58f4e50.r8.cpolar.top"
CRM_API_KEY = "wechat-monitor-2026-secret-key"

# 每个联系人最多读取消息数
MAX_MESSAGES_PER_SESSION = 3000

# ==============================

WELIVE_EXE = os.path.join(WELIVE_DIR, "welive.exe")


def run_welive(*args):
    """运行 welive 命令，返回解析后的数据"""
    cmd = [WELIVE_EXE] + list(args)
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True,
            encoding='utf-8', errors='replace',
            cwd=WELIVE_DIR, timeout=120
        )
        output = result.stdout.strip()
        if not output:
            return None

        # 尝试多种方式解析
        try:
            return json.loads(output)
        except:
            pass

        # 找第一个 JSON 对象或数组
        for ch in ['{', '[']:
            start = output.find(ch)
            if start >= 0:
                end = output.rfind('}' if ch == '{' else ']')
                if end > start:
                    try:
                        return json.loads(output[start:end+1])
                    except:
                        pass

        return {"_raw": output[:300]}
    except Exception as e:
        return {"_error": str(e)}


def get_nested(data, *keys):
    """安全获取嵌套字段"""
    cur = data
    for k in keys:
        if isinstance(cur, dict):
            cur = cur.get(k)
        else:
            return None
    return cur


def format_ts(ts):
    """格式化时间戳"""
    try:
        ts = int(ts)
        if ts > 1e12:
            ts //= 1000
        if ts < 1000000000:
            return None, None
        dt = datetime.fromtimestamp(ts)
        return dt.strftime('%Y-%m-%d'), dt.strftime('%H:%M:%S')
    except:
        return None, None


def detect_message_reader(sessions):
    """探测哪种方式能读到消息"""
    print("🔍 正在探测消息读取方式...")
    print()

    # 找一个测试会话
    test_id = None
    test_name = None
    for s in sessions:
        if not isinstance(s, dict):
            continue
        username = s.get('username', '') or s.get('UserName', '')
        if '@chatroom' in username or username.startswith('gh_') or username == 'filehelper':
            continue
        # 用 id 字段试试
        sid = s.get('id') or s.get('session_id') or username
        test_id = sid
        test_name = username
        break

    if not test_id:
        print("❌ 找不到测试会话")
        return None, None, None

    print(f"测试会话: {test_name} (id={test_id})")
    print()

    # 各种可能的读取方式
    methods = []

    # 1. messages 命令
    methods.append(("messages--session-id", lambda sid: run_welive("messages", "--session-id", str(sid), "--limit", "5")))

    # 2. export-session 导出文件
    def try_export(sid):
        outfile = os.path.join(WELIVE_DIR, f"_tmp_{sid}.json")
        run_welive("export-session", "--session-id", str(sid),
                  "--out", outfile, "--limit", "5", "--lite", "--jsonl")
        if os.path.exists(outfile):
            try:
                msgs = []
                with open(outfile, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                msgs.append(json.loads(line))
                            except:
                                pass
                os.unlink(outfile)
                return msgs if msgs else None
            except:
                try:
                    os.unlink(outfile)
                except:
                    pass
        return None

    methods.append(("export-session", try_export))

    # 3. session-pack
    methods.append(("session-pack", lambda sid: run_welive("session-pack", "--session-id", str(sid), "--limit", "5")))

    # 4. exec SQL
    def try_exec(sid):
        # 先看看有什么表
        result = run_welive("exec", "--kind", "message", "--sql", "SELECT name FROM sqlite_master WHERE type='table' LIMIT 20")
        return result

    methods.append(("exec-tables", try_exec))

    # 逐一测试
    for name, func in methods:
        result = func(test_id)
        has_data = False

        if isinstance(result, list) and len(result) > 0:
            has_data = True
        elif isinstance(result, dict):
            for k in ['messages', 'data', 'result']:
                v = result.get(k)
                if isinstance(v, list) and len(v) > 0:
                    has_data = True
                    break

        print(f"  [{ '✓' if has_data else '✗'}] {name}: {str(result)[:150]}")

        if has_data:
            print()
            print(f"✅ 找到可用方式: {name}")
            return name, func, test_id

    print()
    print("❌ 所有方法都没读到消息")
    return None, None, None


def read_all_messages(method_name, method_func, session_id):
    """读取一个会话的所有消息"""
    result = method_func(session_id)

    # 统一转换成消息列表
    msgs = []
    if isinstance(result, list):
        msgs = result
    elif isinstance(result, dict):
        for k in ['messages', 'data', 'result', 'list']:
            v = result.get(k)
            if isinstance(v, list):
                msgs = v
                break

    return msgs


def extract_message_info(msg, my_wxid):
    """从消息中提取时间、发送者、内容"""
    # 时间戳
    ts = None
    for key in ['create_time', 'timestamp', 'CreateTime', 'time', 'msgTime']:
        if msg.get(key):
            ts = msg[key]
            break

    date_str, time_str = format_ts(ts) if ts else (None, None)
    if not date_str:
        return None

    # 内容
    content = None
    msg_type = 1
    for key in ['content', 'message', 'StrContent', 'text', 'Content']:
        if msg.get(key):
            content = str(msg[key])
            break

    for key in ['type', 'MsgType', 'msgType']:
        if msg.get(key) is not None:
            msg_type = msg[key]
            break

    # 格式化内容
    if content is None:
        if msg_type == 3:
            content = "[图片]"
        elif msg_type == 34:
            content = "[语音]"
        elif msg_type == 43:
            content = "[视频]"
        elif msg_type == 47:
            content = "[表情]"
        elif msg_type == 49:
            content = "[链接/文件]"
        else:
            content = "[其他消息]"

    if msg_type == 10000:
        return None  # 系统消息跳过

    # 是否自己发的
    is_self = False
    for key in ['is_sender', 'IsSender', 'isSelf']:
        v = msg.get(key)
        if v == 1 or v is True:
            is_self = True
            break

    sender = msg.get('sender') or msg.get('FromUserName') or ''
    if my_wxid and sender == my_wxid:
        is_self = True

    line = f"[{time_str}] {'我' if is_self else '对方'}：{content}"
    return date_str, line


def main():
    print("=" * 60)
    print("  小象智能 CRM - WeLive 一键同步")
    print("=" * 60)
    print()

    # 检查环境
    print("📋 检查环境...")
    if not os.path.exists(WELIVE_EXE):
        print(f"❌ 找不到 WeLive: {WELIVE_EXE}")
        print("   请修改脚本顶部的 WELIVE_DIR 路径")
        input("\n按回车退出...")
        return
    print(f"  ✅ WeLive: {WELIVE_EXE}")

    try:
        import requests
        print(f"  ✅ requests 已安装")
    except ImportError:
        print(f"  ⚙  安装 requests...")
        subprocess.run([sys.executable, "-m", "pip", "install", "requests"], capture_output=True)
        import requests
        print(f"  ✅ requests 安装完成")

    # 获取我的 wxid
    my_wxid = ""
    yaml_path = os.path.join(WELIVE_DIR, "welive.yaml")
    if os.path.exists(yaml_path):
        try:
            with open(yaml_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('wxid:'):
                        my_wxid = line.split(':', 1)[1].strip().strip("'\"")
                        break
        except:
            pass
    if my_wxid:
        print(f"  ✅ 我的 wxid: {my_wxid}")

    print()

    # 获取会话列表
    print("📨 获取会话列表...")
    sessions = run_welive("sessions")
    if not isinstance(sessions, list):
        # 可能在 data 字段里
        if isinstance(sessions, dict):
            for k in ['sessions', 'data', 'result']:
                v = sessions.get(k)
                if isinstance(v, list):
                    sessions = v
                    break

    if not isinstance(sessions, list) or len(sessions) == 0:
        print(f"❌ 无法获取会话列表: {sessions}")
        input("\n按回车退出...")
        return

    print(f"  ✅ 共 {len(sessions)} 个会话")

    # 过滤单聊
    private_sessions = []
    for s in sessions:
        if not isinstance(s, dict):
            continue
        username = str(s.get('username', s.get('UserName', '')))
        if '@chatroom' in username or username.startswith('gh_') or username in ['filehelper', 'newsapp']:
            continue
        private_sessions.append(s)

    print(f"  📱 其中单聊 {len(private_sessions)} 个")
    print()

    # 探测消息读取方式
    method_name, method_func, test_id = detect_message_reader(sessions)
    if not method_name:
        print()
        print("❌ 无法读取消息，请截图发给开发者")
        input("\n按回车退出...")
        return

    print()
    print(f"📤 开始同步所有联系人的聊天记录...")
    print(f"   读取方式: {method_name}")
    print()

    # 获取联系人信息（用于显示名称）
    print("👤 加载联系人信息...")
    contacts_map = {}
    contacts = run_welive("contacts")
    if isinstance(contacts, list):
        for c in contacts:
            if isinstance(c, dict):
                uname = c.get('username') or c.get('UserName') or ''
                if uname:
                    contacts_map[uname] = c
    print(f"  ✅ 加载了 {len(contacts_map)} 个联系人")
    print()

    # 逐个读取并整理
    all_sessions_data = []
    total_days = 0

    for i, s in enumerate(private_sessions):
        username = str(s.get('username', s.get('UserName', '')))
        session_id = s.get('id') or s.get('session_id') or username

        # 显示名称
        display_name = username
        if username in contacts_map:
            c = contacts_map[username]
            display_name = c.get('remark') or c.get('Remark') or c.get('nickname') or c.get('NickName') or username
        else:
            display_name = s.get('last_sender_display_name') or s.get('display_name') or username

        print(f"  [{i+1}/{len(private_sessions)}] {display_name}...", end=' ')

        try:
            msgs = read_all_messages(method_name, method_func, session_id)
        except:
            msgs = []

        if not msgs or len(msgs) == 0:
            print("无消息")
            continue

        # 整理成按天的格式
        daily = {}
        for msg in msgs:
            if not isinstance(msg, dict):
                continue
            info = extract_message_info(msg, my_wxid)
            if not info:
                continue
            date_str, line = info
            if date_str not in daily:
                daily[date_str] = []
            daily[date_str].append(line)

        if not daily:
            print("无有效消息")
            continue

        messages_data = []
        for date in sorted(daily.keys()):
            messages_data.append({
                'date': date,
                'content': '\n'.join(daily[date]),
                'msg_count': len(daily[date])
            })

        all_sessions_data.append({
            'wxid': username,
            'name': display_name,
            'messages': messages_data
        })
        total_days += len(messages_data)
        print(f"{len(messages_data)} 天")

        # 每 20 个歇一下
        if (i + 1) % 20 == 0:
            print(f"    ... 进度: {i+1}/{len(private_sessions)}, 已找到 {len(all_sessions_data)} 个有记录的联系人")

    print()
    print("=" * 60)
    print(f"  📊 统计")
    print(f"  联系人: {len(all_sessions_data)} 个")
    print(f"  聊天天数: {total_days} 天")
    print("=" * 60)
    print()

    if len(all_sessions_data) == 0:
        print("❌ 没有可导入的聊天记录")
        input("\n按回车退出...")
        return

    confirm = input("确认上传到 CRM? (y/N): ").strip().lower()
    if confirm != 'y':
        print("已取消")
        return

    print()
    print("☁️  正在上传到 CRM...")

    # 分批上传
    batch_size = 20
    total_created = 0
    total_inserted = 0

    url = f"{CRM_BASE_URL.rstrip('/')}/api/wechat/bulk-import"
    headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': CRM_API_KEY
    }

    for i in range(0, len(all_sessions_data), batch_size):
        batch = all_sessions_data[i:i+batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(all_sessions_data) + batch_size - 1) // batch_size

        print(f"  第 {batch_num}/{total_batches} 批 ({len(batch)} 个联系人)...", end=' ')

        try:
            resp = requests.post(url, json={'sessions': batch}, headers=headers, timeout=120)
            resp.raise_for_status()
            result = resp.json()
            created = result.get('created_customers', 0)
            inserted = result.get('inserted_chats', 0)
            total_created += created
            total_inserted += inserted
            print(f"✅ 新建:{created} 新增聊天:{inserted}")
        except Exception as e:
            print(f"❌ 失败: {e}")
            try:
                print(f"     响应: {resp.text[:200]}")
            except:
                pass

        time.sleep(0.3)

    print()
    print("=" * 60)
    print("  🎉 同步完成！")
    print("=" * 60)
    print(f"  新建客户: {total_created}")
    print(f"  新增聊天记录: {total_inserted}")
    print()
    print(f"  查看地址: {CRM_BASE_URL}/wechat")
    print()

    input("按回车退出...")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n已取消")
    except Exception as e:
        print(f"\n❌ 出错: {e}")
        import traceback
        traceback.print_exc()
        input("\n按回车退出...")
