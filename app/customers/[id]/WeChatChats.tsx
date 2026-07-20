'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface WeChatChat {
  id: number;
  customer_id: number;
  contact_id: number | null;
  contact_name: string | null;
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
  is_group: number;
}

interface WeChatContact {
  id: number;
  customer_id: number;
  name: string;
  wxid: string | null;
  role: string | null;
  sort_order: number;
  chat_count: number;
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
    const t     = l.text.toLowerCase();
    const score = words.reduce((n, w) => n + (t.includes(w.toLowerCase()) ? 1 : 0), 0);
    return { idx: l.idx, score };
  }).filter(x => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map(x => x.idx);
}

// ── ChatViewer ────────────────────────────────────────────────
function ChatViewer({
  raw,
  highlightIdx,
  scrollTrigger,
}: {
  raw: string;
  highlightIdx: number | null;
  scrollTrigger: number;
}) {
  const lines        = parseLines(raw);
  const containerRef = useRef<HTMLDivElement>(null);

  // 每次 scrollTrigger 变化（即用户点击要点）→ 滚动到高亮行
  useEffect(() => {
    if (highlightIdx === null || !containerRef.current) return;
    // setTimeout 确保新挂载的 ChatViewer DOM 完全绘制后再滚动
    const t = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const el = container.querySelector<HTMLElement>(`[data-line="${highlightIdx}"]`);
      if (!el) return;
      // 手动计算偏移，在 overflow 容器内滚动
      const containerTop  = container.scrollTop;
      const containerH    = container.clientHeight;
      const elTop         = el.offsetTop;
      const elH           = el.offsetHeight;
      const target        = elTop - containerH / 2 + elH / 2;
      container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }, 80);
    return () => clearTimeout(t);
  }, [scrollTrigger, highlightIdx]);

  return (
    <div ref={containerRef}
      className="overflow-y-auto max-h-80 px-3 py-2 space-y-1.5 rounded-xl"
      style={{ background: '#0f0f11', border: '1px solid #222' }}>
      {lines.map((line, i) => {
        const isMe  = line.sender === 'me';
        const isHit = highlightIdx !== null && line.idx === highlightIdx;
        return (
          <div key={i}
            data-line={line.idx}
            className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
              style={{ background: isMe ? '#1d4ed8' : '#16a34a', color: '#fff' }}>
              {isMe ? '我' : '他'}
            </div>
            <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
              {line.time && <span className="text-[10px] text-zinc-600">{line.time}</span>}
              <div className="px-2.5 py-1.5 rounded-xl text-xs leading-relaxed transition-all duration-300"
                style={{
                  background: isHit
                    ? 'rgba(251,191,36,0.25)'
                    : isMe ? 'rgba(29,78,216,0.3)' : '#1e1e22',
                  color:  isHit ? '#fbbf24' : isMe ? '#93c5fd' : '#d1d5db',
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

// ── TagItem ───────────────────────────────────────────────────
function TagItem({ text, onClick }: { text: string; onClick: () => void }) {
  const [active, setActive] = useState(false);
  const handle = () => {
    setActive(true);
    onClick();
    setTimeout(() => setActive(false), 2000);
  };
  return (
    <button onClick={handle} title="点击定位到聊天原文"
      className="text-left text-xs px-2 py-1 rounded-lg transition-all flex items-start gap-1.5 w-full hover:opacity-90"
      style={{
        background: active ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.08)'}`,
        color:  active ? '#fbbf24' : '#d1d5db',
      }}>
      <span className="mt-0.5 flex-shrink-0" style={{ color: active ? '#fbbf24' : '#6b7280' }}>→</span>
      <span>{text}</span>
      {active && <span className="ml-auto flex-shrink-0 text-[10px] text-yellow-400">已定位 ↓</span>}
    </button>
  );
}

// ── ChatCard ──────────────────────────────────────────────────
function ChatCard({ chat, isNew, onDeleted, onAnalyzed }: {
  chat: WeChatChat;
  isNew?: boolean;
  onDeleted: () => void;
  onAnalyzed: (c: WeChatChat) => void;
}) {
  const [analyzing, setAnalyzing]     = useState(false);
  const [expanded, setExpanded]       = useState(false);
  const [showChat, setShowChat]       = useState(false);
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const linesRef = useRef<ChatLine[]>([]);

  useEffect(() => { linesRef.current = parseLines(chat.raw_content); }, [chat.raw_content]);

  const intent   = INTENT_LABEL[chat.intent_level] || INTENT_LABEL.unknown;
  const features = parseJson(chat.discussed_features);
  const steps    = parseJson(chat.next_steps);
  const keyPts   = parseJson(chat.key_points);

  // Click on a summary item → open chat viewer + scroll to match
  const locate = useCallback((query: string) => {
    const hits = findMatchLines(linesRef.current, query);
    const idx  = hits.length > 0 ? hits[0] : null;
    setHighlightIdx(idx);
    setShowChat(true);
    // scrollTrigger forces the effect to re-run even if idx didn't change
    setScrollTrigger(t => t + 1);
  }, []);

  const analyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/wechat-chats/${chat.id}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'analyze' }),
      });
      if (res.ok) { onAnalyzed(await res.json()); setExpanded(true); }
      else { const e = await res.json(); alert(e.error || 'AI 分析失败'); }
    } finally { setAnalyzing(false); }
  };

  const hasSummary = chat.analysis_status === 'done';

  return (
    <div className="rounded-xl overflow-hidden"
      style={{
        background: '#1c1c1f',
        border: `1px solid ${isNew ? 'rgba(16,185,129,0.5)' : 'var(--border)'}`,
        boxShadow: isNew ? '0 0 0 1px rgba(16,185,129,0.15)' : undefined,
      }}>

      {isNew && (
        <div className="px-4 py-1.5 flex items-center gap-1.5 text-xs font-medium"
          style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          新消息已同步
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8.5 4a6.5 6.5 0 00-3.5 12.01V19l2.7-1.35A6.5 6.5 0 108.5 4z" />
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
          <button
            onClick={() => { setShowChat(s => !s); setHighlightIdx(null); }}
            title={showChat ? '收起聊天记录' : '查看聊天记录'}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{ color: showChat ? '#10b981' : '#6b7280' }}>
            💬
          </button>
          {(chat.analysis_status === 'pending' || chat.analysis_status === 'error') && (
            <button onClick={analyze} disabled={analyzing}
              className="text-xs px-2.5 py-1 rounded text-white disabled:opacity-50 transition-colors font-medium"
              style={{ background: analyzing ? '#333' : '#1d4ed8' }}>
              {analyzing ? '分析中…' : '✨ AI提炼'}
            </button>
          )}
          <button onClick={() => {
            if (confirm('删除此聊天记录？'))
              fetch(`/api/wechat-chats/${chat.id}`, { method: 'DELETE' }).then(onDeleted);
          }}
            className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* AI 详情展开 */}
      {expanded && hasSummary && (
        <div className="px-4 pb-3 border-t space-y-3" style={{ borderColor: '#2a2a2e' }}>
          {features.length > 0 && (
            <div className="pt-3">
              <p className="text-xs font-medium text-zinc-400 mb-1.5">
                🔧 讨论的功能需求
                <span className="ml-1 text-zinc-600 font-normal">（点击可定位聊天原文）</span>
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
              <p className="text-xs font-medium text-zinc-400 mb-1.5">
                📋 下一步计划
                <span className="ml-1 text-zinc-600 font-normal">（点击可定位聊天原文）</span>
              </p>
              <ul className="space-y-1">
                {steps.map((s, i) => (
                  <li key={i}><TagItem text={s} onClick={() => locate(s)} /></li>
                ))}
              </ul>
            </div>
          )}
          {keyPts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1.5">
                ✨ 其他重点
                <span className="ml-1 text-zinc-600 font-normal">（点击可定位聊天原文）</span>
              </p>
              <ul className="space-y-1">
                {keyPts.map((k, i) => (
                  <li key={i}><TagItem text={k} onClick={() => locate(k)} /></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 聊天气泡 */}
      {showChat && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: '#2a2a2e' }}>
          <div className="flex items-center justify-between py-2 mb-1">
            <span className="text-xs text-zinc-500">
              聊天记录{highlightIdx !== null ? ' · 黄色高亮为定位位置' : ''}
            </span>
            {highlightIdx !== null && (
              <button onClick={() => setHighlightIdx(null)}
                className="text-xs text-zinc-600 hover:text-zinc-400">
                清除高亮
              </button>
            )}
          </div>
          <ChatViewer
            raw={chat.raw_content}
            highlightIdx={highlightIdx}
            scrollTrigger={scrollTrigger}
          />
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function WeChatChats({ customerId, selectedContactId }: { customerId: number; selectedContactId?: number | null }) {
  const [chats, setChats]         = useState<WeChatChat[]>([]);
  const [contacts, setContacts]   = useState<WeChatContact[]>([]);
  const [newIds, setNewIds]       = useState<Set<number>>(new Set());
  const [loading, setLoading]     = useState(true);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [activeContact, setActiveContact] = useState<number | 'all' | 'none'>('all');
  const [showAdd, setShowAdd]     = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [form, setForm]           = useState({ raw_content: '', chat_date: '', wechat_contact_id: '' });
  const [newContactForm, setNewContactForm] = useState({ name: '', wxid: '', role: '' });
  const [saving, setSaving]       = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const latestCreatedAt           = useRef<string>('');

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/wechat-contacts`);
      if (res.ok) {
        const data: WeChatContact[] = await res.json();
        setContacts(data);
      }
    } finally {
      setContactsLoading(false);
    }
  }, [customerId]);

  const load = useCallback(async () => {
    setLoading(true);
    let url = `/api/customers/${customerId}/wechat-chats`;
    const params = new URLSearchParams();
    if (activeContact !== 'all') {
      params.set('contact_id', activeContact === 'none' ? 'none' : String(activeContact));
    }
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url);
    const data: WeChatChat[] = await res.json();
    setChats(data);
    if (data.length > 0) {
      latestCreatedAt.current = data.reduce(
        (max, c) => (c.created_at > max ? c.created_at : max), ''
      );
    }
    setLoading(false);
  }, [customerId, activeContact]);

  useEffect(() => { loadContacts(); }, [loadContacts]);
  useEffect(() => { load(); }, [load]);

  // 同步外部传入的 selectedContactId
  useEffect(() => {
    if (selectedContactId !== undefined) {
      setActiveContact(selectedContactId ?? 'all');
    }
  }, [selectedContactId]);

  useEffect(() => {
    const poll = setInterval(async () => {
      if (!latestCreatedAt.current) return;
      let url = `/api/customers/${customerId}/wechat-chats?since=${encodeURIComponent(latestCreatedAt.current)}`;
      if (activeContact !== 'all') {
        url += `&contact_id=${activeContact === 'none' ? 'none' : activeContact}`;
      }
      const res  = await fetch(url);
      const data: WeChatChat[] = await res.json();
      if (data.length > 0) {
        const freshIds = new Set(data.map(c => c.id));
        setNewIds(prev => new Set([...prev, ...freshIds]));
        setChats(prev => {
          const existing = new Set(prev.map(c => c.id));
          const fresh = data.filter(c => !existing.has(c.id));
          if (!fresh.length) return prev;
          latestCreatedAt.current = data.reduce(
            (max, c) => (c.created_at > max ? c.created_at : max),
            latestCreatedAt.current
          );
          return [...fresh, ...prev];
        });
      }
    }, 30_000);
    return () => clearInterval(poll);
  }, [customerId, activeContact]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.raw_content.trim()) return;
    setSaving(true);
    const body: Record<string, any> = {
      raw_content: form.raw_content,
      chat_date: form.chat_date || null,
      auto_analyze: true,
    };
    if (form.wechat_contact_id && form.wechat_contact_id !== 'none') {
      body.wechat_contact_id = Number(form.wechat_contact_id);
    }
    const res = await fetch(`/api/customers/${customerId}/wechat-chats`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    if (res.ok) {
      const created: WeChatChat = await res.json();
      setChats(c => [created, ...c]);
      setForm({ raw_content: '', chat_date: '', wechat_contact_id: form.wechat_contact_id });
      setShowAdd(false);
      loadContacts();
    } else {
      const e2 = await res.json();
      alert(e2.error || '保存失败');
    }
    setSaving(false);
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactForm.name.trim()) return;
    setContactSaving(true);
    const res = await fetch(`/api/customers/${customerId}/wechat-contacts`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(newContactForm),
    });
    if (res.ok) {
      const created: WeChatContact = await res.json();
      setContacts(c => [...c, created]);
      setNewContactForm({ name: '', wxid: '', role: '' });
      setShowAddContact(false);
      setActiveContact(created.id);
    } else {
      const e2 = await res.json();
      alert(e2.error || '添加失败');
    }
    setContactSaving(false);
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!confirm('确定删除此联系人？该联系人的聊天记录不会被删除。')) return;
    const res = await fetch(`/api/wechat-contacts/${contactId}`, { method: 'DELETE' });
    if (res.ok) {
      setContacts(c => c.filter(x => x.id !== contactId));
      if (activeContact === contactId) setActiveContact('all');
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)',
    border:     '1px solid var(--border)',
    color:      'var(--text-primary)',
  };
  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  const allContactsChatCount = contacts.reduce((sum, c) => sum + c.chat_count, 0);

  const displayName = (c: WeChatContact) => {
    if (c.role) return `${c.name} · ${c.role}`;
    return c.name;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8.5 4a6.5 6.5 0 00-3.5 12.01V19l2.7-1.35A6.5 6.5 0 108.5 4z" />
          </svg>
          <h3 className="text-sm font-semibold text-white">微信聊天记录</h3>
          {newIds.size > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
              {newIds.size} 条新消息
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddContact(s => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加联系人
          </button>
          <button onClick={() => setShowAdd(s => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-white"
            style={{ background: '#16a34a' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            导入聊天
          </button>
        </div>
      </div>

      {showAddContact && (
        <form onSubmit={handleAddContact} className="rounded-xl p-4 mb-4 space-y-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium text-white">添加微信联系人</p>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">姓名 <span className="text-red-400">*</span></label>
            <input type="text" value={newContactForm.name}
              onChange={e => setNewContactForm(f => ({ ...f, name: e.target.value }))}
              placeholder="联系人姓名"
              className={inputCls} style={inputStyle} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">微信号</label>
              <input type="text" value={newContactForm.wxid}
                onChange={e => setNewContactForm(f => ({ ...f, wxid: e.target.value }))}
                placeholder="选填"
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">职位/角色</label>
              <input type="text" value={newContactForm.role}
                onChange={e => setNewContactForm(f => ({ ...f, role: e.target.value }))}
                placeholder="如：采购、销售经理"
                className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={contactSaving || !newContactForm.name.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors text-white"
              style={{ background: '#1d4ed8' }}>
              {contactSaving ? '添加中…' : '添加联系人'}
            </button>
            <button type="button" onClick={() => setShowAddContact(false)}
              className="px-4 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
              取消
            </button>
          </div>
        </form>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-xl p-4 mb-4 space-y-3"
          style={{ background: 'var(--bg-card)', border: '1px solid rgba(22,163,74,0.3)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <p className="text-xs text-green-400 font-medium">粘贴微信聊天记录，AI将自动提炼关键信息</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">所属联系人</label>
            <select value={form.wechat_contact_id}
              onChange={e => setForm(f => ({ ...f, wechat_contact_id: e.target.value }))}
              className={inputCls} style={inputStyle}>
              <option value="">— 不指定（未分类）—</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{displayName(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">聊天日期（可选）</label>
            <input type="date" value={form.chat_date}
              onChange={e => setForm(f => ({ ...f, chat_date: e.target.value }))}
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

      {!contactsLoading && contacts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setActiveContact('all')}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1"
            style={{
              background: activeContact === 'all' ? 'rgba(22,163,74,0.15)' : 'var(--bg-input)',
              color: activeContact === 'all' ? '#10b981' : 'var(--text-muted)',
              border: `1px solid ${activeContact === 'all' ? '#10b981' : 'var(--border)'}`,
            }}>
            全部联系人
            <span style={{ opacity: 0.6 }}>· {allContactsChatCount}</span>
          </button>
          {contacts.map(contact => (
            <div key={contact.id} className="relative group">
              <button
                onClick={() => setActiveContact(contact.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 pr-2"
                style={{
                  background: activeContact === contact.id ? 'rgba(22,163,74,0.15)' : 'var(--bg-input)',
                  color: activeContact === contact.id ? '#10b981' : 'var(--text-muted)',
                  border: `1px solid ${activeContact === contact.id ? '#10b981' : 'var(--border)'}`,
                }}>
                {displayName(contact)}
                <span style={{ opacity: 0.6 }}>· {contact.chat_count}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); handleDeleteContact(contact.id); }}
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 cursor-pointer"
                  style={{ fontSize: 12 }}>
                  ×
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-center py-8 text-zinc-600">加载中...</p>
      ) : chats.length === 0 ? (
        <div className="text-center py-10 rounded-xl" style={{ background: '#1c1c1f', border: '1px solid var(--border)' }}>
          <p className="text-sm text-zinc-600">暂无微信聊天记录，点击「导入聊天」粘贴内容</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeContact === 'all' ? (
            // 全部模式：先按联系人分组，再按日期分组
            Object.entries(chats.reduce<Record<string, WeChatChat[]>>((acc, chat) => {
              const name = chat.contact_name || '未关联联系人';
              acc[name] = acc[name] || [];
              acc[name].push(chat);
              return acc;
            }, {})).map(([name, group]) => {
              // 每个联系人内部按日期分组
              const byDate = group.reduce<Record<string, WeChatChat[]>>((acc, chat) => {
                const date = chat.chat_date || chat.created_at.substring(0, 10);
                acc[date] = acc[date] || [];
                acc[date].push(chat);
                return acc;
              }, {});
              return (
                <div key={name} className="space-y-2">
                  {/* 联系人分隔 */}
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-xs font-medium text-green-400">{name}</span>
                    <span className="text-xs text-zinc-600">{group.length} 条</span>
                    <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                  </div>
                  {/* 日期分组 */}
                  {Object.entries(byDate).map(([date, dayChats]) => (
                    <div key={date} className="space-y-2 pl-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-600 px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-input)' }}>{date}</span>
                        <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                      </div>
                      {dayChats.map(chat => (
                        <ChatCard key={chat.id} chat={chat}
                          isNew={newIds.has(chat.id)}
                          onDeleted={() => setChats(c => c.filter(x => x.id !== chat.id))}
                          onAnalyzed={updated => setChats(c => c.map(x => x.id === updated.id ? updated : x))}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              );
            })
          ) : (
            // 筛选模式：按日期分组
            Object.entries(chats.reduce<Record<string, WeChatChat[]>>((acc, chat) => {
              const date = chat.chat_date || chat.created_at.substring(0, 10);
              acc[date] = acc[date] || [];
              acc[date].push(chat);
              return acc;
            }, {})).map(([date, dayChats]) => (
              <div key={date} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-600 px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-input)' }}>{date}</span>
                  <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                </div>
                {dayChats.map(chat => (
                  <ChatCard key={chat.id} chat={chat}
                    isNew={newIds.has(chat.id)}
                    onDeleted={() => setChats(c => c.filter(x => x.id !== chat.id))}
                    onAnalyzed={updated => setChats(c => c.map(x => x.id === updated.id ? updated : x))}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
