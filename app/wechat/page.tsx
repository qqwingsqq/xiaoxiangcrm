'use client';

import { useState, useEffect } from 'react';
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
}

const INTENT: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  hot: { label: '意向强烈', color: '#f97316', bg: 'rgba(249,115,22,0.12)', dot: '#f97316' },
  warm: { label: '有兴趣', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', dot: '#fbbf24' },
  cold: { label: '暂无意向', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', dot: '#6b7280' },
  unknown: { label: '未分析', color: '#4b5563', bg: 'rgba(75,85,99,0.08)', dot: '#374151' },
};

function parseJson(s: string, fallback: string[] = []): string[] {
  try { return JSON.parse(s) || fallback; } catch { return fallback; }
}

export default function WeChatDashboard() {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/wechat-chats')
      .then(r => r.json())
      .then(d => { setChats(d); setLoading(false); });
  }, []);

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
        <Link href="/customers"
          className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
          ← 返回客户列表
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '聊天记录', value: stats.total, color: '#60a5fa' },
          { label: '意向强烈', value: stats.hot, color: '#f97316' },
          { label: '有兴趣', value: stats.warm, color: '#fbbf24' },
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
          {chats.length === 0
            ? '暂无微信聊天记录，请前往客户详情页导入聊天内容'
            : '没有符合条件的记录'}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Column headers */}
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
              <div key={chat.id} className="rounded-xl overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                {/* Main row */}
                <div className="grid grid-cols-12 gap-3 px-4 py-3 items-start">
                  {/* Customer */}
                  <div className="col-span-12 sm:col-span-2">
                    <Link href={`/customers/${chat.customer_id}`}
                      className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
                      {chat.customer_name}
                    </Link>
                    {chat.contact_name && (
                      <p className="text-xs text-zinc-600">{chat.contact_name}</p>
                    )}
                  </div>

                  {/* Intent */}
                  <div className="col-span-4 sm:col-span-1">
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: intent.bg, color: intent.color }}>
                      <span className="mr-1" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: intent.dot, verticalAlign: 'middle' }} />
                      {intent.label}
                    </span>
                  </div>

                  {/* Summary */}
                  <div className="col-span-8 sm:col-span-3">
                    {chat.analysis_status === 'done' && chat.summary ? (
                      <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2">{chat.summary}</p>
                    ) : (
                      <p className="text-xs text-zinc-600 line-clamp-2">
                        {chat.raw_content.substring(0, 60)}…
                      </p>
                    )}
                  </div>

                  {/* Next meeting */}
                  <div className="col-span-6 sm:col-span-2">
                    {chat.next_meeting ? (
                      <span className="text-xs text-emerald-400">🗓 {chat.next_meeting}</span>
                    ) : (
                      <span className="text-xs text-zinc-700">—</span>
                    )}
                  </div>

                  {/* Features */}
                  <div className="col-span-6 sm:col-span-2">
                    {features.length > 0 ? (
                      <ul className="space-y-0.5">
                        {features.slice(0, 2).map((f, i) => (
                          <li key={i} className="text-xs text-zinc-400 flex gap-1 items-start">
                            <span className="text-zinc-600 flex-shrink-0">·</span>
                            <span className="line-clamp-1">{f}</span>
                          </li>
                        ))}
                        {features.length > 2 && (
                          <li className="text-xs text-zinc-600">+{features.length - 2} 项</li>
                        )}
                      </ul>
                    ) : (
                      <span className="text-xs text-zinc-700">—</span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="col-span-6 sm:col-span-1">
                    <p className="text-xs text-zinc-600">{(chat.chat_date || chat.created_at).substring(0, 10)}</p>
                  </div>

                  {/* Actions */}
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

                {/* Expanded detail */}
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
    </div>
  );
}
