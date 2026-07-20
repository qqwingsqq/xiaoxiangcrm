'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────
interface ChatRow {
  id: number;
  customer_id: number;
  customer_name: string;
  contact_name: string | null;
  customer_wxid: string | null;
  customer_status: string | null;
  raw_content: string;
  summary: string | null;
  next_meeting: string | null;
  discussed_features: string;
  next_steps: string;
  intent_level: string;
  analysis_status: string;
  chat_date: string | null;
  created_at: string;
  total_chats?: number;
  latest_date?: string | null;
  isNew?: boolean;
}

interface HistoryChat {
  id: number;
  chat_date: string | null;
  created_at: string;
  summary: string | null;
  analysis_status: string;
  raw_content: string;
}

interface PendingContact {
  id: number;
  name: string;
  contact_info: string;
  chat_count: number;
  created_at: string;
  latest_chat: string | null;
  latest_date: string | null;
}

interface CustomerSearchResult {
  id: number;
  name: string;
  type: string | null;
  contact_info: string | null;
}

interface BlocklistItem { id: number; wxid: string; name: string; created_at: string; }

// ── Constants ─────────────────────────────────────────────────
const INTENT: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  hot:     { label: '意向强烈', color: '#f97316', bg: 'rgba(249,115,22,0.12)',  dot: '#f97316' },
  warm:    { label: '有兴趣',   color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  dot: '#fbbf24' },
  cold:    { label: '暂无意向', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', dot: '#6b7280' },
  unknown: { label: '未分析',   color: '#4b5563', bg: 'rgba(75,85,99,0.08)',    dot: '#374151' },
};

function parseJson(s: string, fallback: string[] = []): string[] {
  try { return JSON.parse(s) || fallback; } catch { return fallback; }
}
function isGroupChat(wxid: string | null) {
  return wxid?.includes('@chatroom') || wxid?.includes('@im.chatroom');
}
function displayName(chat: ChatRow): string {
  if (chat.contact_name && chat.contact_name.trim()) return chat.contact_name.trim();
  return chat.customer_name;
}

// 从 raw_content 中提取我方和对方各自最后一条消息
function extractLastMessages(raw: string): { lastMine: string | null; lastTheirs: string | null } {
  const lines = raw.split('\n').filter(l => l.trim());
  let lastMine: string | null = null;
  let lastTheirs: string | null = null;
  for (const line of lines) {
    const m = line.match(/^\[[\d:]+\]\s*(我|对方)[:：]\s*(.+)$/);
    if (!m) continue;
    if (m[1] === '我') lastMine = m[2].trim();
    else lastTheirs = m[2].trim();
  }
  return { lastMine, lastTheirs };
}

// ── ChatPreview（待关联弹窗里的聊天快照）────────────────────────
function ChatPreview({ raw }: { raw: string }) {
  const [expanded, setExpanded] = useState(false);
  const allLines = raw.split('\n').filter(l => l.trim());
  const lines = allLines.slice(0, expanded ? 50 : 8);
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#0f0f11', border: '1px solid #222' }}>
      <div className="px-3 py-2 space-y-1">
        {lines.map((line, i) => {
          const m = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(我|对方)[:：]\s*(.+)$/);
          if (m) {
            const isMe = m[2] === '我';
            return (
              <div key={i} className={`flex gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                <span className="text-[10px] flex-shrink-0 mt-0.5" style={{ color: isMe ? '#60a5fa' : '#4ade80' }}>
                  {isMe ? '我' : '他'}
                </span>
                <span className="text-xs text-zinc-300 leading-relaxed">{m[3]}</span>
                <span className="text-[10px] text-zinc-700 flex-shrink-0 mt-0.5">{m[1]}</span>
              </div>
            );
          }
          return <p key={i} className="text-xs text-zinc-600">{line}</p>;
        })}
      </div>
      {allLines.length > 8 && (
        <button onClick={() => setExpanded(e => !e)}
          className="w-full py-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors border-t"
          style={{ borderColor: '#222' }}>
          {expanded ? '收起' : `展开全部 ${allLines.length} 条`}
        </button>
      )}
    </div>
  );
}

// ── PendingContactsModal ──────────────────────────────────────
function PendingContactsModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [contacts, setContacts] = useState<PendingContact[]>([]);
  const [loading, setLoading]   = useState(true);
  const [mode, setMode]         = useState<Record<number, 'idle' | 'link' | 'rename'>>({});
  const [renameVal, setRenameVal] = useState<Record<number, string>>({});
  const [searchQ, setSearchQ]   = useState<Record<number, string>>({});
  const [searchRes, setSearchRes] = useState<Record<number, CustomerSearchResult[]>>({});
  const [searching, setSearching] = useState<Record<number, boolean>>({});
  const [working, setWorking]   = useState<Record<number, boolean>>({});

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/wechat/pending-contacts');
    setContacts(await res.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const searchCustomers = async (contactId: number, q: string) => {
    setSearchQ(prev => ({ ...prev, [contactId]: q }));
    if (q.trim().length < 1) { setSearchRes(prev => ({ ...prev, [contactId]: [] })); return; }
    setSearching(prev => ({ ...prev, [contactId]: true }));
    const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}&limit=8`);
    const data = await res.json();
    setSearchRes(prev => ({ ...prev, [contactId]: data.customers || data }));
    setSearching(prev => ({ ...prev, [contactId]: false }));
  };

  const doLink = async (contact: PendingContact, targetId: number, targetName: string) => {
    if (!confirm(`将微信号 ${contact.contact_info} 的聊天记录合并到「${targetName}」？原条目将被删除。`)) return;
    setWorking(prev => ({ ...prev, [contact.id]: true }));
    await fetch('/api/wechat/link-contact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'link', source_customer_id: contact.id, target_customer_id: targetId }),
    });
    setContacts(prev => prev.filter(c => c.id !== contact.id));
    setWorking(prev => ({ ...prev, [contact.id]: false }));
    onDone();
  };

  const doBlock = async (contact: PendingContact) => {
    setWorking(prev => ({ ...prev, [contact.id]: true }));
    await fetch('/api/wechat/blocklist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wxid: contact.contact_info, name: contact.name }),
    });
    setContacts(prev => prev.filter(c => c.id !== contact.id));
    setWorking(prev => ({ ...prev, [contact.id]: false }));
    onDone();
  };

  const doRename = async (contact: PendingContact) => {
    const name = renameVal[contact.id]?.trim();
    if (!name) return;
    setWorking(prev => ({ ...prev, [contact.id]: true }));
    try {
      const res = await fetch('/api/wechat/link-contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', customer_id: contact.id, name }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`保存失败：${data.error || res.status}`); return; }
      setContacts(prev => prev.filter(c => c.id !== contact.id));
      onDone();
    } catch (e) {
      alert(`网络错误：${e}`);
    } finally {
      setWorking(prev => ({ ...prev, [contact.id]: false }));
    }
  };

  const inputCls = 'w-full px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const inputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: '85vh' }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-base font-semibold text-white">👤 待关联微信联系人</h2>
            <p className="text-xs text-zinc-500 mt-0.5">这些联系人名字未识别，请关联到已有客户或设置名字</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg ml-4">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {loading ? (
            <p className="text-sm text-zinc-600 text-center py-8">加载中...</p>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-8">🎉 所有联系人已关联，无待处理项</p>
          ) : contacts.map(contact => {
            const m = mode[contact.id] || 'idle';
            const busy = working[contact.id];
            return (
              <div key={contact.id} className="rounded-xl p-4 space-y-3"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-400 truncate">{contact.contact_info}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{contact.chat_count} 条聊天 · {(contact.latest_date || contact.created_at).substring(0, 10)}</p>
                  </div>
                  {m === 'idle' && (
                    <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                      <button onClick={() => setMode(prev => ({ ...prev, [contact.id]: 'link' }))}
                        className="text-xs px-2.5 py-1 rounded-lg font-medium text-white"
                        style={{ background: '#1d4ed8' }}>关联客户</button>
                      <button onClick={() => setMode(prev => ({ ...prev, [contact.id]: 'rename' }))}
                        className="text-xs px-2.5 py-1 rounded-lg font-medium text-zinc-300"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)' }}>新客户</button>
                      <button onClick={() => doBlock(contact)} disabled={busy}
                        className="text-xs px-2.5 py-1 rounded-lg font-medium disabled:opacity-50"
                        style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171' }}>🚫 屏蔽</button>
                    </div>
                  )}
                </div>
                {contact.latest_chat && <ChatPreview raw={contact.latest_chat} />}
                {m === 'link' && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-400">搜索已有客户，将此联系人的聊天记录合并过去：</p>
                    <input type="text" placeholder="输入客户名搜索..."
                      value={searchQ[contact.id] || ''}
                      onChange={e => searchCustomers(contact.id, e.target.value)}
                      className={inputCls} style={inputStyle} autoFocus />
                    {searching[contact.id] && <p className="text-xs text-zinc-600">搜索中...</p>}
                    {(searchRes[contact.id] || []).map(c => (
                      <button key={c.id} disabled={busy} onClick={() => doLink(contact, c.id, c.name)}
                        className="w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between gap-2 disabled:opacity-50"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <div>
                          <p className="text-sm text-white">{c.name}</p>
                          {c.contact_info && <p className="text-xs text-zinc-600">{c.contact_info}</p>}
                        </div>
                        <span className="text-xs text-blue-400 flex-shrink-0">合并 →</span>
                      </button>
                    ))}
                    <button onClick={() => setMode(prev => ({ ...prev, [contact.id]: 'idle' }))}
                      className="text-xs text-zinc-600 hover:text-zinc-400">取消</button>
                  </div>
                )}
                {m === 'rename' && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-400">输入这个联系人的真实姓名，作为新客户保存：</p>
                    <div className="flex gap-2">
                      <input type="text" placeholder="客户姓名"
                        value={renameVal[contact.id] || ''}
                        onChange={e => setRenameVal(prev => ({ ...prev, [contact.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && doRename(contact)}
                        className={inputCls} style={inputStyle} autoFocus />
                      <button disabled={busy || !renameVal[contact.id]?.trim()}
                        onClick={() => doRename(contact)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex-shrink-0"
                        style={{ background: '#16a34a' }}>{busy ? '…' : '确认'}</button>
                    </div>
                    <button onClick={() => setMode(prev => ({ ...prev, [contact.id]: 'idle' }))}
                      className="text-xs text-zinc-600 hover:text-zinc-400">取消</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function WeChatDashboard() {
  const [chats, setChats]           = useState<ChatRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [chatType, setChatType]     = useState<'all' | 'private' | 'group'>('all');
  const [search, setSearch]         = useState('');
  const [newCount, setNewCount]     = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [showPending, setShowPending]   = useState(false);
  const [showBlocklist, setShowBlocklist] = useState(false);
  const [blocklist, setBlocklist]   = useState<BlocklistItem[]>([]);
  const [blWxid, setBlWxid]         = useState('');
  const [blName, setBlName]         = useState('');
  const [organizing, setOrganizing] = useState(false);
  const [orgProgress, setOrgProgress] = useState<{ done: number; remaining: number } | null>(null);
  // 微信同步说明：手机端通过 realtime-append API 实时推送，无需手动触发
  // 历史记录展开状态
  const [expandedHistory, setExpandedHistory] = useState<number | null>(null);
  const [history, setHistory]       = useState<Record<number, HistoryChat[]>>({});
  const [historyLoading, setHistoryLoading] = useState<Record<number, boolean>>({});
  const lastCheckRef = useRef<string>(new Date().toISOString());

  const loadChats = useCallback(() => {
    fetch('/api/wechat-chats')
      .then(r => r.json())
      .then((d: ChatRow[]) => { setChats(d); setLoading(false); });
  }, []);

  const loadPendingCount = useCallback(() => {
    fetch('/api/wechat/pending-contacts')
      .then(r => r.json())
      .then((d: PendingContact[]) => setPendingCount(d.length));
  }, []);

  useEffect(() => { loadChats(); loadPendingCount(); }, [loadChats, loadPendingCount]);

  useEffect(() => {
    const poll = setInterval(async () => {
      const since = lastCheckRef.current;
      lastCheckRef.current = new Date().toISOString();
      const res  = await fetch(`/api/wechat-chats?since=${encodeURIComponent(since)}`);
      const rows = await res.json() as ChatRow[];
      if (rows.length > 0) {
        setNewCount(n => n + rows.length);
        setChats(prev => {
          const ids = new Set(prev.map(c => c.id));
          const fresh = rows.filter(r => !ids.has(r.id)).map(r => ({ ...r, isNew: true }));
          return [...fresh, ...prev];
        });
        loadPendingCount();
      }
    }, 30_000);
    return () => clearInterval(poll);
  }, [loadPendingCount]);

  const toggleHistory = useCallback(async (customerId: number) => {
    if (expandedHistory === customerId) {
      setExpandedHistory(null);
      return;
    }
    setExpandedHistory(customerId);
    if (!history[customerId]) {
      setHistoryLoading(prev => ({ ...prev, [customerId]: true }));
      const res  = await fetch(`/api/customers/${customerId}/wechat-chats`);
      const data = await res.json() as HistoryChat[];
      setHistory(prev => ({ ...prev, [customerId]: data }));
      setHistoryLoading(prev => ({ ...prev, [customerId]: false }));
    }
  }, [expandedHistory, history]);

  const organizeAll = useCallback(async () => {
    setOrganizing(true);
    setOrgProgress({ done: 0, remaining: 0 });
    let totalDone = 0;
    while (true) {
      try {
        const res = await fetch('/api/wechat/batch-analyze', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_size: 8 }),
        });
        const data = await res.json();
        totalDone += data.processed ?? 0;
        setOrgProgress({ done: totalDone, remaining: data.remaining ?? 0 });
        if (data.done || data.remaining === 0) break;
        await new Promise(r => setTimeout(r, 800));
      } catch { break; }
    }
    setOrganizing(false);
    loadChats();
  }, [loadChats]);

  const loadBlocklist = useCallback(() => {
    fetch('/api/wechat/blocklist').then(r => r.json()).then(setBlocklist);
  }, []);
  useEffect(() => { if (showBlocklist) loadBlocklist(); }, [showBlocklist, loadBlocklist]);

  // 同步功能说明：微信聊天记录由手机端通过 realtime-append API 实时推送到服务端
  // 页面每5秒自动轮询新消息，无需手动同步

  const addToBlocklist = async () => {
    if (!blWxid.trim()) return;
    await fetch('/api/wechat/blocklist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wxid: blWxid.trim(), name: blName.trim() || blWxid.trim() }),
    });
    setBlWxid(''); setBlName('');
    loadBlocklist();
  };

  const removeFromBlocklist = async (wxid: string) => {
    await fetch('/api/wechat/blocklist', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wxid }),
    });
    loadBlocklist();
  };

  const filtered = chats.filter(c => {
    if (chatType === 'private' && isGroupChat(c.customer_wxid)) return false;
    if (chatType === 'group' && !isGroupChat(c.customer_wxid)) return false;
    if (filter !== 'all' && c.intent_level !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return displayName(c).toLowerCase().includes(q) ||
        c.customer_name.toLowerCase().includes(q) ||
        (c.contact_name || '').toLowerCase().includes(q) ||
        (c.summary || '').toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: chats.length,
    hot: chats.filter(c => c.intent_level === 'hot').length,
    warm: chats.filter(c => c.intent_level === 'warm').length,
    withMeeting: chats.filter(c => c.next_meeting).length,
  };

  return (
    <div className="space-y-5">
      {newCount > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981' }}>
          <span className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#10b981' }} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#10b981' }} />
            </span>
            新增 {newCount} 条微信消息已同步
          </span>
          <button onClick={() => setNewCount(0)} className="text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8.5 4a6.5 6.5 0 00-3.5 12.01V19l2.7-1.35A6.5 6.5 0 108.5 4zm8 3.5a5 5 0 100 10 5 5 0 000-10z" />
            </svg>
            微信聊天跟进看板
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">汇总所有客户的微信沟通记录与AI提炼结果</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <button onClick={() => setShowPending(true)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium relative"
              style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24' }}>
              👤 待关联
              <span className="ml-1.5 text-[10px] px-1 rounded-full font-bold"
                style={{ background: '#fbbf24', color: '#000' }}>{pendingCount}</span>
            </button>
          )}
          <button onClick={() => setShowBlocklist(true)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium text-zinc-400 hover:text-white"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
            🚫 屏蔽名单
          </button>
          <button onClick={organizeAll} disabled={organizing}
            className="text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-60 flex items-center gap-1.5"
            style={{ background: organizing ? '#1a3a1a' : '#16a34a', border: organizing ? '1px solid #16a34a' : 'none' }}>
            {organizing ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                整理中 {orgProgress ? `${orgProgress.done}条 剩余${orgProgress.remaining}` : ''}
              </>
            ) : '✨ 一键整理聊天记录'}
          </button>
          <Link href="/customers"
            className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
            ← 返回
          </Link>
        </div>
      </div>

      {/* 类型切换 */}
      <div className="flex gap-2">
        {([
          { key: 'all',     label: '全部',   icon: '💬' },
          { key: 'private', label: '联系人', icon: '👤' },
          { key: 'group',   label: '微信群', icon: '👥' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setChatType(t.key)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5"
            style={{
              background: chatType === t.key ? 'rgba(96,165,250,0.15)' : 'var(--bg-input)',
              color: chatType === t.key ? '#60a5fa' : 'var(--text-muted)',
              border: `1px solid ${chatType === t.key ? '#60a5fa' : 'var(--border)'}`,
            }}>
            <span>{t.icon}</span>{t.label}
            <span className="ml-1 text-[10px] opacity-60">
              {t.key === 'all' ? chats.length
                : t.key === 'private' ? chats.filter(c => !isGroupChat(c.customer_wxid)).length
                : chats.filter(c => isGroupChat(c.customer_wxid)).length}
            </span>
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '聊天记录',  value: stats.total,       color: '#60a5fa' },
          { label: '意向强烈',  value: stats.hot,         color: '#f97316' },
          { label: '有兴趣',    value: stats.warm,        color: '#fbbf24' },
          { label: '有见面计划', value: stats.withMeeting, color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter & search */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="text" placeholder="搜索客户名、摘要..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-green-500"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        {(['all', 'hot', 'warm', 'cold'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{
              background: filter === f ? (f === 'all' ? '#1d4ed8' : INTENT[f]?.bg) : 'var(--bg-input)',
              color: filter === f ? (f === 'all' ? 'white' : INTENT[f]?.color) : 'var(--text-muted)',
              border: `1px solid ${filter === f ? (f === 'all' ? '#1d4ed8' : INTENT[f]?.dot) : 'var(--border)'}`,
            }}>
            {f === 'all' ? '全部' : INTENT[f]?.label}
          </button>
        ))}
      </div>

      {/* Chat list */}
      {loading ? (
        <div className="text-center py-16 text-zinc-600">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl text-zinc-600"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {chats.length === 0 ? '暂无微信聊天记录' : '没有符合条件的记录'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(chat => {
            const intent   = INTENT[chat.intent_level] || INTENT.unknown;
            const name     = displayName(chat);
            const { lastMine, lastTheirs } = extractLastMessages(chat.raw_content);
            const isHistOpen = expandedHistory === chat.customer_id;
            const histData   = history[chat.customer_id] || [];
            const histBusy   = historyLoading[chat.customer_id];
            const totalChats = chat.total_chats ?? 0;

            return (
              <div key={chat.id} className="rounded-xl overflow-hidden"
                style={{
                  background: chat.isNew ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)',
                  border: `1px solid ${chat.isNew ? 'rgba(16,185,129,0.45)' : 'var(--border)'}`,
                }}>
                {chat.isNew && (
                  <div className="px-4 pt-2.5 pb-0 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#10b981' }} />
                      <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#10b981' }} />
                    </span>
                    <span className="text-xs font-medium" style={{ color: '#10b981' }}>新消息</span>
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {/* ── 顶部：姓名 + 意向 + 日期 ── */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link href={`/customers/${chat.customer_id}`}
                        className="text-sm font-semibold text-blue-400 hover:text-blue-300 truncate">
                        {name}
                      </Link>
                      <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: intent.bg, color: intent.color }}>
                        <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: intent.dot, verticalAlign: 'middle', marginRight: 4 }} />
                        {intent.label}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-600 flex-shrink-0">
                      {(chat.chat_date || chat.created_at).substring(0, 10)}
                    </span>
                  </div>

                  {/* ── 最新总结 ── */}
                  {chat.analysis_status === 'done' && chat.summary ? (
                    <div className="text-xs leading-relaxed p-2.5 rounded-lg"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                      {chat.summary}
                    </div>
                  ) : chat.analysis_status !== 'done' ? (
                    <p className="text-xs text-zinc-700 italic">待分析…</p>
                  ) : null}

                  {/* ── 最后一条消息 ── */}
                  {(lastMine || lastTheirs) && (
                    <div className="space-y-1.5">
                      {lastMine && (
                        <div className="flex gap-2 items-start text-xs">
                          <span className="text-blue-400 font-medium flex-shrink-0 w-7">我:</span>
                          <span className="text-zinc-400 line-clamp-2 leading-relaxed">{lastMine}</span>
                        </div>
                      )}
                      {lastTheirs ? (
                        <div className="flex gap-2 items-start text-xs">
                          <span className="text-green-400 font-medium flex-shrink-0 w-7">对方:</span>
                          <span className="text-zinc-400 line-clamp-2 leading-relaxed">{lastTheirs}</span>
                        </div>
                      ) : lastMine ? (
                        <div className="flex gap-2 items-start text-xs">
                          <span className="text-zinc-600 font-medium flex-shrink-0 w-7">对方:</span>
                          <span className="text-zinc-700">未回复</span>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* ── 见面计划 ── */}
                  {chat.next_meeting && (
                    <p className="text-xs text-emerald-400">🗓 {chat.next_meeting}</p>
                  )}

                  {/* ── 底部操作 ── */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => toggleHistory(chat.customer_id)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors"
                      style={{
                        background: isHistOpen ? 'rgba(96,165,250,0.1)' : 'var(--bg-input)',
                        color: isHistOpen ? '#60a5fa' : 'var(--text-muted)',
                        border: `1px solid ${isHistOpen ? 'rgba(96,165,250,0.3)' : 'var(--border)'}`,
                      }}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      历史记录{totalChats > 1 ? `（${totalChats}条）` : ''}
                    </button>
                    <Link href={`/customers/${chat.customer_id}`}
                      className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                      style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      客户详情 →
                    </Link>
                  </div>
                </div>

                {/* ── 历史记录展开 ── */}
                {isHistOpen && (
                  <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs font-medium text-zinc-500 mb-2.5">📋 历史聊天摘要</p>
                    {histBusy ? (
                      <p className="text-xs text-zinc-700 py-2">加载中…</p>
                    ) : histData.length === 0 ? (
                      <p className="text-xs text-zinc-700 py-2">暂无历史记录</p>
                    ) : (
                      <div className="space-y-2">
                        {histData.map((h, idx) => (
                          <div key={h.id}
                            className="flex gap-3 p-2.5 rounded-lg"
                            style={{
                              background: idx === 0 ? 'rgba(96,165,250,0.06)' : 'var(--bg-input)',
                              border: `1px solid ${idx === 0 ? 'rgba(96,165,250,0.2)' : 'var(--border)'}`,
                            }}>
                            <div className="flex-shrink-0 text-right" style={{ minWidth: 72 }}>
                              <p className="text-[10px] text-zinc-600">
                                {(h.chat_date || h.created_at).substring(0, 10)}
                              </p>
                              {idx === 0 && (
                                <span className="text-[9px] px-1 rounded" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>最新</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              {h.analysis_status === 'done' && h.summary ? (
                                <p className="text-xs text-zinc-400 leading-relaxed">{h.summary}</p>
                              ) : (
                                <p className="text-xs text-zinc-700 italic">未分析</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pending modal */}
      {showPending && (
        <PendingContactsModal
          onClose={() => setShowPending(false)}
          onDone={() => { loadPendingCount(); loadChats(); }}
        />
      )}

      {/* Blocklist modal */}
      {showBlocklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowBlocklist(false); }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">🚫 屏蔽名单</h2>
              <button onClick={() => setShowBlocklist(false)} className="text-zinc-500 hover:text-white text-lg">✕</button>
            </div>
            <p className="text-xs text-zinc-500">名单内的微信号不会被自动收集聊天记录</p>
            <div className="space-y-2">
              <input type="text" placeholder="微信号 / wxid（必填）"
                value={blWxid} onChange={e => setBlWxid(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
              <input type="text" placeholder="备注名（选填）"
                value={blName} onChange={e => setBlName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
              <button onClick={addToBlocklist}
                className="w-full py-2 rounded-lg text-sm font-medium text-white hover:opacity-90"
                style={{ background: '#dc2626' }}>
                添加到屏蔽名单
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {blocklist.length === 0
                ? <p className="text-xs text-zinc-600 text-center py-4">暂无屏蔽名单</p>
                : blocklist.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                    <div>
                      <p className="text-sm text-zinc-300">{item.name}</p>
                      <p className="text-xs text-zinc-600">{item.wxid}</p>
                    </div>
                    <button onClick={() => removeFromBlocklist(item.wxid)}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/20">
                      移除
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
