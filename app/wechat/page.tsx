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
  isNew?: boolean;
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
function bestName(chat: ChatRow): string {
  const hasChinese = (s: string) => /[一-鿿]/.test(s);
  if (hasChinese(chat.customer_name)) return chat.customer_name;
  if (chat.contact_name && hasChinese(chat.contact_name)) return chat.contact_name;
  return chat.customer_name;
}

// ── ChatPreview（待关联弹窗里的聊天快照）────────────────────────
function ChatPreview({ raw }: { raw: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = raw.split('\n').filter(l => l.trim()).slice(0, expanded ? 30 : 6);
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
      {raw.split('\n').filter(l => l.trim()).length > 6 && (
        <button onClick={() => setExpanded(e => !e)}
          className="w-full py-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors border-t"
          style={{ borderColor: '#222' }}>
          {expanded ? '收起' : `展开全部 ${raw.split('\n').filter(l=>l.trim()).length} 条`}
        </button>
      )}
    </div>
  );
}

// ── PendingContactsModal ──────────────────────────────────────
function PendingContactsModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [contacts, setContacts] = useState<PendingContact[]>([]);
  const [loading, setLoading]   = useState(true);

  // per-contact UI state
  const [mode, setMode]               = useState<Record<number, 'idle' | 'link' | 'rename'>>({});
  const [renameVal, setRenameVal]     = useState<Record<number, string>>({});
  const [searchQ, setSearchQ]         = useState<Record<number, string>>({});
  const [searchRes, setSearchRes]     = useState<Record<number, CustomerSearchResult[]>>({});
  const [searching, setSearching]     = useState<Record<number, boolean>>({});
  const [working, setWorking]         = useState<Record<number, boolean>>({});

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
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'link', source_customer_id: contact.id, target_customer_id: targetId }),
    });
    setContacts(prev => prev.filter(c => c.id !== contact.id));
    setWorking(prev => ({ ...prev, [contact.id]: false }));
    onDone();
  };

  const doRename = async (contact: PendingContact) => {
    const name = renameVal[contact.id]?.trim();
    if (!name) return;
    setWorking(prev => ({ ...prev, [contact.id]: true }));
    await fetch('/api/wechat/link-contact', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'rename', customer_id: contact.id, name }),
    });
    setContacts(prev => prev.filter(c => c.id !== contact.id));
    setWorking(prev => ({ ...prev, [contact.id]: false }));
    onDone();
  };

  const inputCls = 'w-full px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const inputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col" style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: '85vh',
      }}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-base font-semibold text-white">👤 待关联微信联系人</h2>
            <p className="text-xs text-zinc-500 mt-0.5">这些联系人名字未识别，请关联到已有客户或设置名字</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg ml-4">✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {loading ? (
            <p className="text-sm text-zinc-600 text-center py-8">加载中...</p>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-8">🎉 所有联系人已关联，无待处理项</p>
          ) : contacts.map(contact => {
            const m   = mode[contact.id] || 'idle';
            const busy = working[contact.id];
            return (
              <div key={contact.id} className="rounded-xl p-4 space-y-3"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>

                {/* Contact info + chat preview */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-400 truncate">{contact.contact_info}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{contact.chat_count} 条聊天 · {(contact.latest_date || contact.created_at).substring(0, 10)}</p>
                  </div>
                  {m === 'idle' && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => setMode(prev => ({ ...prev, [contact.id]: 'link' }))}
                        className="text-xs px-2.5 py-1 rounded-lg font-medium text-white transition-colors"
                        style={{ background: '#1d4ed8' }}>
                        关联客户
                      </button>
                      <button onClick={() => setMode(prev => ({ ...prev, [contact.id]: 'rename' }))}
                        className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors text-zinc-300"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)' }}>
                        新客户
                      </button>
                    </div>
                  )}
                </div>
                {/* Chat preview — always visible so user can identify who this is */}
                {contact.latest_chat && (
                  <ChatPreview raw={contact.latest_chat} />
                )}

                {/* Link mode: search existing customer */}
                {m === 'link' && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-400">搜索已有客户，将此联系人的聊天记录合并过去：</p>
                    <input
                      type="text"
                      placeholder="输入客户名搜索..."
                      value={searchQ[contact.id] || ''}
                      onChange={e => searchCustomers(contact.id, e.target.value)}
                      className={inputCls} style={inputStyle}
                      autoFocus
                    />
                    {searching[contact.id] && (
                      <p className="text-xs text-zinc-600">搜索中...</p>
                    )}
                    {(searchRes[contact.id] || []).map(c => (
                      <button key={c.id} disabled={busy}
                        onClick={() => doLink(contact, c.id, c.name)}
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
                      className="text-xs text-zinc-600 hover:text-zinc-400">
                      取消
                    </button>
                  </div>
                )}

                {/* Rename mode: set display name */}
                {m === 'rename' && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-400">输入这个联系人的真实姓名，作为新客户保存：</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="客户姓名"
                        value={renameVal[contact.id] || ''}
                        onChange={e => setRenameVal(prev => ({ ...prev, [contact.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && doRename(contact)}
                        className={inputCls} style={inputStyle}
                        autoFocus
                      />
                      <button disabled={busy || !renameVal[contact.id]?.trim()}
                        onClick={() => doRename(contact)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex-shrink-0"
                        style={{ background: '#16a34a' }}>
                        {busy ? '…' : '确认'}
                      </button>
                    </div>
                    <button onClick={() => setMode(prev => ({ ...prev, [contact.id]: 'idle' }))}
                      className="text-xs text-zinc-600 hover:text-zinc-400">
                      取消
                    </button>
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
  const [expanded, setExpanded]     = useState<number | null>(null);
  const [newCount, setNewCount]     = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [showPending, setShowPending]   = useState(false);
  const [showBlocklist, setShowBlocklist] = useState(false);
  const [blocklist, setBlocklist]   = useState<BlocklistItem[]>([]);
  const [blWxid, setBlWxid]         = useState('');
  const [blName, setBlName]         = useState('');
  const [organizing, setOrganizing] = useState(false);
  const [orgProgress, setOrgProgress] = useState<{ done: number; remaining: number } | null>(null);
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

  useEffect(() => {
    loadChats();
    loadPendingCount();
  }, [loadChats, loadPendingCount]);

  // Poll every 30s for new messages
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
        loadPendingCount(); // new contacts may have appeared
      }
    }, 30_000);
    return () => clearInterval(poll);
  }, [loadPendingCount]);

  const organizeAll = useCallback(async () => {
    setOrganizing(true);
    setOrgProgress({ done: 0, remaining: 0 });
    let totalDone = 0;
    while (true) {
      try {
        const res = await fetch('/api/wechat/batch-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

  const addToBlocklist = async () => {
    if (!blWxid.trim()) return;
    await fetch('/api/wechat/blocklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wxid: blWxid.trim(), name: blName.trim() || blWxid.trim() }),
    });
    setBlWxid(''); setBlName('');
    loadBlocklist();
  };

  const removeFromBlocklist = async (wxid: string) => {
    await fetch('/api/wechat/blocklist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
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
      return c.customer_name.toLowerCase().includes(q) ||
        (c.summary || '').toLowerCase().includes(q) ||
        (c.contact_name || '').toLowerCase().includes(q);
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
      {/* New message banner */}
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
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors relative"
              style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24' }}>
              👤 待关联
              <span className="ml-1.5 text-[10px] px-1 rounded-full font-bold"
                style={{ background: '#fbbf24', color: '#000' }}>{pendingCount}</span>
            </button>
          )}
          <button onClick={() => setShowBlocklist(true)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors text-zinc-400 hover:text-white"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
            🚫 屏蔽名单
          </button>
          <button onClick={organizeAll} disabled={organizing}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors text-white disabled:opacity-60 flex items-center gap-1.5"
            style={{ background: organizing ? '#1a3a1a' : '#16a34a', border: organizing ? '1px solid #16a34a' : 'none' }}>
            {organizing ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                整理中 {orgProgress ? `${orgProgress.done}条 剩余${orgProgress.remaining}` : ''}
              </>
            ) : '✨ 一键整理聊天记录'}
          </button>
          <Link href="/customers"
            className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors"
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
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5"
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
            className="text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
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
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-12 gap-3 px-4 pb-1 text-xs text-zinc-600 font-medium">
            <div className="col-span-2">客户</div>
            <div className="col-span-1">意向</div>
            <div className="col-span-3">聊天摘要</div>
            <div className="col-span-2">下次见面</div>
            <div className="col-span-2">功能需求</div>
            <div className="col-span-1">日期</div>
            <div className="col-span-1">操作</div>
          </div>

          {filtered.map(chat => {
            const intent     = INTENT[chat.intent_level] || INTENT.unknown;
            const features   = parseJson(chat.discussed_features);
            const steps      = parseJson(chat.next_steps);
            const isExpanded = expanded === chat.id;

            return (
              <div key={chat.id} className="rounded-xl overflow-hidden transition-all"
                style={{
                  background: chat.isNew ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)',
                  border: `1px solid ${chat.isNew ? 'rgba(16,185,129,0.45)' : 'var(--border)'}`,
                  boxShadow: chat.isNew ? '0 0 0 1px rgba(16,185,129,0.2)' : undefined,
                }}>
                {chat.isNew && (
                  <div className="px-4 pt-2 pb-0 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#10b981' }} />
                      <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#10b981' }} />
                    </span>
                    <span className="text-xs font-medium" style={{ color: '#10b981' }}>新消息</span>
                  </div>
                )}
                <div className="grid grid-cols-12 gap-3 px-4 py-3 items-start">
                  <div className="col-span-12 sm:col-span-2">
                    <Link href={`/customers/${chat.customer_id}`}
                      className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
                      {bestName(chat)}
                    </Link>
                    {/* 若 customer_name 和 bestName 不同，显示原始 wxid 作为副标题 */}
                    {bestName(chat) !== chat.customer_name && (
                      <p className="text-xs text-zinc-600 truncate">{chat.customer_name}</p>
                    )}
                  </div>
                  <div className="col-span-4 sm:col-span-1">
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: intent.bg, color: intent.color }}>
                      <span className="mr-1" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: intent.dot, verticalAlign: 'middle' }} />
                      {intent.label}
                    </span>
                  </div>
                  <div className="col-span-8 sm:col-span-3">
                    {chat.analysis_status === 'done' && chat.summary ? (
                      <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2">{chat.summary}</p>
                    ) : (
                      <p className="text-xs text-zinc-600 line-clamp-2">{chat.raw_content.substring(0, 60)}…</p>
                    )}
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    {chat.next_meeting
                      ? <span className="text-xs text-emerald-400">🗓 {chat.next_meeting}</span>
                      : <span className="text-xs text-zinc-700">—</span>}
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    {features.length > 0 ? (
                      <ul className="space-y-0.5">
                        {features.slice(0, 2).map((f, i) => (
                          <li key={i} className="text-xs text-zinc-400 flex gap-1 items-start">
                            <span className="text-zinc-600 flex-shrink-0">·</span>
                            <span className="line-clamp-1">{f}</span>
                          </li>
                        ))}
                        {features.length > 2 && <li className="text-xs text-zinc-600">+{features.length - 2} 项</li>}
                      </ul>
                    ) : <span className="text-xs text-zinc-700">—</span>}
                  </div>
                  <div className="col-span-6 sm:col-span-1">
                    <p className="text-xs text-zinc-600">{(chat.chat_date || chat.created_at).substring(0, 10)}</p>
                  </div>
                  <div className="col-span-6 sm:col-span-1 flex items-center gap-1">
                    {chat.analysis_status === 'done' && (
                      <button onClick={() => setExpanded(isExpanded ? null : chat.id)}
                        className="text-xs px-2 py-1 rounded text-blue-400 hover:bg-zinc-800 transition-colors">
                        {isExpanded ? '收起' : '展开'}
                      </button>
                    )}
                    <Link href={`/customers/${chat.customer_id}`}
                      className="text-xs px-2 py-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
                      详情
                    </Link>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t grid sm:grid-cols-2 gap-4" style={{ borderColor: 'var(--border)' }}>
                    {steps.length > 0 && (
                      <div className="pt-3">
                        <p className="text-xs font-medium text-zinc-400 mb-2">📋 下一步计划</p>
                        <ul className="space-y-1.5">
                          {steps.map((s, i) => (
                            <li key={i} className="text-xs flex gap-2 p-2 rounded-lg"
                              style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
                              <span className="text-emerald-400">→</span>
                              <span className="text-zinc-300">{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {features.length > 0 && (
                      <div className="pt-3">
                        <p className="text-xs font-medium text-zinc-400 mb-2">🔧 完整功能需求</p>
                        <ul className="space-y-1">
                          {features.map((f, i) => (
                            <li key={i} className="text-xs flex gap-2">
                              <span className="text-blue-400">{i + 1}.</span>
                              <span className="text-zinc-300">{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pending contacts modal */}
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
                className="w-full py-2 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90"
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
