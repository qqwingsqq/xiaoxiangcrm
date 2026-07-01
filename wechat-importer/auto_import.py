# -*- coding: utf-8 -*-
"""
微信聊天记录全自动导入工具 - 小象智能 CRM
一键完成：密钥提取 → 数据库解密 → 聊天读取 → 上传CRM
"""
import os
import sys
import json
import time
import sqlite3
import hashlib
import struct
from pathlib import Path
from datetime import datetime

try:
    import pymem
except ImportError:
    print("❌ 未安装 pymem")
    print("请先运行: pip install pymem pycryptodome requests")
    input("按回车退出")
    sys.exit(1)

try:
    from Crypto.Cipher import AES
except ImportError:
    print("❌ 未安装 pycryptodome")
    print("请先运行: pip install pycryptodome")
    input("按回车退出")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("❌ 未安装 requests")
    print("请先运行: pip install requests")
    input("按回车退出")
    sys.exit(1)


# 配置
CRM_URL = "https://58f4e50.r8.cpolar.top"
API_KEY = "wechat-monitor-2026-secret-key"


def print_step(n, title):
    print()
    print("=" * 60)
    print(f"  步骤 {n}/5: {title}")
    print("=" * 60)
    print()


def find_wechat_process():
    """查找微信进程"""
    for name in ['Weixin.exe', 'WeChat.exe']:
        try:
            pm = pymem.Pymem(name)
            return pm, name
        except:
            continue
    return None, None


def find_wechat_data_dir():
    """查找微信数据目录"""
    candidates = []
    
    # 用户文档
    docs = Path(os.path.expanduser('~')) / 'Documents'
    wd = docs / 'WeChat Files'
    if wd.exists():
        candidates.append(wd)
    
    # 各盘根目录
    for drive in ['C', 'D', 'E', 'F']:
        for base in [f'{drive}:\\WeChat Files', f'{drive}:\\360MoveData\\Users\\{os.getlogin()}\\Documents\\WeChat Files']:
            p = Path(base)
            if p.exists():
                candidates.append(p)
    
    return candidates[0] if candidates else None


def list_wx_users(data_dir):
    """列出微信用户"""
    users = []
    for item in Path(data_dir).iterdir():
        if item.is_dir() and item.name not in ['All Users', 'Applet', 'WMPF']:
            if (item / 'Msg').exists():
                users.append(item.name)
    return users


def decrypt_db(db_path, key_hex):
    """解密数据库，成功返回临时路径，失败返回 None"""
    try:
        with open(db_path, 'rb') as f:
            data = f.read()
        
        if len(data) < 1024:
            return None
        
        salt = data[:16]
        encrypted = data[16:]
        
        # 微信数据库使用 SQLCipher 3.x
        # 密钥派生: PBKDF2-HMAC-SHA1, 64000 轮, 32字节密钥
        # 但不同版本可能不同，我们尝试几种常见方式
        
        key_bytes = bytes.fromhex(key_hex) if len(key_hex) == 64 else key_hex.encode()
        
        # 方式1: 直接用密钥派生 (SQLCipher 标准)
        try:
            dkey = hashlib.pbkdf2_hmac('sha1', key_bytes, salt, 64000, 32)
            iv = encrypted[:16]
            ct = encrypted[16:]
            
            cipher = AES.new(dkey, AES.MODE_CBC, iv)
            dec = cipher.decrypt(ct)
            
            pad = dec[-1]
            if 1 <= pad <= 16:
                dec = dec[:-pad]
            
            if dec[:16] == b'SQLite format 3\x00':
                import tempfile
                tmp = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
                tmp.write(dec)
                tmp.close()
                return tmp.name
        except:
            pass
        
        # 方式2: 用原始密钥直接解密（某些版本）
        try:
            iv = encrypted[:16]
            ct = encrypted[16:]
            
            cipher = AES.new(key_bytes[:32] if len(key_bytes) >= 32 else key_bytes, AES.MODE_CBC, iv)
            dec = cipher.decrypt(ct)
            
            pad = dec[-1]
            if 1 <= pad <= 16:
                dec = dec[:-pad]
            
            if dec[:16] == b'SQLite format 3\x00':
                import tempfile
                tmp = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
                tmp.write(dec)
                tmp.close()
                return tmp.name
        except:
            pass
        
    except Exception as e:
        pass
    
    return None


def extract_key_from_memory(pm):
    """从内存中提取微信数据库密钥
    
    使用多种策略尝试找到正确的密钥
    """
    # 查找主模块
    main_mod = None
    for m in pm.list_modules():
        n = m.name.lower()
        if 'weixin.dll' in n or 'wechatwin.dll' in n:
            main_mod = m
            break
    
    if not main_mod:
        # 用主进程模块
        for m in pm.list_modules():
            if m.name.lower().endswith('.exe') and 'weixin' in m.name.lower():
                main_mod = m
                break
    
    if not main_mod:
        return None
    
    base = main_mod.lpBaseOfDll
    size = main_mod.SizeOfImage
    
    print(f"  模块: {main_mod.name}")
    print(f"  基址: {hex(base)}, 大小: {size//1024}KB")
    print()
    
    # 读取内存
    try:
        data = pm.read_bytes(base, size)
    except:
        return None
    
    import re
    
    # 策略1: 搜索 wxid 附近的密钥
    # 微信密钥通常存储在配置结构体中，附近有 wxid 等标识
    print("  策略1: 搜索 wxid 附近...")
    for pattern in [b'wxid_', b'filehelper', b'fmessage']:
        pos = 0
        while True:
            pos = data.find(pattern, pos)
            if pos == -1:
                break
            
            # 在前后各 4KB 范围内搜索 64位十六进制
            start = max(0, pos - 4096)
            end = min(len(data), pos + 4096)
            region = data[start:end]
            
            hex_keys = re.findall(b'[0-9a-f]{64}', region)
            for hk in hex_keys:
                key = hk.decode('ascii')
                # 排除全相同字符的
                if len(set(key)) > 5:
                    print(f"    找到候选: {key[:20]}...")
                    return key
            
            pos += 1
    
    # 策略2: 搜索所有 64位十六进制，按熵值排序
    print("  策略2: 搜索所有 64 位十六进制字符串...")
    all_hex = re.findall(b'[0-9a-f]{64}', data)
    print(f"    共找到 {len(all_hex)} 个")
    
    # 过滤掉全相同或简单重复的
    valid_keys = []
    for hk in all_hex:
        key = hk.decode('ascii')
        # 必须包含多种字符
        if len(set(key)) >= 10:
            valid_keys.append(key)
    
    print(f"    过滤后 {len(valid_keys)} 个候选")
    
    # 策略3: 搜索可能的密钥偏移
    # 对于微信新版本，密钥可能在特定的结构体中
    # 我们尝试找包含 "key" 或 "db" 的 UTF-16 字符串附近
    
    return valid_keys[0] if valid_keys else None


def verify_key_with_db(key, msg_dir):
    """用实际数据库验证密钥是否正确"""
    msg_path = Path(msg_dir)
    
    # 找一个最小的数据库来测试
    test_dbs = []
    
    micro = msg_path / 'MicroMsg.db'
    if micro.exists():
        test_dbs.append(micro)
    
    msg_dbs_dir = msg_path / 'MSG'
    if msg_dbs_dir.exists():
        for db in sorted(msg_dbs_dir.glob('MSG*.db'), key=lambda x: x.stat().st_size):
            test_dbs.append(db)
    
    for db_path in test_dbs[:5]:
        print(f"  测试: {db_path.name} ({db_path.stat().st_size//1024}KB)")
        result = decrypt_db(str(db_path), key)
        if result:
            print(f"  ✅ 密钥验证成功!")
            return True
        else:
            print(f"  ✗ 解密失败")
    
    return False


def brute_force_key(candidates, msg_dir):
    """用候选密钥逐个尝试解密"""
    print(f"\n  正在验证 {len(candidates)} 个候选密钥...")
    
    # 找最小的 MSG 数据库用于测试
    test_db = None
    msg_dbs_dir = Path(msg_dir) / 'MSG'
    if msg_dbs_dir.exists():
        dbs = sorted(msg_dbs_dir.glob('MSG*.db'), key=lambda x: x.stat().st_size)
        if dbs:
            test_db = str(dbs[0])
    
    if not test_db:
        micro = Path(msg_dir) / 'MicroMsg.db'
        if micro.exists():
            test_db = str(micro)
    
    if not test_db:
        return None
    
    print(f"  测试数据库: {Path(test_db).name}")
    print()
    
    for i, key in enumerate(candidates[:50]):
        if (i + 1) % 10 == 0:
            print(f"  进度: {i+1}/{min(len(candidates), 50)}")
        
        result = decrypt_db(test_db, key)
        if result:
            try:
                os.unlink(result)
            except:
                pass
            print(f"  ✅ 找到正确密钥! (第 {i+1} 个候选)")
            return key
    
    return None


def get_contacts(micro_msg_db):
    """获取联系人"""
    contacts = []
    try:
        conn = sqlite3.connect(micro_msg_db)
        cur = conn.cursor()
        
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Contact'")
        if cur.fetchone():
            cur.execute("SELECT UserName, NickName, Remark, Type FROM Contact WHERE Type IN (0,1) AND VerifyFlag=0")
            for row in cur.fetchall():
                wxid = row[0] or ''
                if wxid and '@' not in wxid:  # 排除群聊
                    contacts.append({
                        'wxid': wxid,
                        'nickname': row[1] or '',
                        'remark': row[2] or '',
                    })
        conn.close()
    except Exception as e:
        print(f"  读取联系人出错: {e}")
    return contacts


def parse_messages(msg_db, wxid):
    """解析某个联系人的聊天消息"""
    messages = []
    try:
        conn = sqlite3.connect(msg_db)
        cur = conn.cursor()
        
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'MSG%'")
        tables = [r[0] for r in cur.fetchall()]
        
        for table in tables:
            try:
                cur.execute(f"PRAGMA table_info({table})")
                cols = [c[1] for c in cur.fetchall()]
                
                if 'StrTalker' in cols and 'CreateTime' in cols:
                    cur.execute(f"""
                        SELECT CreateTime, Type, StrContent, IsSender 
                        FROM {table} 
                        WHERE StrTalker = ? 
                        ORDER BY CreateTime ASC
                    """, (wxid,))
                    
                    daily = {}
                    for row in cur.fetchall():
                        ts, msg_type, content, is_sender = row
                        try:
                            dt = datetime.fromtimestamp(ts)
                            date_str = dt.strftime('%Y-%m-%d')
                            time_str = dt.strftime('%H:%M:%S')
                        except:
                            continue
                        
                        if msg_type == 1:
                            text = content or ''
                        elif msg_type == 3:
                            text = "[图片]"
                        elif msg_type == 34:
                            text = "[语音]"
                        elif msg_type == 43:
                            text = "[视频]"
                        elif msg_type == 47:
                            text = "[表情]"
                        elif msg_type == 49:
                            text = "[链接/文件]"
                        elif msg_type == 10000:
                            continue
                        else:
                            text = content or "[其他消息]"
                        
                        line = f"[{time_str}] {'我' if is_sender == 1 else '对方'}：{text}"
                        
                        if date_str not in daily:
                            daily[date_str] = []
                        daily[date_str].append(line)
                    
                    for date, lines in daily.items():
                        messages.append({
                            'date': date,
                            'content': '\n'.join(lines),
                            'msg_count': len(lines),
                        })
            except:
                continue
        
        conn.close()
    except Exception as e:
        pass
    return messages


def upload_sessions(sessions):
    """上传到 CRM"""
    url = f"{CRM_URL.rstrip('/')}/api/wechat/bulk-import"
    headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY,
    }
    
    try:
        resp = requests.post(url, json={'sessions': sessions}, headers=headers, timeout=300)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"  上传失败: {e}")
        return None


def main():
    print("=" * 60)
    print("  🐘 小象智能 CRM - 微信聊天记录全自动导入")
    print("=" * 60)
    
    # 步骤1: 查找微信进程
    print_step(1, "查找微信进程")
    
    pm, proc_name = find_wechat_process()
    if not pm:
        print("❌ 未找到微信进程")
        print("请确保微信已登录，然后以管理员身份运行此脚本")
        input("\n按回车退出...")
        return
    
    print(f"✅ 找到微信进程: {proc_name}")
    
    # 步骤2: 提取密钥
    print_step(2, "提取数据库密钥")
    
    key = None
    
    # 先检查本地是否有密钥文件
    key_file = Path(__file__).parent / 'wechat_key.txt'
    if key_file.exists():
        saved_key = key_file.read_text(encoding='utf-8').strip()
        if len(saved_key) == 64:
            print("  检测到本地密钥文件，先验证...")
            # 验证一下，后面再说
            key = saved_key
    
    if not key:
        # 从内存提取
        key = extract_key_from_memory(pm)
        if key:
            print(f"  提取到候选密钥: {key[:20]}...")
        else:
            print("  未能直接提取到密钥")
    
    # 步骤3: 查找微信数据目录并验证密钥
    print_step(3, "验证密钥与查找数据")
    
    data_dir = find_wechat_data_dir()
    if not data_dir:
        print("❌ 未找到微信数据目录")
        input("\n按回车退出...")
        return
    
    print(f"✅ 微信数据目录: {data_dir}")
    
    users = list_wx_users(str(data_dir))
    if not users:
        print("❌ 未找到微信用户数据")
        input("\n按回车退出...")
        return
    
    print(f"✅ 找到 {len(users)} 个微信账号:")
    for i, u in enumerate(users):
        print(f"   {i+1}. {u}")
    
    selected_user = users[0]
    msg_dir = Path(data_dir) / selected_user / 'Msg'
    
    if not msg_dir.exists():
        print(f"❌ 未找到消息目录: {msg_dir}")
        input("\n按回车退出...")
        return
    
    print(f"\n使用账号: {selected_user}")
    
    # 验证密钥
    if key:
        print("\n验证密钥...")
        if verify_key_with_db(key, str(msg_dir)):
            print("✅ 密钥正确!")
            # 保存
            key_file.write_text(key, encoding='utf-8')
        else:
            print("⚠  密钥验证失败，尝试暴力搜索...")
            
            # 重新提取更多候选
            import re
            main_mod = None
            for m in pm.list_modules():
                n = m.name.lower()
                if 'weixin.dll' in n or 'wechatwin.dll' in n:
                    main_mod = m
                    break
            
            if main_mod:
                data = pm.read_bytes(main_mod.lpBaseOfDll, main_mod.SizeOfImage)
                candidates = re.findall(b'[0-9a-f]{64}', data)
                candidates = [k.decode('ascii') for k in candidates if len(set(k.decode('ascii'))) >= 8]
                
                key = brute_force_key(candidates, str(msg_dir))
                if key:
                    key_file.write_text(key, encoding='utf-8')
    
    if not key:
        print("\n❌ 未能获取正确的密钥")
        print("\n💡 建议:")
        print("  1. 搜索 'pywxdump' 工具获取密钥")
        print("  2. 或者搜索 '微信数据库密钥' 获取最新方法")
        input("\n按回车退出...")
        return
    
    # 步骤4: 读取聊天记录
    print_step(4, "读取聊天记录")
    
    # 解密所有数据库
    print("  正在解密数据库...")
    
    decrypted = []
    
    micro_db = msg_dir / 'MicroMsg.db'
    if micro_db.exists():
        dec = decrypt_db(str(micro_db), key)
        if dec:
            decrypted.append(('MicroMsg', dec))
            print(f"  ✓ MicroMsg.db")
    
    msg_dbs_dir = msg_dir / 'MSG'
    if msg_dbs_dir.exists():
        msg_dbs = sorted(msg_dbs_dir.glob('MSG*.db'))
        for db in msg_dbs:
            dec = decrypt_db(str(db), key)
            if dec:
                decrypted.append(('MSG', dec))
    
    print(f"\n✅ 成功解密 {len(decrypted)} 个数据库")
    
    if not decrypted:
        print("❌ 没有成功解密的数据库")
        input("\n按回车退出...")
        return
    
    # 获取联系人
    contacts = []
    for dtype, dpath in decrypted:
        if dtype == 'MicroMsg':
            contacts = get_contacts(dpath)
            break
    
    print(f"✅ 找到 {len(contacts)} 个联系人")
    
    if not contacts:
        print("❌ 未找到联系人")
        input("\n按回车退出...")
        return
    
    # 读取消息
    msg_dbs = [p for t, p in decrypted if t == 'MSG']
    print(f"\n开始读取 {len(contacts)} 个联系人的聊天记录...")
    print()
    
    sessions = []
    for i, c in enumerate(contacts):
        name = c['remark'] or c['nickname'] or c['wxid']
        wxid = c['wxid']
        
        all_msgs = []
        for msg_db in msg_dbs:
            all_msgs.extend(parse_messages(msg_db, wxid))
        
        # 按日期合并
        date_map = {}
        for m in all_msgs:
            d = m['date']
            if d not in date_map:
                date_map[d] = m
            else:
                date_map[d]['content'] += '\n' + m['content']
        
        sorted_msgs = sorted(date_map.values(), key=lambda x: x['date'])
        
        if sorted_msgs:
            sessions.append({
                'wxid': wxid,
                'name': name,
                'messages': sorted_msgs,
            })
            print(f"  [{i+1}/{len(contacts)}] {name}: {len(sorted_msgs)} 天")
        else:
            print(f"  [{i+1}/{len(contacts)}] {name}: 无消息")
    
    print(f"\n✅ 共 {len(sessions)} 个联系人有聊天记录")
    total = sum(len(s['messages']) for s in sessions)
    print(f"   总计 {total} 天的消息")
    
    if not sessions:
        print("没有可导入的聊天记录")
        input("\n按回车退出...")
        return
    
    # 步骤5: 上传到 CRM
    print_step(5, "上传到 CRM 系统")
    
    print(f"  CRM 地址: {CRM_URL}")
    print(f"  待上传: {len(sessions)} 个联系人, {total} 天消息")
    print()
    
    print("  正在上传...")
    result = upload_sessions(sessions)
    
    if result:
        print("\n🎉 上传成功!")
        print(f"   新建客户: {result.get('created_customers', 0)}")
        print(f"   跳过客户: {result.get('skipped_customers', 0)}")
        print(f"   新增聊天: {result.get('inserted_chats', 0)}")
        print(f"   跳过聊天: {result.get('skipped_chats', 0)}")
        print()
        print(f"👉 查看结果: {CRM_URL}/wechat")
    else:
        print("\n❌ 上传失败")
    
    # 清理临时文件
    import tempfile
    for _, dp in decrypted:
        try:
            if Path(dp).parent.name == tempfile.gettempdir():
                os.unlink(dp)
        except:
            pass
    
    print()
    input("按回车键退出...")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n已取消")
    except Exception as e:
        print(f"\n❌ 程序异常: {e}")
        import traceback
        traceback.print_exc()
        input("\n按回车退出...")
