'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  action?: ActionData | null;
  actionDone?: boolean;   // true = saved, 'skip' = dismissed
  actionState?: 'saved' | 'skipped' | null;
}

interface ActionData {
  type: 'follow_up' | 'schedule' | 'reminder' | 'none';
  customer_name?: string;
  title?: string;
  content?: string;
  date?: string | null;
  time?: string | null;
  description?: string;
}

interface Customer { id: number; name: string; }

// ── Icons ─────────────────────────────────────────────────────────────────────

function MicIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" fill={active ? 'currentColor' : 'none'} />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

// ── Action suggestion card (inline, after assistant message) ───────────────────

function ActionSuggestionCard({ action, customers, onSave, onSkip }: {
  action: ActionData;
  customers: Customer[];
  onSave: (customerId?: number) => Promise<void>;
  onSkip: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState<number | ''>('');

  useEffect(() => {
    if (action.customer_name && customers.length) {
      const match = customers.find(c =>
        c.name.includes(action.customer_name!) || action.customer_name!.includes(c.name)
      );
      if (match) setCustomerId(match.id);
    }
  }, [action.customer_name, customers]);

  const needsCustomer = action.type === 'follow_up' || action.type === 'reminder';

  const cfgMap: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
    schedule:  { icon: '📅', label: '加入日程', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.3)' },
    follow_up: { icon: '📋', label: '保存跟进', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
    reminder:  { icon: '🔔', label: '设置提醒', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  };
  const cfg = cfgMap[action.type] ?? null;

  if (!cfg) return null;

  const handleSave = async () => {
    setSaving(true);
    await onSave(needsCustomer ? (customerId as number | undefined) : undefined);
  };

  return (
    <div style={{
      marginTop: '6px',
      padding: '12px 14px',
      borderRadius: '12px',
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      maxWidth: '88%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px' }}>{cfg.icon}</span>
        <span style={{ fontSize: '11px', fontWeight: 700, color: cfg.color, letterSpacing: '0.02em' }}>
          检测到可{action.type === 'schedule' ? '加入日程' : action.type === 'follow_up' ? '记录的跟进' : '设置的提醒'}
        </span>
      </div>

      {/* Info rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '10px' }}>
        {action.title && (
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {action.title}
          </div>
        )}
        {(action.content || action.description) && (
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {action.content || action.description}
          </div>
        )}
        {action.date && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
            🕐 {action.date}{action.time ? ` ${action.time}` : ''}
          </div>
        )}
        {action.customer_name && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            👤 {action.customer_name}
          </div>
        )}
      </div>

      {/* Customer picker */}
      {needsCustomer && customers.length > 0 && (
        <select
          value={customerId}
          onChange={e => setCustomerId(Number(e.target.value) || '')}
          style={{
            width: '100%', marginBottom: '8px', padding: '5px 8px',
            borderRadius: '7px', fontSize: '12px',
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">— 选择关联客户 —</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={handleSave}
          disabled={saving || (needsCustomer && !customerId)}
          style={{
            flex: 1, padding: '6px 10px', borderRadius: '7px',
            fontSize: '12px', fontWeight: 600,
            color: 'white',
            background: saving || (needsCustomer && !customerId) ? 'var(--bg-input)' : cfg.color,
            border: 'none',
            cursor: saving || (needsCustomer && !customerId) ? 'default' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? '保存中...' : cfg.label}
        </button>
        <button
          onClick={onSkip}
          style={{
            padding: '6px 10px', borderRadius: '7px',
            fontSize: '12px', color: 'var(--text-muted)',
            background: 'transparent', border: '1px solid var(--border)',
            cursor: 'pointer',
          }}
        >
          跳过
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [mounted, setMounted] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const touchStartY = useRef<number | null>(null);

  // ── helpers ──────────────────────────────────────────────────────────────────

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  };

  const closePanel = () => { stopListening(); setOpen(false); };

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'zh-CN'; rec.continuous = false; rec.interimResults = false;
    rec.onresult = (e: any) => { setInput(e.results[0][0].transcript); setListening(false); recognitionRef.current = null; };
    rec.onerror = () => { setListening(false); recognitionRef.current = null; };
    rec.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const toggleVoice = () => { if (listening) stopListening(); else startListening(); };

  const onTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    if (touchStartY.current - e.changedTouches[0].clientY > 60) closePanel();
    touchStartY.current = null;
  };

  const sendMessage = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    setInput('');
    const newMsg: Message = { role: 'user', content: t };
    setMessages(prev => [...prev, newMsg]);
    setLoading(true);
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: t, history }),
      });
      const data = await res.json();
      const action = (data.action?.type && data.action.type !== 'none') ? data.action as ActionData : null;
      if (!res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error || '请求失败，请重试' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply, action, actionState: null }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '网络错误，请重试' }]);
    } finally {
      setLoading(false);
    }
  };

  const saveAction = async (msgIndex: number, action: ActionData, customerId?: number) => {
    if (action.type === 'follow_up' && customerId) {
      await fetch(`/api/customers/${customerId}/follow-ups`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: action.title || '跟进记录', content: action.content || '', follow_up_date: action.date || null }),
      });
    } else if (action.type === 'schedule') {
      await fetch('/api/calendar-events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: action.title || '日程', event_date: action.date, event_time: action.time || null, description: action.description || '' }),
      });
    } else if (action.type === 'reminder' && customerId) {
      await fetch('/api/reminders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, content: action.content || action.title || '提醒', remind_date: action.date || null }),
      });
    }
    setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, actionState: 'saved' } : m));
  };

  const skipAction = (msgIndex: number) => {
    setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, actionState: 'skipped' } : m));
  };

  // ── effects ──────────────────────────────────────────────────────────────────

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener('open-ai-assistant', h);
    return () => window.removeEventListener('open-ai-assistant', h);
  }, []);

  useEffect(() => {
    setVoiceOk('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }, []);

  useEffect(() => {
    if (open && customers.length === 0) {
      fetch('/api/customers').then(r => r.json()).then((d: Customer[]) => setCustomers(d)).catch(() => {});
    }
  }, [open, customers.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 350);
  }, [open]);

  if (!mounted) return null;

  // ── render ───────────────────────────────────────────────────────────────────

  return createPortal(
    <>
      {/* ── Backdrop ── */}
      {open && (
        <div
          onClick={closePanel}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* ── Bottom sheet ── */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0,
          zIndex: 1001,
          height: '82dvh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-card)',
          borderRadius: '20px 20px 0 0',
          borderTop: '1px solid var(--border)',
          boxShadow: '0 -12px 48px rgba(0,0,0,0.45)',
          transform: open ? 'translateY(0)' : 'translateY(105%)',
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '10px 16px 8px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 10px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>AI 助手</p>
                <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>向上滑动关闭 · 可识别日程信息</p>
              </div>
            </div>
            <button onClick={closePanel} style={{
              width: 28, height: 28, borderRadius: '50%',
              border: 'none', background: 'var(--bg-input)',
              color: 'var(--text-muted)', cursor: 'pointer',
              fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}>×</button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✨</div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 6px' }}>你好，我是 AI 助手</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 18px', lineHeight: 1.7 }}>
                告诉我你的工作内容，我会自动识别<br />
                📅 可加入日程的内容，并提醒你保存
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                {['明天上午约了张总见面', '下周三开产品发布会', '刚跟李总通话谈了合同'].map(s => (
                  <button key={s} onClick={() => sendMessage(s)} style={{
                    fontSize: 11, padding: '5px 12px', borderRadius: 16,
                    border: '1px solid var(--border)', background: 'var(--bg-input)',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                  }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {/* Bubble */}
              <div style={{
                maxWidth: '84%', padding: '9px 13px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                fontSize: 13, lineHeight: 1.6,
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                  : 'var(--bg-inner)',
                color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {msg.content}
              </div>

              {/* Inline action suggestion for assistant messages */}
              {msg.role === 'assistant' && msg.action && !msg.actionState && (
                <ActionSuggestionCard
                  action={msg.action}
                  customers={customers}
                  onSave={async (cid) => { await saveAction(i, msg.action!, cid); }}
                  onSkip={() => skipAction(i)}
                />
              )}

              {/* Saved confirmation */}
              {msg.role === 'assistant' && msg.actionState === 'saved' && (
                <div style={{
                  marginTop: 6, padding: '7px 12px', borderRadius: 10,
                  background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
                  fontSize: 12, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  ✓ 已保存
                </div>
              )}
            </div>
          ))}

          {/* Loading dots */}
          {loading && (
            <div style={{ display: 'flex' }}>
              <div style={{
                padding: '10px 14px', borderRadius: '4px 16px 16px 16px',
                background: 'var(--bg-inner)', border: '1px solid var(--border)',
                display: 'flex', gap: 4,
              }}>
                {[0,1,2].map(i => (
                  <span key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#6366f1',
                    display: 'inline-block',
                    animation: `ai-bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={{
          padding: `8px 12px calc(env(safe-area-inset-bottom,0px) + 10px)`,
          flexShrink: 0, borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-card)',
        }}>
          {voiceOk && (
            <button onClick={toggleVoice} style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
              background: listening ? 'rgba(239,68,68,0.15)' : 'var(--bg-input)',
              color: listening ? '#f87171' : 'var(--text-muted)',
              border: listening ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <MicIcon active={listening} />
            </button>
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder={listening ? '正在聆听...' : '发送消息，AI会识别日程信息…'}
            disabled={loading}
            style={{
              flex: 1, padding: '9px 14px', borderRadius: 20,
              fontSize: 14, background: 'var(--bg-input)',
              border: '1px solid var(--border)', color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 38, height: 38, borderRadius: '50%', border: 'none', flexShrink: 0,
              background: input.trim() && !loading ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'var(--bg-input)',
              color: input.trim() && !loading ? 'white' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() && !loading ? 'pointer' : 'default',
            }}
          >
            <SendIcon />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes ai-bounce {
          0%,80%,100% { transform:scale(0.55); opacity:0.4 }
          40% { transform:scale(1); opacity:1 }
        }
      `}</style>
    </>,
    document.body
  );
}
