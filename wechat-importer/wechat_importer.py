#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
微信聊天记录批量导入工具 - 小象智能 CRM
功能：从本地微信读取聊天记录并导入到 CRM 系统
特点：完全非侵入式，不修改微信程序任何文件
"""

import os
import sys
import json
import time
import sqlite3
import hashlib
import base64
import getpass
from pathlib import Path
from datetime import datetime, timedelta

try:
    import requests
except ImportError:
    print("请先安装依赖: pip install requests pymem pycryptodome")
    sys.exit(1)

try:
    from Crypto.Cipher import AES
except ImportError:
    print("请先安装 pycryptodome: pip install pycryptodome")
    sys.exit(1)


# ─────────────────────────────────────────────────────────
# 配置
# ─────────────────────────────────────────────────────────
CRM_BASE_URL = os.environ.get('CRM_BASE_URL', 'http://localhost:3000')
CRM_API_KEY = os.environ.get('CRM_API_KEY', '')
IMPORT_SECRET = os.environ.get('IMPORT_SECRET', '')


def get_wechat_paths():
    """获取微信数据目录"""
    if sys.platform != 'win32':
        print("⚠  此脚本仅支持 Windows 平台的微信 PC 版")
        return None, None

    # 常见微信数据目录位置
    possible_paths = []
    
    # 用户文档目录
    documents = Path(os.path.expanduser('~')) / 'Documents'
    wechat_dir = documents / 'WeChat Files'
    if wechat_dir.exists():
        possible_paths.append(wechat_dir)
    
    # 360文档
    for drive in ['C', 'D', 'E', 'F']:
        doc_path = Path(f'{drive}:\\360MoveData\\Users\\{getpass.getuser()}\\Documents\\WeChat Files')
        if doc_path.exists():
            possible_paths.append(doc_path)
    
    # 让用户确认或手动输入
    if possible_paths:
        print(f"📁 找到微信数据目录: {possible_paths[0]}")
        return str(possible_paths[0]), None
    else:
        print("❌ 未找到微信数据目录")
        manual = input("请手动输入微信数据目录路径 (如 D:\\WeChat Files): ").strip()
        if manual:
            return manual, None
        return None, None


def get_wechat_key_from_process():
    """从微信进程内存中获取数据库密钥（需要管理员权限）"""
    try:
        import pymem
    except ImportError:
        print("⚠  未安装 pymem，无法自动获取密钥")
        return None
    
    try:
        # 查找微信进程
        pm = pymem.Pymem("WeChat.exe")
    except Exception as e:
        print(f"⚠  无法访问微信进程: {e}")
        print("   请确保微信正在运行，并以管理员身份运行此脚本")
        return None
    
    try:
        # 搜索密钥模式 - WeChat.db 的密钥通常在内存中
        # 这是一个简化版本，实际实现需要更复杂的内存搜索
        print("🔍 正在从微信内存中提取密钥...")
        
        # 尝试从 WeChatWin.dll 中获取
        modules = list(pm.list_modules())
        wechatwin = None
        for m in modules:
            if 'WeChatWin.dll' in m.name:
                wechatwin = m
                break
        
        if not wechatwin:
            print("⚠  未找到 WeChatWin.dll 模块")
            return None
        
        # 简单的密钥搜索模式
        # 注意：微信版本不同，密钥位置和获取方式也不同
        # 这里使用常见的搜索模式
        base_addr = wechatwin.lpBaseOfDll
        size = wechatwin.SizeOfImage
        
        # 读取模块内存
        try:
            data = pm.read_bytes(base_addr, size)
        except:
            return None
        
        # 搜索可能的密钥位置（简化版）
        # 实际应用中需要根据具体微信版本调整
        key_patterns = [
            b'WeChatKey',
            b'wxid_',
        ]
        
        print("⚠  自动提取密钥可能因微信版本而异")
        print("   如果自动提取失败，请使用 WeChatMsg 等工具手动获取")
        return None
        
    except Exception as e:
        print(f"⚠  提取密钥时出错: {e}")
        return None


def decrypt_database(db_path, key):
    """解密微信数据库并返回连接"""
    try:
        with open(db_path, 'rb') as f:
            encrypted_data = f.read()
        
        if len(encrypted_data) < 1024:
            return None
        
        # 微信数据库使用 AES-256-CBC 加密
        # 前16字节是盐值，然后是加密数据
        salt = encrypted_data[:16]
        encrypted = encrypted_data[16:]
        
        # 使用密钥派生
        # 注意：微信的密钥派生方式比较特殊，这里是简化版本
        try:
            # 尝试直接使用密钥解密
            key_bytes = bytes.fromhex(key) if len(key) == 64 else key.encode()
            
            # 派生密钥
            dkey = hashlib.pbkdf2_hmac('sha1', key_bytes, salt, 64000, 32)
            iv = encrypted[:16]
            ciphertext = encrypted[16:]
            
            cipher = AES.new(dkey, AES.MODE_CBC, iv)
            decrypted = cipher.decrypt(ciphertext)
            
            # 移除填充
            pad_len = decrypted[-1]
            if pad_len < 16:
                decrypted = decrypted[:-pad_len]
            
            # 检查是否是有效的 SQLite 数据库
            if decrypted[:16] == b'SQLite format 3\x00':
                # 写入临时文件
                import tempfile
                tmp = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
                tmp.write(decrypted)
                tmp.close()
                return tmp.name
                
        except Exception as e:
            pass
        
        return None
        
    except Exception as e:
        print(f"解密失败: {e}")
        return None


def list_wx_users(data_dir):
    """列出微信数据目录下的所有用户"""
    users = []
    data_path = Path(data_dir)
    
    if not data_path.exists():
        return users
    
    for item in data_path.iterdir():
        if item.is_dir() and item.name != 'All Users' and item.name != 'Applet':
            # 检查是否有 Msg 目录
            msg_dir = item / 'Msg'
            if msg_dir.exists():
                users.append(item.name)
    
    return users


def find_chat_dbs(msg_dir):
    """查找聊天记录数据库文件"""
    dbs = []
    msg_path = Path(msg_dir)
    
    if not msg_path.exists():
        return dbs
    
    # MicroMsg.db 包含联系人信息
    micro_msg = msg_path / 'MicroMsg.db'
    if micro_msg.exists():
        dbs.append(('MicroMsg', str(micro_msg)))
    
    # MSG 目录下的数据库是聊天记录
    msg_dbs_dir = msg_path / 'MSG'
    if msg_dbs_dir.exists():
        for db_file in msg_dbs_dir.glob('MSG*.db'):
            dbs.append(('MSG', str(db_file)))
    
    # 多媒体消息
    media_dir = msg_path / 'MediaMSG'
    if media_dir.exists():
        for db_file in media_dir.glob('MediaMSG*.db'):
            dbs.append(('MediaMSG', str(db_file)))
    
    return dbs


def get_contacts(micro_msg_db):
    """从 MicroMsg.db 获取联系人列表"""
    contacts = []
    try:
        conn = sqlite3.connect(micro_msg_db)
        cursor = conn.cursor()
        
        # 常见的联系人表
        tables = ['Contact', 'Friends', 'ContactHeadImgInfo']
        for table in tables:
            try:
                cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
                if cursor.fetchone():
                    if table == 'Contact':
                        cursor.execute("SELECT UserName, NickName, Remark, Type FROM Contact WHERE Type IN (0,1)")
                        for row in cursor.fetchall():
                            contacts.append({
                                'wxid': row[0] or '',
                                'nickname': row[1] or '',
                                'remark': row[2] or '',
                                'type': row[3] or 0,
                            })
                    break
            except:
                continue
        
        conn.close()
    except Exception as e:
        print(f"读取联系人失败: {e}")
    
    return contacts


def format_message(msg_type, content, is_sender):
    """格式化消息内容"""
    sender = "我" if is_sender else "对方"
    
    # 根据消息类型处理
    if msg_type == 1:  # 文本
        text = content
    elif msg_type == 3:  # 图片
        text = "[图片]"
    elif msg_type == 34:  # 语音
        text = "[语音]"
    elif msg_type == 43:  # 视频
        text = "[视频]"
    elif msg_type == 47:  # 表情包
        text = "[表情]"
    elif msg_type == 49:  # 链接/小程序/文件等
        text = "[链接/文件]"
    elif msg_type == 10000:  # 系统消息
        return None  # 跳过系统消息
    else:
        text = content or "[其他消息]"
    
    return text


def parse_chat_messages(msg_db, talker_wxid):
    """从 MSG 数据库解析聊天消息"""
    messages = []
    try:
        conn = sqlite3.connect(msg_db)
        cursor = conn.cursor()
        
        # 查找消息表
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'MSG%' ORDER BY name")
        tables = [row[0] for row in cursor.fetchall()]
        
        for table in tables:
            try:
                # 检查是否有 talker 字段
                cursor.execute(f"PRAGMA table_info({table})")
                columns = [col[1] for col in cursor.fetchall()]
                
                if 'StrTalker' in columns and 'CreateTime' in columns:
                    query = f"""
                        SELECT CreateTime, Type, StrContent, IsSender, StrTalker 
                        FROM {table} 
                        WHERE StrTalker = ? 
                        ORDER BY CreateTime ASC
                    """
                    cursor.execute(query, (talker_wxid,))
                    
                    daily_messages = {}
                    
                    for row in cursor.fetchall():
                        create_time = row[0]
                        msg_type = row[1]
                        content = row[2] or ''
                        is_sender = row[3] == 1
                        
                        try:
                            dt = datetime.fromtimestamp(create_time)
                            date_str = dt.strftime('%Y-%m-%d')
                            time_str = dt.strftime('%H:%M:%S')
                        except:
                            continue
                        
                        text = format_message(msg_type, content, is_sender)
                        if text is None:
                            continue
                        
                        line = f"[{time_str}] {'我' if is_sender else '对方'}：{text}"
                        
                        if date_str not in daily_messages:
                            daily_messages[date_str] = []
                        daily_messages[date_str].append(line)
                    
                    for date, lines in daily_messages.items():
                        messages.append({
                            'date': date,
                            'content': '\n'.join(lines),
                            'msg_count': len(lines),
                        })
                    
            except Exception as e:
                continue
        
        conn.close()
    except Exception as e:
        print(f"  读取消息失败: {e}")
    
    return messages


def upload_to_crm(sessions, use_key=True):
    """上传聊天记录到 CRM 系统"""
    if not sessions:
        print("没有可上传的聊天记录")
        return None
    
    url = f"{CRM_BASE_URL.rstrip('/')}/api/wechat/bulk-import"
    headers = {'Content-Type': 'application/json'}
    
    if use_key and CRM_API_KEY:
        headers['X-Api-Key'] = CRM_API_KEY
    elif IMPORT_SECRET:
        headers['X-Import-Secret'] = IMPORT_SECRET
    
    try:
        print(f"📤 正在上传 {len(sessions)} 个联系人的聊天记录...")
        response = requests.post(url, json={'sessions': sessions}, headers=headers, timeout=120)
        response.raise_for_status()
        result = response.json()
        return result
    except requests.exceptions.RequestException as e:
        print(f"❌ 上传失败: {e}")
        return None


def main():
    print("=" * 60)
    print("  小象智能 CRM - 微信聊天记录批量导入工具")
    print("=" * 60)
    print()
    
    # 检查平台
    if sys.platform != 'win32':
        print("⚠  此工具主要支持 Windows 平台的微信 PC 版")
        print("   其他平台请手动导出聊天记录后导入")
        print()
    
    # 配置 CRM 地址
    global CRM_BASE_URL, CRM_API_KEY, IMPORT_SECRET
    
    default_url = CRM_BASE_URL
    user_url = input(f"请输入 CRM 系统地址 (默认: {default_url}): ").strip()
    if user_url:
        CRM_BASE_URL = user_url
    
    # 认证方式
    print()
    print("请选择认证方式:")
    print("  1. API Key（推荐，监控用）")
    print("  2. 导入密钥 (IMPORT_SECRET)")
    print("  3. 登录凭证（浏览器 Cookie）")
    
    auth_choice = input("请选择 (默认: 1): ").strip() or '1'
    
    if auth_choice == '1':
        CRM_API_KEY = input("请输入 MONITOR_API_KEY: ").strip()
    elif auth_choice == '2':
        IMPORT_SECRET = input("请输入 IMPORT_SECRET: ").strip()
    # 选项 3 可以在浏览器中登录后使用
    
    print()
    
    # 获取微信数据目录
    data_dir, _ = get_wechat_paths()
    if not data_dir:
        print("❌ 无法获取微信数据目录")
        return
    
    print()
    
    # 列出用户
    users = list_wx_users(data_dir)
    if not users:
        print("❌ 未找到微信用户数据")
        return
    
    print(f"👤 找到 {len(users)} 个微信账号:")
    for i, user in enumerate(users, 1):
        print(f"   {i}. {user}")
    
    user_idx = input(f"\n请选择要导入的微信账号 (默认: 1): ").strip()
    try:
        user_idx = int(user_idx) - 1 if user_idx else 0
    except:
        user_idx = 0
    
    if user_idx < 0 or user_idx >= len(users):
        user_idx = 0
    
    selected_user = users[user_idx]
    msg_dir = Path(data_dir) / selected_user / 'Msg'
    
    if not msg_dir.exists():
        print(f"❌ 未找到消息目录: {msg_dir}")
        return
    
    print()
    print("🔍 正在查找数据库文件...")
    dbs = find_chat_dbs(str(msg_dir))
    print(f"   找到 {len(dbs)} 个数据库文件")
    
    # 尝试获取密钥
    print()
    key = None
    key_file = Path('wechat_key.txt')
    
    if key_file.exists():
        key = key_file.read_text(encoding='utf-8').strip()
        print(f"🔑 从 wechat_key.txt 读取到密钥")
    
    if not key:
        print("🔑 尝试从微信进程自动获取密钥...")
        key = get_wechat_key_from_process()
    
    if not key:
        print()
        print("⚠  无法自动获取数据库密钥")
        print()
        print("💡 获取密钥的方法:")
        print("   1. 使用 WeChatMsg 工具: https://github.com/LC044/WeChatMsg")
        print("   2. 运行后点击「获取信息」，复制 Key")
        print("   3. 将密钥保存为 wechat_key.txt 放在脚本同目录下")
        print()
        key = input("请手动输入数据库密钥 (留空则跳过解密): ").strip()
    
    if not key:
        print("❌ 没有密钥无法解密数据库")
        print("   提示：也可以使用 WeChatMsg 等工具导出聊天记录后，通过 CRM 的粘贴导入功能")
        return
    
    # 解密数据库
    print()
    print("🔓 正在解密数据库...")
    decrypted_dbs = []
    
    for db_type, db_path in dbs:
        decrypted = decrypt_database(db_path, key)
        if decrypted:
            decrypted_dbs.append((db_type, decrypted))
            print(f"   ✓ {db_type}: 解密成功")
        else:
            print(f"   ✗ {db_type}: 解密失败（可能密钥错误或数据库格式不同）")
    
    if not decrypted_dbs:
        print("❌ 没有成功解密的数据库")
        return
    
    # 获取联系人
    print()
    contacts = []
    micro_msg_db = None
    for db_type, db_path in decrypted_dbs:
        if db_type == 'MicroMsg':
            micro_msg_db = db_path
            break
    
    if micro_msg_db:
        contacts = get_contacts(micro_msg_db)
        print(f"👥 找到 {len(contacts)} 个联系人")
    
    if not contacts:
        print("⚠  未找到联系人，请确保 MicroMsg.db 解密成功")
        return
    
    # 选择要导入的联系人
    print()
    print("请选择要导入的联系人:")
    print("  1. 所有联系人")
    print("  2. 手动选择（输入序号）")
    print("  3. 按关键词搜索")
    
    choice = input("请选择 (默认: 1): ").strip() or '1'
    
    selected_contacts = []
    
    if choice == '1':
        selected_contacts = contacts
    elif choice == '2':
        print()
        print("联系人列表:")
        for i, c in enumerate(contacts[:50], 1):
            name = c['remark'] or c['nickname'] or c['wxid']
            print(f"   {i}. {name} ({c['wxid']})")
        if len(contacts) > 50:
            print(f"   ... 共 {len(contacts)} 个，仅显示前 50 个")
        
        idxs = input("\n输入要导入的序号（逗号分隔，如 1,3,5）: ").strip()
        if idxs:
            for idx_str in idxs.split(','):
                try:
                    idx = int(idx_str.strip()) - 1
                    if 0 <= idx < len(contacts):
                        selected_contacts.append(contacts[idx])
                except:
                    pass
    elif choice == '3':
        keyword = input("请输入搜索关键词: ").strip()
        if keyword:
            for c in contacts:
                name = (c['remark'] or c['nickname'] or c['wxid']).lower()
                if keyword.lower() in name:
                    selected_contacts.append(c)
        print(f"找到 {len(selected_contacts)} 个匹配的联系人")
    
    if not selected_contacts:
        print("❌ 未选择任何联系人")
        return
    
    # 读取聊天消息
    print()
    print(f"📖 正在读取 {len(selected_contacts)} 个联系人的聊天记录...")
    
    msg_dbs = [db_path for db_type, db_path in decrypted_dbs if db_type == 'MSG']
    
    all_sessions = []
    success_count = 0
    
    for i, contact in enumerate(selected_contacts, 1):
        name = contact['remark'] or contact['nickname'] or contact['wxid']
        wxid = contact['wxid']
        
        print(f"  [{i}/{len(selected_contacts)}] {name}...", end=' ')
        
        all_messages = []
        for msg_db in msg_dbs:
            messages = parse_chat_messages(msg_db, wxid)
            all_messages.extend(messages)
        
        # 按日期去重排序
        date_map = {}
        for msg in all_messages:
            date = msg['date']
            if date not in date_map:
                date_map[date] = msg
            else:
                # 合并同一天的消息
                date_map[date]['content'] += '\n' + msg['content']
                date_map[date]['msg_count'] += msg['msg_count']
        
        sorted_messages = sorted(date_map.values(), key=lambda x: x['date'])
        
        if sorted_messages:
            all_sessions.append({
                'wxid': wxid,
                'name': name,
                'messages': sorted_messages,
            })
            print(f"✓ {len(sorted_messages)} 天记录")
            success_count += 1
        else:
            print("无消息")
    
    print()
    print(f"✅ 共读取 {success_count} 个联系人的聊天记录")
    
    total_msgs = sum(len(s['messages']) for s in all_sessions)
    print(f"   总计 {total_msgs} 天的聊天记录")
    
    # 上传到 CRM
    print()
    confirm = input(f"确定要上传到 CRM 系统吗？(y/N): ").strip().lower()
    if confirm != 'y' and confirm != 'yes':
        print("已取消上传")
        return
    
    result = upload_to_crm(all_sessions)
    
    if result:
        print()
        print("🎉 上传成功!")
        print(f"   新建客户: {result.get('created_customers', 0)}")
        print(f"   跳过客户: {result.get('skipped_customers', 0)}")
        print(f"   新增聊天: {result.get('inserted_chats', 0)}")
        print(f"   跳过聊天: {result.get('skipped_chats', 0)}")
    else:
        print("❌ 上传失败")
    
    # 清理临时文件
    import tempfile
    for db_type, db_path in decrypted_dbs:
        try:
            if Path(db_path).parent.name == tempfile.gettempdir():
                os.unlink(db_path)
        except:
            pass
    
    print()
    print("📋 导入完成！请在 CRM 系统中查看和整理聊天记录")
    print(f"   访问: {CRM_BASE_URL}/wechat")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n已取消")
    except Exception as e:
        print(f"\n❌ 程序异常: {e}")
        import traceback
        traceback.print_exc()
        input("\n按回车键退出...")
