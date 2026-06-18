'use client';

import { useState, useEffect } from 'react';

interface CalendarEvent {
  id: number;
  title: string;
  event_date: string;
  event_time: string | null;
  description: string | null;
  is_done: number;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS_CN = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export default function CalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', event_time: '', description: '' });
  const [saving, setSaving] = useState(false);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetch('/api/calendar-events').then(r => r.json()).then(setEvents).catch(() => {});
  }, []);

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const eventDateSet = new Set(
    events.filter(e => e.event_date.startsWith(monthPrefix)).map(e => e.event_date)
  );

  const toDateStr = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const addEvent = async () => {
    if (!form.title.trim() || !selectedDate || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, event_date: selectedDate }),
      });
      const event = await res.json();
      setEvents(prev => [...prev, event]);
      setForm({ title: '', event_time: '', description: '' });
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const markDone = async (id: number) => {
    await fetch(`/api/calendar-events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_done: 1 }),
    });
    setEvents(prev => prev.map(e => e.id === id ? { ...e, is_done: 1 } : e));
  };

  const deleteEvent = async (id: number) => {
    await fetch(`/api/calendar-events/${id}`, { method: 'DELETE' });
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const selectedEvents = selectedDate ? events.filter(e => e.event_date === selectedDate) : [];
  const upcomingEvents = events
    .filter(e => e.event_date >= today && !e.is_done)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 4);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {year}年{MONTHS_CN[month]}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setViewDate(new Date())}
            className="text-xs px-2 py-0.5 rounded"
            style={{ color: 'var(--accent)' }}
          >
            今天
          </button>
          <button
            onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-xs py-0.5" style={{ color: 'var(--text-muted)' }}>{d}</div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`pad-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = toDateStr(day);
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const hasEvent = eventDateSet.has(dateStr);
          return (
            <button
              key={day}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className="relative flex flex-col items-center justify-center rounded-lg text-xs transition-all"
              style={{
                height: 30,
                background: isSelected
                  ? 'var(--accent)'
                  : isToday
                  ? 'rgba(59,130,246,0.12)'
                  : 'transparent',
                color: isSelected ? '#fff' : isToday ? 'var(--accent)' : 'var(--text-primary)',
                fontWeight: isToday || isSelected ? 700 : 400,
              }}
            >
              {day}
              {hasEvent && !isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-red-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date panel */}
      {selectedDate && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {selectedDate.replace(/-/g, '/')} 的日程
            </span>
            <button
              onClick={() => setShowModal(true)}
              className="text-xs px-2.5 py-1 rounded-lg font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              + 添加
            </button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>暂无日程，点击添加</p>
          ) : (
            <div className="space-y-1.5">
              {selectedEvents.map(e => (
                <div key={e.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: 'var(--bg-inner)' }}>
                  <button
                    onClick={() => markDone(e.id)}
                    className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors"
                    style={{
                      borderColor: e.is_done ? '#10b981' : 'var(--border-light)',
                      background: e.is_done ? '#10b981' : 'transparent',
                    }}
                  >
                    {!!e.is_done && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate" style={{
                      color: e.is_done ? 'var(--text-muted)' : 'var(--text-primary)',
                      textDecoration: e.is_done ? 'line-through' : 'none',
                    }}>
                      {e.event_time && <span className="text-blue-400 mr-1.5">{e.event_time}</span>}
                      {e.title}
                    </p>
                    {e.description && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{e.description}</p>
                    )}
                  </div>
                  <button onClick={() => deleteEvent(e.id)} className="text-base leading-none flex-shrink-0" style={{ color: 'var(--text-muted)' }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upcoming events when no date selected */}
      {!selectedDate && upcomingEvents.length > 0 && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>即将到来</p>
          <div className="space-y-1.5">
            {upcomingEvents.map(e => (
              <div key={e.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--bg-inner)' }}>
                <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--accent)', minWidth: 36 }}>
                  {e.event_date.slice(5).replace('-', '/')}
                </span>
                <p className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                  {e.event_time && <span className="text-blue-400 mr-1">{e.event_time}</span>}
                  {e.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add event modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              添加日程 · {selectedDate}
            </h3>
            <div className="space-y-3">
              <input
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="日程标题 *"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              />
              <input
                type="time"
                value={form.event_time}
                onChange={e => setForm(p => ({ ...p, event_time: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              />
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="备注（可选）"
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none outline-none"
                style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
              >
                取消
              </button>
              <button
                onClick={addEvent}
                disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--accent)', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
