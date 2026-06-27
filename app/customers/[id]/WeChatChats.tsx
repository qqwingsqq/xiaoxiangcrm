'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface WeChatChat {
  id: number;
  customer_id: number;
  raw_content: string;
  summary: string | null;
  next_meeting: string | null;
  discussed_features: string;
  next_steps: string;
  intent_level: string;
  key_points: string;
  analysis_status: string;
  chat_date: string | null;
  created_at: string;
}

interface ChatLine { time: string; sender: 'me' | 'other'; text: string; idx: number; }

const INTENT_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  hot:     { label: '意向强烈', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  warm:    { label: '有兴趣',   color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  cold:    { label: '暂无意向', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  unknown: { label: '未分析',   color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
};

function parseJson(s: string, fallback: string[] = []): string[] {
  try { return JSON.parse(s) || fallback; } catch { return fallback; }
}

function parseLines(raw: string): ChatLine[] {
  return raw.split('\n')
    .map((line, idx) => {
      const m = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(我|对方)[:：]\s*(.+)$/);
      if (m) return { time: m[1], sender: m[2] === '我' ? 'me' : 'other', text: m[3].trim(), idx } as ChatLine;
      // fallback: unformatted line shown as system note
      if (line.trim()) return { time: '', sender: 'other' as const, text: line.trim(), idx };
      return null;
    })
    .filter(Boolean) as ChatLine[];
}

function findMatchLines(lines: ChatLine[], query: string): number[] {
  const words = query.replace(/[【】()（）。，、：:!！?？]/g, ' ')
    .split(/\s+/).filter(w => w.length >= 2);
  if (!words.length) return [];
  const scored = lines.map(l => {
    const t = l.text.toLowerCase();
    const score = words.reduce((n, w) => n + (t.includes(w.toLowerCase()) ? 1 : 0), 0);
    return { idx: l.idx, score };
  }).filter(x => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map(x => x.idx);
}

function ChatViewer({ raw, highlightIdx }: { raw: string; highlightIdx: number | null }) {
  const lines = parseLines(raw);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (highlightIdx !== null) {
      const el = lineRefs.current[highlightIdx];
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightIdx]);

  return (
    <div className="overflow-y-auto max-h-80 px-3 py-2 space-y-1.5 rounded-xl"
      style={{ background: '#0f0f11', border: '1px solid #222' }}>
      {lines.map((line, i) => {
        const isMe = line.sender === 'me';
        const isHit = highlightIdx !== null && line.idx === highlightIdx;
        return (
          <div key={i} ref={el => { lineRefs.current[line.idx] = el; }}
            className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
              style={{ background: isMe ? '#1d4ed8' : '#16a34a', color: '#fff' }}>
              {isMe ? '我' : '他'}
            </div>
            <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
              {line.time && (
                <span className="text-[10px] text-zinc-600">{line.time}</span>
              )}
              <div className="px-2.5 py-1.5 rounded-xl text-xs leading-relaxed transition-all duration-300"
                style={{
                  background: isHit
                    ? 'rgba(251,191,36,0.25)'
                    : isMe ? 'rgba(29,78,216,0.3)' : '#1e1e22',
                  color: isHit ? '#fbbf24' : isMe ? '#93c5fd' : '#d1d5db',
                  border: isHit ? '1px solid rgba(251,191,36,0.5)' : '1px solid transparent',
                  boxShadow: isHit ? '0 0 8px rgba(251,191,36,0.2)' : undefined,
                }}>
                {line.text}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TagItem({ text, onClick }: { text: string; onClick: () => void }) {
  const [active, setActive] = useState(false);
  const handle = () => { setActive(true); onClick(); setTimeout(() => setActive(false), 2000); };
  return (
    <button onClick={handle}
      title="点击定位到聊天原文"
      className="text-left text-xs px-2 py-1 rounded-lg transition-all flex items-start gap-1.5 w-full hover:opacity-90"
      style={{
        background: active ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.08)'}`,
        color: active ? '#fbbf24' : '#d1d5db',
      }}>
      <span className="mt-0.5 flex-shrink-0" style={{ color: active ? '#fbbf24' : '#6b7280' }}>→</span>
      <span>{text}</span>
      {active && <span className="ml-auto flex-shrink-0 text-[10px] text-yellow-400">已定位</span>}
    </button>
  );
}

function ChatCard({ chat, onDeleted, onAnalyzed }: {
  chat: WeChatChat;
  onDeleted: () => void;
  onAnalyzed: (c: WeChatChat) => void;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const lines = useRef<ChatLine[]>([]);

  useEffect(() => { lines.current = parseLines(chat.raw_content); }, [chat.raw_content]);

  const intent = INTENT_LABEL[chat.intent_level] || INTENT_LABEL.unknown;
  const features = parseJson(chat.discussed_features);
  const steps    = parseJson(chat.next_steps);
  const keyPts   = parseJson(chat.key_points);

  const locate = useCallback((query: string) => {
    setShowChat(true);
    const hits = findMatchLines(lines.current, query);
    setHighlightIdx(hits.length > 0 ? hits[0] : null);
  }, []);

  const analyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/wechat-chats/${chat.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze' }),
      });
      if (res.ok) { onAnalyzed(await res.json()); setExpanded(true); }
      else { const e = await res.json(); alert(e.error || 'AI 分析失败'); }
    } finally { setAnalyzing(false); }
  };

  const hasSummary = chat.analysis_status === 'done';

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#1c1c1f', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8.5 4a6.5 6.5 0 00-3.5 12.01V19l2.7-1.35A6.5 6.5 0 108.5 4zm8 3.5a5 5 0 100 10 5 5 0 000-10z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {chat.chat_date && (
              <span className="text-xs px-1.5 py-0.5 rounded text-blue-400" style={{ background: 'rgba(59,130,246,0.1)' }}>
                📅 {chat.chat_date}
              </span>
            )}
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: intent.bg, color: intent.color }}>
              {intent.label}
            </span>
            {hasSummary && chat.next_meeting && (
              <span className="text-xs px-1.5 py-0.5 rounded text-emerald-400" style={{ background: 'rgba(16,185,129,0.1)' }}>
                🗓 {chat.next_meeting}
              </span>
            )}
          </div>
          {chat.summary
            ? <p className="text-xs text-zinc-300 leading-relaxed">{chat.summary}</p>
            : <p className="text-xs text-zinc-600">{chat.raw_content.substring(0, 80)}{chat.raw_content.length > 80 ? '…' : ''}</p>
          }
          <p className="text-xs mt-1 text-zinc-600">导入于 {chat.created_at}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasSummary && (
            <button onClick={() => setExpanded(e => !e)}
              className="text-xs px-2 py-1 rounded text-blue-400 hover:text-blue-300 hover:bg-zinc-800 transition-colors">
              {expanded ? '收起' : '详情'}
            </button>
          )}
          <button onClick={() => { setShowChat(s => !s); setHighlightIdx(null); }}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{ color: showChat ? '#10b981' : '#6b7280' }}
            title="查看聊天记录">
            💬
          </button>
          {(chat.analysis_status === 'pending' || chat.analysis_status === 'error') && (
            <button onClick={analyze} disabled={analyzing}
              className="text-xs px-2.5 py-1 rounded text-white disabled:opacity-50 transition-colors font-medium"
              style={{ background: analyzing ? '#333' : '#1d4ed8' }}>
              {analyzing ? '分析中…' : '✨ AI提炼'}
            </button>
          )}
          <button onClick={() => { if (confirm('删除此聊天记录？')) fetch(`/api/wechat-chats/${chat.id}`, { method: 'DELETE' }).then(onDeleted); }}
            className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* AI Analysis detail */}
      {expanded && hasSummary && (
        <div className="px-4 pb-3 border-t space-y-3" style={{ borderColor: '#2a2a2e' }}>
          {features.length > 0 && (
            <div className="pt-3">
              <p className="text-xs font-medium text-zinc-400 mb-1.5">🔧 讨论的功能需求
                <span className="ml-1 text-zinc-600 font-normal">（点击可定位原文）</span>
              </p>
              <ul className="space-y-1">
                {features.map((f, i) => (
                  <li key={i} className="flex gap-2 text-xs items-start">
                    <span className="text-blue-400 flex-shrink-0 mt-1">{i + 1}.</span>
                    <TagItem text={f} onClick={() => locate(f)} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {steps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1.5">📋 下一步计划
                <span className="ml-1 text-zinc-600 font-normal">（点击可定位原文）</span>
              </p>
              <ul className="space-y-1">
                {steps.map((s, i) => (
                  <li key={i}>
                    <TagItem text={s} onClick={() => locate(s)} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {keyPts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1.5">✨ 其他重点
                <span className="ml-1 text-zinc-600 font-normal">（点击可定位原文）</span>
              </p>
              <ul className="space-y-1">
                {keyPts.map((k, i) => (
                  <li key={i}>
                    <TagItem text={k} onClick={() => locate(k)} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Chat viewer */}
      {showChat && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: '#2a2a2e' }}>
          <div className="flex items-center justify-between py-2 mb-1">
            <span className="text-xs text-zinc-500">聊天记录{highlightIdx !== null ? ' · 已高亮定位' : ''}</span>
            {highlightIdx !== null && (
              <button onClick={() => setHighlightIdx(null)}
                className="text-xs text-zinc-600 hover:text-zinc-400">清除高亮</button>
            )}
          </div>
          <ChatViewer raw={chat.raw_content} highlightIdx={highlightIdx} />
        </div>
      )}
    </div>
  );
}

export default function WeChatChats({ customerId }: { customerId: number }) {
  const [chats, setChats]   = useState<WeChatChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ raw_content: '', chat_date: '' });
  const [saving, setSaving]   = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/customers/${customerId}/wechat-chats`);
    setChats(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, [customerId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.raw_content.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/customers/${customerId}/wechat-chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, auto_analyze: true }),
    });
    if (res.ok) {
      const created = await res.json();
      setChats(c => [created, ...c]);
      setForm({ raw_content: '', chat_date: '' });
      setShowAdd(false);
    } else {
      const e2 = await res.json();
      alert(e2.error || '保存失败');
    }
    setSaving(false);
  };

  const inputStyle: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' };
  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8.5 4a6.5 6.5 0 00-3.5 12.01V19l2.7-1.35A6.5 6.5 0 108.5 4z" />
          </svg>
          <h3 className="text-sm font-semibold text-white">微信聊天记录</h3>
        </div>
        <button onClick={() => setShowAdd(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-white"
          style={{ background: '#16a34a' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          导入聊天
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-xl p-4 mb-4 space-y-3"
          style={{ background: 'var(--bg-card)', border: '1px solid rgba(22,163,74,0.3)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <p className="text-xs text-green-400 font-medium">粘贴微信聊天记录，AI将自动提炼关键信息</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">聊天日期（可选）</label>
            <input type="date" value={form.chat_date} onChange={e => setForm(f => ({ ...f, chat_date: e.target.value }))}
              className={inputCls} style={{ ...inputStyle, maxWidth: 200 }} />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">微信聊天内容</label>
            <textarea
              placeholder="将微信聊天记录粘贴到这里..."
              value={form.raw_content}
              onChange={e => setForm(f => ({ ...f, raw_content: e.target.value }))}
              rows={8} className={`${inputCls} resize-none font-mono text-xs`} style={inputStyle} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !form.raw_content.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors text-white"
              style={{ background: saving ? '#333' : '#16a34a' }}>
              {saving ? '✨ AI提炼中…' : '✨ 保存并AI提炼'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-4 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
              取消
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-center py-8 text-zinc-600">加载中...</p>
      ) : chats.length === 0 ? (
        <div className="text-center py-10 rounded-xl" style={{ background: '#1c1c1f', border: '1px solid var(--border)' }}>
          <p className="text-sm text-zinc-600">暂无微信聊天记录，点击「导入聊天」粘贴内容</p>
        </div>
      ) : (
        <div className="space-y-3">
          {chats.map(chat => (
            <ChatCard key={chat.id} chat={chat}
              onDeleted={() => setChats(c => c.filter(x => x.id !== chat.id))}
              onAnalyzed={updated => setChats(c => c.map(x => x.id === updated.id ? updated : x))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
