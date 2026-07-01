#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
微信聊天记录实时监控工具 - 小象智能 CRM
功能：实时监控微信新消息并同步到 CRM 系统
特点：完全非侵入式，不修改微信程序任何文件，只读数据库
"""

import os
import sys
import json
import time
import sqlite3
import hashlib
import threading
import logging
from pathlib import Path
from datetime import datetime, timedelta

try:
    import requests
except ImportError:
    print("请先安装依赖: pip install requests pycryptodome")
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

# 轮询间隔（秒）
POLL_INTERVAL = int(os.environ.get('POLL_INTERVAL', '10'))

# 状态文件路径
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wechat_monitor_state.json')

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('wechat_monitor')


class WeChatMonitor:
    """微信聊天记录监控器"""
    
    def __init__(self, data_dir, wx_user, db_key, crm_url, api_key):
        self.data_dir = Path(data_dir)
        self.wx_user = wx_user
        self.db_key = db_key
        self.crm_url = crm_url.rstrip('/')
        self.api_key = api_key
        
        self.msg_dir = self.data_dir / wx_user / 'Msg'
        self.state = self._load_state()
        self.running = False
        self._contacts_cache = {}
        self._last_contacts_update = 0
    
    def _load_state(self):
        """加载同步状态"""
        if os.path.exists(STATE_FILE):
            try:
                with open(STATE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"加载状态文件失败: {e}")
        
        return {
            'last_sync_time': int(time.time()) - 3600,  # 默认从1小时前开始
            'last_msg_ids': {},
            'contact_sync_time': 0,
        }
    
    def _save_state(self):
        """保存同步状态"""
        try:
            with open(STATE_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.state, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存状态文件失败: {e}")
    
    def _decrypt_db(self, db_path):
        """解密微信数据库，返回临时数据库路径"""
        try:
            with open(db_path, 'rb') as f:
                encrypted_data = f.read()
            
            if len(encrypted_data) < 1024:
                return None
            
            salt = encrypted_data[:16]
            encrypted = encrypted_data[16:]
            
            key_bytes = bytes.fromhex(self.db_key) if len(self.db_key) == 64 else self.db_key.encode()
            
            try:
                dkey = hashlib.pbkdf2_hmac('sha1', key_bytes, salt, 64000, 32)
                iv = encrypted[:16]
                ciphertext = encrypted[16:]
                
                cipher = AES.new(dkey, AES.MODE_CBC, iv)
                decrypted = cipher.decrypt(ciphertext)
                
                pad_len = decrypted[-1]
                if pad_len < 16:
                    decrypted = decrypted[:-pad_len]
                
                if decrypted[:16] == b'SQLite format 3\x00':
                    import tempfile
                    tmp = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
                    tmp.write(decrypted)
                    tmp.close()
                    return tmp.name
            except:
                pass
            
            return None
        except Exception as e:
            logger.debug(f"解密数据库失败 {db_path}: {e}")
            return None
    
    def _find_msg_dbs(self):
        """查找所有 MSG 数据库文件"""
        dbs = []
        msg_dbs_dir = self.msg_dir / 'MSG'
        if msg_dbs_dir.exists():
            for db_file in sorted(msg_dbs_dir.glob('MSG*.db')):
                dbs.append(str(db_file))
        return dbs
    
    def _get_micro_msg_db(self):
        """获取 MicroMsg.db 路径"""
        db_path = self.msg_dir / 'MicroMsg.db'
        return str(db_path) if db_path.exists() else None
    
    def _get_contacts(self):
        """获取联系人列表（带缓存）"""
        now = time.time()
        # 每5分钟刷新一次联系人缓存
        if now - self._last_contacts_update < 300 and self._contacts_cache:
            return self._contacts_cache
        
        micro_msg_db = self._get_micro_msg_db()
        if not micro_msg_db:
            return self._contacts_cache
        
        decrypted = self._decrypt_db(micro_msg_db)
        if not decrypted:
            return self._contacts_cache
        
        try:
            conn = sqlite3.connect(decrypted)
            cursor = conn.cursor()
            
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Contact'")
            if cursor.fetchone():
                cursor.execute("SELECT UserName, NickName, Remark, Type FROM Contact WHERE Type IN (0,1)")
                for row in cursor.fetchall():
                    wxid = row[0] or ''
                    if wxid:
                        self._contacts_cache[wxid] = {
                            'wxid': wxid,
                            'nickname': row[1] or '',
                            'remark': row[2] or '',
                            'type': row[3] or 0,
                        }
            
            conn.close()
        except Exception as e:
            logger.debug(f"读取联系人失败: {e}")
        finally:
            try:
                os.unlink(decrypted)
            except:
                pass
        
        self._last_contacts_update = now
        return self._contacts_cache
    
    def _get_new_messages(self, since_time):
        """获取指定时间之后的新消息"""
        msg_dbs = self._find_msg_dbs()
        if not msg_dbs:
            return []
        
        new_messages = []
        
        for db_path in msg_dbs:
            decrypted = self._decrypt_db(db_path)
            if not decrypted:
                continue
            
            try:
                conn = sqlite3.connect(decrypted)
                cursor = conn.cursor()
                
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'MSG%'")
                tables = [row[0] for row in cursor.fetchall()]
                
                for table in tables:
                    try:
                        cursor.execute(f"PRAGMA table_info({table})")
                        columns = [col[1] for col in cursor.fetchall()]
                        
                        if 'StrTalker' in columns and 'CreateTime' in columns:
                            query = f"""
                                SELECT CreateTime, Type, StrContent, IsSender, StrTalker, localId
                                FROM {table} 
                                WHERE CreateTime > ?
                                ORDER BY CreateTime ASC
                            """
                            cursor.execute(query, (since_time,))
                            
                            for row in cursor.fetchall():
                                create_time = row[0]
                                msg_type = row[1]
                                content = row[2] or ''
                                is_sender = row[3] == 1
                                talker = row[4] or ''
                                msg_id = row[5]
                                
                                # 过滤群聊消息（只处理单聊）
                                if '@chatroom' in talker:
                                    continue
                                
                                new_messages.append({
                                    'talker': talker,
                                    'create_time': create_time,
                                    'msg_type': msg_type,
                                    'content': content,
                                    'is_sender': is_sender,
                                    'msg_id': msg_id,
                                })
                    except Exception as e:
                        continue
                
                conn.close()
            except Exception as e:
                logger.debug(f"读取消息失败 {db_path}: {e}")
            finally:
                try:
                    os.unlink(decrypted)
                except:
                    pass
        
        return new_messages
    
    def _format_content(self, msg_type, content, is_sender):
        """格式化消息内容"""
        if msg_type == 1:
            text = content
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
            return None
        else:
            text = content or "[其他消息]"
        
        return text
    
    def _append_to_crm(self, wxid, name, date, content):
        """追加单条聊天记录到 CRM"""
        url = f"{self.crm_url}/api/wechat/realtime-append"
        headers = {
            'Content-Type': 'application/json',
            'X-Api-Key': self.api_key,
        }
        data = {
            'wxid': wxid,
            'name': name,
            'date': date,
            'content': content,
        }
        
        try:
            response = requests.post(url, json=data, headers=headers, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"上传消息失败: {e}")
            return None
    
    def _batch_upload(self, sessions):
        """批量上传（用于积压消息较多时）"""
        if not sessions:
            return None
        
        url = f"{self.crm_url}/api/wechat/bulk-import"
        headers = {
            'Content-Type': 'application/json',
            'X-Api-Key': self.api_key,
        }
        
        try:
            response = requests.post(url, json={'sessions': sessions}, headers=headers, timeout=60)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"批量上传失败: {e}")
            return None
    
    def _check_wechat_running(self):
        """检查微信是否在运行（Windows）"""
        if sys.platform != 'win32':
            return True
        
        try:
            import subprocess
            result = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq WeChat.exe'], 
                                  capture_output=True, text=True, timeout=5)
            return 'WeChat.exe' in result.stdout
        except:
            return True
    
    def poll_once(self):
        """执行一次轮询"""
        if not self._check_wechat_running():
            logger.warning("微信未运行，等待微信启动...")
            return
        
        contacts = self._get_contacts()
        since_time = self.state.get('last_sync_time', int(time.time()) - 3600)
        
        logger.debug(f"检查 {since_time} 之后的新消息...")
        
        messages = self._get_new_messages(since_time)
        if not messages:
            return
        
        logger.info(f"发现 {len(messages)} 条新消息")
        
        # 按联系人分组
        by_talker = {}
        max_time = since_time
        
        for msg in messages:
            talker = msg['talker']
            create_time = msg['create_time']
            
            if create_time > max_time:
                max_time = create_time
            
            if talker not in by_talker:
                contact = contacts.get(talker, {})
                name = contact.get('remark') or contact.get('nickname') or talker
                by_talker[talker] = {
                    'wxid': talker,
                    'name': name,
                    'daily_msgs': {},
                }
            
            try:
                dt = datetime.fromtimestamp(create_time)
                date_str = dt.strftime('%Y-%m-%d')
                time_str = dt.strftime('%H:%M:%S')
            except:
                continue
            
            text = self._format_content(msg['msg_type'], msg['content'], msg['is_sender'])
            if text is None:
                continue
            
            line = f"[{time_str}] {'我' if msg['is_sender'] else '对方'}：{text}"
            
            if date_str not in by_talker[talker]['daily_msgs']:
                by_talker[talker]['daily_msgs'][date_str] = []
            by_talker[talker]['daily_msgs'][date_str].append(line)
        
        # 如果消息少，逐条追加（实时性好）
        if len(messages) <= 10:
            for talker, data in by_talker.items():
                for date, lines in data['daily_msgs'].items():
                    content = '\n'.join(lines)
                    self._append_to_crm(data['wxid'], data['name'], date, content)
        else:
            # 消息多时批量上传
            sessions = []
            for talker, data in by_talker.items():
                msgs = []
                for date, lines in sorted(data['daily_msgs'].items()):
                    msgs.append({
                        'date': date,
                        'content': '\n'.join(lines),
                        'msg_count': len(lines),
                    })
                sessions.append({
                    'wxid': data['wxid'],
                    'name': data['name'],
                    'messages': msgs,
                })
            
            self._batch_upload(sessions)
        
        # 更新状态
        self.state['last_sync_time'] = max_time
        self._save_state()
        
        logger.info(f"同步完成，已更新到: {datetime.fromtimestamp(max_time).strftime('%Y-%m-%d %H:%M:%S')}")
    
    def run(self):
        """启动监控循环"""
        self.running = True
        logger.info("=" * 50)
        logger.info("微信聊天记录实时监控已启动")
        logger.info(f"微信用户: {self.wx_user}")
        logger.info(f"CRM 地址: {self.crm_url}")
        logger.info(f"轮询间隔: {POLL_INTERVAL} 秒")
        logger.info("=" * 50)
        
        # 先做一次全量同步
        logger.info("执行初始同步...")
        try:
            self.poll_once()
        except Exception as e:
            logger.error(f"初始同步出错: {e}")
        
        # 进入轮询循环
        while self.running:
            try:
                time.sleep(POLL_INTERVAL)
                self.poll_once()
            except KeyboardInterrupt:
                logger.info("收到停止信号...")
                break
            except Exception as e:
                logger.error(f"轮询出错: {e}")
                time.sleep(POLL_INTERVAL)
        
        logger.info("监控已停止")
    
    def stop(self):
        """停止监控"""
        self.running = False


def get_wechat_data_dir():
    """获取微信数据目录"""
    if sys.platform != 'win32':
        return None
    
    documents = Path(os.path.expanduser('~')) / 'Documents'
    wechat_dir = documents / 'WeChat Files'
    if wechat_dir.exists():
        return str(wechat_dir)
    
    # 360文档
    for drive in ['C', 'D', 'E', 'F']:
        doc_path = Path(f'{drive}:\\360MoveData\\Users\\{os.getlogin()}\\Documents\\WeChat Files')
        if doc_path.exists():
            return str(doc_path)
    
    return None


def list_wx_users(data_dir):
    """列出微信用户"""
    users = []
    data_path = Path(data_dir)
    if not data_path.exists():
        return users
    
    for item in data_path.iterdir():
        if item.is_dir() and item.name not in ['All Users', 'Applet']:
            if (item / 'Msg').exists():
                users.append(item.name)
    
    return users


def print_banner():
    """打印启动横幅"""
    print()
    print("=" * 60)
    print("  🐘 小象智能 CRM - 微信聊天记录实时监控")
    print("=" * 60)
    print()
    print("  功能：")
    print("    ✓ 实时监控微信新消息")
    print("    ✓ 自动同步到 CRM 系统")
    print("    ✓ 完全非侵入式（只读不修改）")
    print("    ✓ 断点续传（支持异常恢复）")
    print()


def interactive_setup():
    """交互式配置"""
    print_banner()
    
    # CRM 地址
    default_url = CRM_BASE_URL
    crm_url = input(f"📡 CRM 系统地址 (默认: {default_url}): ").strip()
    if not crm_url:
        crm_url = default_url
    
    # API Key
    api_key = input("🔑 监控 API Key (MONITOR_API_KEY): ").strip()
    if not api_key:
        print("❌ API Key 不能为空")
        return None
    
    # 微信数据目录
    data_dir = get_wechat_data_dir()
    if data_dir:
        print(f"📁 找到微信数据目录: {data_dir}")
        use_default = input("   使用此目录？(Y/n): ").strip().lower()
        if use_default == 'n':
            data_dir = input("   请输入微信数据目录: ").strip()
    else:
        data_dir = input("📁 请输入微信数据目录路径: ").strip()
    
    if not data_dir or not Path(data_dir).exists():
        print("❌ 微信数据目录不存在")
        return None
    
    # 选择微信用户
    users = list_wx_users(data_dir)
    if not users:
        print("❌ 未找到微信用户数据")
        return None
    
    print(f"\n👤 找到 {len(users)} 个微信账号:")
    for i, user in enumerate(users, 1):
        print(f"   {i}. {user}")
    
    user_idx = input(f"\n选择要监控的微信账号 (默认: 1): ").strip()
    try:
        idx = int(user_idx) - 1 if user_idx else 0
    except:
        idx = 0
    
    if idx < 0 or idx >= len(users):
        idx = 0
    
    selected_user = users[idx]
    
    # 数据库密钥
    key_file = Path(__file__).parent / 'wechat_key.txt'
    key = ''
    
    if key_file.exists():
        key = key_file.read_text(encoding='utf-8').strip()
        print(f"\n🔑 从 wechat_key.txt 读取到密钥")
    else:
        key = input("\n🔑 请输入微信数据库密钥: ").strip()
        if not key:
            print("❌ 密钥不能为空")
            return None
        
        save_key = input("   保存密钥到 wechat_key.txt？(Y/n): ").strip().lower()
        if save_key != 'n':
            try:
                key_file.write_text(key, encoding='utf-8')
                print(f"   已保存到 {key_file}")
            except Exception as e:
                print(f"   保存失败: {e}")
    
    # 轮询间隔
    interval = input(f"\n⏱  轮询间隔秒数 (默认: {POLL_INTERVAL}): ").strip()
    if interval:
        try:
            interval = int(interval)
            global POLL_INTERVAL
            POLL_INTERVAL = max(5, interval)
        except:
            pass
    
    print()
    print("✅ 配置完成")
    print()
    
    return {
        'data_dir': data_dir,
        'wx_user': selected_user,
        'db_key': key,
        'crm_url': crm_url,
        'api_key': api_key,
    }


def main():
    # 检查是否有命令行参数（用于无人值守运行）
    if len(sys.argv) > 1 and sys.argv[1] == '--daemon':
        # 守护进程模式，从环境变量读取配置
        data_dir = os.environ.get('WECHAT_DATA_DIR', '')
        wx_user = os.environ.get('WECHAT_USER', '')
        db_key = os.environ.get('WECHAT_DB_KEY', '')
        crm_url = os.environ.get('CRM_BASE_URL', 'http://localhost:3000')
        api_key = os.environ.get('CRM_API_KEY', '')
        
        if not all([data_dir, wx_user, db_key, api_key]):
            logger.error("守护进程模式需要设置环境变量: WECHAT_DATA_DIR, WECHAT_USER, WECHAT_DB_KEY, CRM_API_KEY")
            sys.exit(1)
        
        monitor = WeChatMonitor(data_dir, wx_user, db_key, crm_url, api_key)
        monitor.run()
    else:
        # 交互式模式
        config = interactive_setup()
        if not config:
            input("\n按回车键退出...")
            return
        
        monitor = WeChatMonitor(
            config['data_dir'],
            config['wx_user'],
            config['db_key'],
            config['crm_url'],
            config['api_key'],
        )
        
        try:
            monitor.run()
        except KeyboardInterrupt:
            print("\n")
            logger.info("用户中断，正在停止...")
        except Exception as e:
            logger.error(f"程序异常: {e}")
            import traceback
            traceback.print_exc()
            input("\n按回车键退出...")


if __name__ == '__main__':
    main()
