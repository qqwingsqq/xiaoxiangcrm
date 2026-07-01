# -*- coding: utf-8 -*-
"""
WeLive 微信聊天记录同步到 CRM
使用方法:
  1. 修改下面的 WELIVE_DIR 为你的 WeLive 目录
  2. 修改 CRM_BASE_URL 和 CRM_API_KEY
  3. 运行: python welive_sync.py
"""
import subprocess
import json
import sys
import os
import time
from datetime import datetime

try:
    import requests
except ImportError:
    print("请安装 requests: pip install requests")
    sys.exit(1)

# ============ 配置 ============

# WeLive 程序目录（改成你自己的路径）
WELIVE_DIR = r"D:\小象智能AI\CRM\welive-windows-x64"

# CRM 地址
CRM_BASE_URL = "https://58f4e50.r8.cpolar.top"

# CRM API Key
CRM_API_KEY = "wechat-monitor-2026-secret-key"

# 每个联系人最多读取多少条消息
MAX_MESSAGES_PER_SESSION = 5000

# ==============================

WELIVE_EXE = os.path.join(WELIVE_DIR, "welive.exe")


def run_welive(*args):
    """运行 welive 命令并返回 JSON 结果"""
    cmd = [WELIVE_EXE] + list(args)
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            cwd=WELIVE_DIR,
            timeout=120
        )
        output = result.stdout.strip()
        try:
            return json.loads(output)
        except:
            start = output.find('{')
            end = output.rfind('}')
            if start >= 0 and end > start:
                try:
                    return json.loads(output[start:end+1])
                except:
                    pass
            start = output.find('[')
            end = output.rfind(']')
            if start >= 0 and end > start:
                try:
                    return json.loads(output[start:end+1])
                except:
                    pass
            return {"raw": output[:500]}
    except Exception as e:
        return {"error": str(e)}


def get_sessions():
    """获取所有会话列表"""
    data = run_welive("sessions")
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ['sessions', 'data', 'result']:
            if key in data and isinstance(data[key], list):
                return data[key]
    return []


def get_messages(session_id, limit=1000):
    """获取会话消息"""
    data = run_welive(
        "messages",
        "--session-id", str(session_id),
        "--limit", str(limit),
        "--asc"
    )
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ['messages', 'data', 'result']:
            if key in data and isinstance(data[key], list):
                return data[key]
    return []


def get_contacts():
    """获取联系人列表"""
    data = run_welive("contacts")
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ['contacts', 'data', 'result']:
            if key in data and isinstance(data[key], list):
                return data[key]
    return []


def get_my_wxid():
    """获取自己的 wxid"""
    # 从 yaml 配置读取
    yaml_path = os.path.join(WELIVE_DIR, "welive.yaml")
    if os.path.exists(yaml_path):
        try:
            with open(yaml_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('wxid:'):
                        return line.split(':', 1)[1].strip().strip("'\"")
        except:
            pass
    return ""


def format_msg_content(msg):
    """格式化消息内容"""
    msg_type = msg.get('type') or msg.get('MsgType') or 1
    content = msg.get('content') or msg.get('StrContent') or msg.get('message') or ''
    
    if isinstance(msg_type, str):
        type_map = {
            'text': 1, 'image': 3, 'voice': 34, 'video': 43,
            'emoji': 47, 'link': 49, 'file': 49
        }
        msg_type = type_map.get(msg_type, 1)
    
    if msg_type == 1:
        return str(content)
    elif msg_type == 3:
        return "[图片]"
    elif msg_type == 34:
        return "[语音]"
    elif msg_type == 43:
        return "[视频]"
    elif msg_type == 47:
        return "[表情]"
    elif msg_type == 49:
        return "[链接/文件]"
    elif msg_type == 10000:
        return None
    else:
        return str(content) if content else "[其他消息]"


def is_self_sent(msg, my_wxid):
    """判断是否自己发送的消息"""
    if msg.get('is_sender') == 1 or msg.get('IsSender') == 1:
        return True
    if msg.get('is_sender') is True:
        return True
    sender = msg.get('sender') or msg.get('FromUserName') or ''
    if sender and my_wxid and sender == my_wxid:
        return True
    return False


def format_messages_to_daily(messages, my_wxid):
    """把消息整理成按天的格式"""
    daily = {}
    
    for msg in messages:
        ts = msg.get('create_time') or msg.get('timestamp') or msg.get('CreateTime') or 0
        if not ts:
            continue
        
        try:
            ts = int(ts)
            if ts > 1e12:
                ts = ts // 1000
            if ts < 1000000000:
                continue
            dt = datetime.fromtimestamp(ts)
            date_str = dt.strftime('%Y-%m-%d')
            time_str = dt.strftime('%H:%M:%S')
        except:
            continue
        
        text = format_msg_content(msg)
        if text is None:
            continue
        
        is_sender = is_self_sent(msg, my_wxid)
        line = f"[{time_str}] {'我' if is_sender else '对方'}：{text}"
        
        if date_str not in daily:
            daily[date_str] = []
        daily[date_str].append(line)
    
    result = []
    for date in sorted(daily.keys()):
        result.append({
            'date': date,
            'content': '\n'.join(daily[date]),
            'msg_count': len(daily[date])
        })
    return result


def get_display_name(session, contacts_map):
    """获取显示名称"""
    username = session.get('username', '')
    
    if username in contacts_map:
        c = contacts_map[username]
        remark = c.get('remark') or c.get('Remark') or ''
        name = c.get('nickname') or c.get('NickName') or ''
        return remark or name or username
    
    display = session.get('last_sender_display_name') or \
              session.get('display_name') or \
              session.get('nickname') or \
              session.get('name') or ''
    
    return display or username


def filter_private_sessions(sessions):
    """过滤出单聊会话"""
    private = []
    for s in sessions:
        username = (s.get('username') or '').lower()
        if '@chatroom' in username:
            continue
        if username.startswith('gh_'):
            continue
        if username in ['filehelper', 'newsapp', 'mphelper', 'fmessage']:
            continue
        if 'weixin' in username and len(username) < 15:
            continue
        private.append(s)
    return private


def upload_to_crm(sessions_data):
    """上传到 CRM"""
    url = f"{CRM_BASE_URL.rstrip('/')}/api/wechat/bulk-import"
    headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': CRM_API_KEY
    }
    
    try:
        response = requests.post(
            url,
            json={'sessions': sessions_data},
            headers=headers,
            timeout=300
        )
        response.raise_for_status()
        return response.json(), None
    except Exception as e:
        return None, str(e)


def main():
    print("=" * 60)
    print("  小象智能 CRM - WeLive 同步工具")
    print("=" * 60)
    print()
    
    if not os.path.exists(WELIVE_EXE):
        print(f"❌ 找不到 WeLive: {WELIVE_EXE}")
        print("   请修改脚本中的 WELIVE_DIR 路径")
        input("\n按回车退出...")
        return
    
    # 获取我的 wxid
    my_wxid = get_my_wxid()
    if my_wxid:
        print(f"我的 wxid: {my_wxid}")
    print()
    
    # 获取会话列表
    print("正在获取会话列表...")
    sessions = get_sessions()
    print(f"找到 {len(sessions)} 个会话")
    
    # 获取联系人列表（用于显示名称）
    print("正在获取联系人列表...")
    contacts = get_contacts()
    contacts_map = {}
    for c in contacts:
        username = c.get('username') or c.get('UserName') or ''
        if username:
            contacts_map[username] = c
    print(f"找到 {len(contacts)} 个联系人")
    print()
    
    # 过滤单聊
    private_sessions = filter_private_sessions(sessions)
    print(f"其中单聊会话 {len(private_sessions)} 个")
    print()
    
    # 询问导入数量
    print(f"准备读取最近的聊天记录...")
    print()
    
    # 准备数据
    sessions_to_import = []
    total_days = 0
    total_contacts = 0
    
    for i, s in enumerate(private_sessions):
        username = s.get('username', '')
        display_name = get_display_name(s, contacts_map)
        
        print(f"[{i+1}/{len(private_sessions)}] {display_name}...", end=' ')
        
        messages = get_messages(username, limit=MAX_MESSAGES_PER_SESSION)
        
        if messages:
            daily_msgs = format_messages_to_daily(messages, my_wxid)
            if daily_msgs:
                sessions_to_import.append({
                    'wxid': username,
                    'name': display_name,
                    'messages': daily_msgs
                })
                total_days += len(daily_msgs)
                total_contacts += 1
                print(f"{len(daily_msgs)} 天记录")
            else:
                print("无有效消息")
        else:
            print("无消息")
        
        if (i + 1) % 20 == 0:
            print(f"  ... 已处理 {i+1} 个，已找到 {total_contacts} 个有记录的联系人")
    
    print()
    print("=" * 60)
    print(f"  准备完毕")
    print(f"  联系人: {total_contacts} 个")
    print(f"  聊天天数: {total_days} 天")
    print("=" * 60)
    print()
    
    if total_contacts == 0:
        print("没有可导入的聊天记录")
        input("\n按回车退出...")
        return
    
    confirm = input("确认上传到 CRM? (y/N): ").strip().lower()
    if confirm != 'y':
        print("已取消")
        return
    
    print()
    print("正在上传到 CRM...")
    
    # 分批上传，每次 20 个联系人
    batch_size = 20
    all_created = 0
    all_inserted = 0
    
    for i in range(0, len(sessions_to_import), batch_size):
        batch = sessions_to_import[i:i+batch_size]
        print(f"  上传第 {i//batch_size + 1} 批 ({len(batch)} 个联系人)...")
        
        result, err = upload_to_crm(batch)
        if err:
            print(f"    ❌ 失败: {err}")
        else:
            created = result.get('created_customers', 0) if result else 0
            inserted = result.get('inserted_chats', 0) if result else 0
            all_created += created
            all_inserted += inserted
            print(f"    ✅ 成功 (新建客户: {created}, 新增聊天: {inserted})")
        
        time.sleep(0.5)
    
    print()
    print("=" * 60)
    print("  ✅ 全部上传完成！")
    print("=" * 60)
    print(f"  新建客户: {all_created}")
    print(f"  新增聊天记录: {all_inserted}")
    print()
    print(f"  查看: {CRM_BASE_URL}/wechat")
    print()
    
    input("按回车退出...")


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
