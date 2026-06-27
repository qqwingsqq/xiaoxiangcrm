'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface ChatRow {
  id: number;
  customer_id: number;
  customer_name: string;
  contact_name: string | null;
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

interface BlocklistItem { id: number; wxid: string; name: string; created_at: string; }

const INTENT: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  hot:     { label: '意向强烈', color: '#f97316', bg: 'rgba(249,115,22,0.12)',  dot: '#f97316' },
  warm:    { label: '有兴趣',   color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  dot: '#fbbf24' },
  cold:    { label: '暂无意向', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', dot: '#6b7280' },
  unknown: { label: '未分析',   color: '#4b5563', bg: 'rgba(75,85,99,0.08)',    dot: '#374151' },
};

function parseJson(s: string, fallback: string[] = []): string[] {
  try { return JSON.parse(s) || fallback; } catch { return fallback; }
}

export default function WeChatDashboard() {
  const [chats, setChats]           = useState<ChatRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [search, setSearch]         = useState('');
  const [expanded, setExpanded]     = useState<number | null>(null);
  const [newCount, setNewCount]     = useState(0);
  const [showBlocklist, setShowBlocklist] = useState(false);
  const [blocklist, setBlocklist]   = useState<BlocklistItem[]>([]);
  const [blWxid, setBlWxid]         = useState('');
  const [blName, setBlName]         = useState('');
  const lastCheckRef = useRef<string>(new Date().toISOString());

  const loadChats = useCallback(() => {
    fetch('/api/wechat-chats')
      .then(r => r.json())
      .then((d: ChatRow[]) => { setChats(d); setLoading(false); });
  }, []);

  useEffect(() => { loadChats(); }, [loadChats]);

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
          const fresh = rows
            .filter(r => !ids.has(r.id))
            .map(r => ({ ...r, isNew: true }));
          return [...fresh, ...prev];
        });
      }
    }, 30_000);
    return () => clearInterval(poll);
  }, []);

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
              <path d="M8.5 4a6.5 6.5 0 00-3.5 12.01V19l2.7-1.35A6.5 6.5 0 108.5 4zm8 3.5a5 5 0 100 10 5 5 0 000-10zm4.5 8.5l2.5 1.25v-2.51A5 5 0 0016.5 6v1.5a3.5 3.5 0 110 7V16a5 5 0 004.5-5v1z" />
            </svg>
            微信聊天跟进看板
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">汇总所有客户的微信沟通记录与AI提炼结果</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowBlocklist(true)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors text-zinc-400 hover:text-white"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
            🚫 屏蔽名单
          </button>
          <Link href="/wechat/import"
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors text-white"
            style={{ background: '#16a34a' }}>
            🖥 自动导入指南
          </Link>
          <Link href="/customers"
            className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
            ← 返回
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '聊天记录', value: stats.total,       color: '#60a5fa' },
          { label: '意向强烈', value: stats.hot,         color: '#f97316' },
          { label: '有兴趣',   value: stats.warm,        color: '#fbbf24' },
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
        <input
          type="text"
          placeholder="搜索客户名、摘要..."
          value={search}
          onChange={e => setSearch(e.target.value)}
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

      {/* Table */}
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
            const intent = INTENT[chat.intent_level] || INTENT.unknown;
            const features = parseJson(chat.discussed_features);
            const steps = parseJson(chat.next_steps);
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
                      {chat.customer_name}
                    </Link>
                    {chat.contact_name && (
                      <p className="text-xs text-zinc-600">{chat.contact_name}</p>
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

            {/* Add form */}
            <div className="space-y-2">
              <input
                type="text" placeholder="微信号 / wxid（必填）"
                value={blWxid} onChange={e => setBlWxid(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
              <input
                type="text" placeholder="备注名（选填）"
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

            {/* List */}
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
