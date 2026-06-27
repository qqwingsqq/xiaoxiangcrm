'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useDevice } from '../DevicePreviewProvider';

type Theme = 'dark' | 'light' | 'system';
type Shortcut = 'vol-down-double' | 'power-vol-down';

interface Profile {
  display_name: string; phone: string; company: string;
  title: string; wechat_id: string;
  theme: Theme; record_shortcut: Shortcut;
  amap_key: string; amap_security: string;
}

const DEFAULT_PROFILE: Profile = {
  display_name: '', phone: '', company: '', title: '', wechat_id: '',
  theme: 'dark', record_shortcut: 'vol-down-double',
  amap_key: '', amap_security: '',
};

async function hashPassword(pw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Shared constants ───────────────────────────────────────
const PRESET_COLORS = [
  '#a855f7', '#10b981', '#3b82f6', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316',
  '#6366f1', '#84cc16', '#06b6d4', '#8b5cf6',
];

const SHAPES = [
  { key: 'circle', label: '圆形' },
  { key: 'triangle', label: '三角' },
  { key: 'square', label: '方形' },
  { key: 'star', label: '星形' },
  { key: 'cross', label: '叉形' },
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map(c => (
        <button key={c} onClick={() => onChange(c)}
          className="w-6 h-6 rounded-full transition-transform"
          style={{ background: c, outline: value === c ? `2px solid ${c}` : 'none', outlineOffset: '2px', transform: value === c ? 'scale(1.2)' : 'scale(1)' }} />
      ))}
    </div>
  );
}

// ── Customer attribute manager ─────────────────────────────
interface CAttr { id: number; key: string; label: string; color: string; }

function CustomerAttrManager() {
  const [items, setItems] = useState<CAttr[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [addLabel, setAddLabel] = useState('');
  const [addColor, setAddColor] = useState(PRESET_COLORS[2]);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => fetch('/api/customer-attributes').then(r => r.json()).then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const startEdit = (t: CAttr) => { setEditingId(t.id); setEditLabel(t.label); setEditColor(t.color); setError(''); };
  const cancelEdit = () => { setEditingId(null); setError(''); };

  const saveEdit = async (id: number) => {
    if (!editLabel.trim()) { setError('属性名称不能为空'); return; }
    setSaving(true);
    const res = await fetch(`/api/customer-attributes/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: editLabel.trim(), color: editColor }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error || '保存失败'); return; }
    setEditingId(null); load();
  };

  const deleteItem = async (id: number, label: string) => {
    if (!confirm(`确认删除「${label}」属性？`)) return;
    const res = await fetch(`/api/customer-attributes/${id}`, { method: 'DELETE' });
    if (!res.ok) { alert((await res.json()).error || '删除失败'); return; }
    load();
  };

  const addItem = async () => {
    if (!addLabel.trim()) { setError('请填写属性名称'); return; }
    setSaving(true);
    const res = await fetch('/api/customer-attributes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: addLabel.trim(), color: addColor }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error || '添加失败'); return; }
    setAddLabel(''); setAddOpen(false); setError(''); load();
  };

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>客户属性管理</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>地图中颜色对应客户属性，可自定义名称和颜色</p>
        </div>
        <button onClick={() => { setAddOpen(o => !o); setError(''); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加属性
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
      {addOpen && (
        <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>新增客户属性</p>
          <input value={addLabel} onChange={e => setAddLabel(e.target.value)} placeholder="属性名称"
            className="w-full px-3 py-2 rounded-lg text-sm mb-2 outline-none"
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          <div className="mb-3"><ColorPicker value={addColor} onChange={setAddColor} /></div>
          <div className="flex gap-2">
            <button onClick={addItem} disabled={saving}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
              style={{ background: addColor }}>{saving ? '保存中…' : '确认添加'}</button>
            <button onClick={() => { setAddOpen(false); setError(''); }}
              className="px-4 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>取消</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {items.length === 0 && <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>加载中…</p>}
        {items.map(t => (
          <div key={t.id}>
            {editingId === t.id ? (
              <div className="p-3 rounded-xl" style={{ background: 'var(--bg-input)', border: `1px solid ${t.color}40` }}>
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="属性名称"
                  className="w-full px-3 py-2 rounded-lg text-sm mb-2 outline-none"
                  style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                <div className="mb-3"><ColorPicker value={editColor} onChange={setEditColor} /></div>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(t.id)} disabled={saving}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: editColor }}>{saving ? '保存中…' : '保存'}</button>
                  <button onClick={cancelEdit}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>取消</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)' }}>
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />
                <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{t.label}</span>
                <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-zinc-700" style={{ color: 'var(--text-muted)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={() => deleteItem(t.id, t.label)} className="p-1.5 rounded-lg hover:bg-red-900/40" style={{ color: '#ef4444' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Customer status manager ────────────────────────────────
interface CStatus { id: number; key: string; label: string; color: string; shape: string; }

function CustomerStatusManager() {
  const [items, setItems] = useState<CStatus[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editShape, setEditShape] = useState('circle');
  const [addLabel, setAddLabel] = useState('');
  const [addColor, setAddColor] = useState(PRESET_COLORS[3]);
  const [addShape, setAddShape] = useState('circle');
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => fetch('/api/customer-statuses').then(r => r.json()).then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const startEdit = (t: CStatus) => { setEditingId(t.id); setEditLabel(t.label); setEditColor(t.color); setEditShape(t.shape); setError(''); };
  const cancelEdit = () => { setEditingId(null); setError(''); };

  const saveEdit = async (id: number) => {
    if (!editLabel.trim()) { setError('状态名称不能为空'); return; }
    setSaving(true);
    const res = await fetch(`/api/customer-statuses/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: editLabel.trim(), color: editColor, shape: editShape }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error || '保存失败'); return; }
    setEditingId(null); load();
  };

  const deleteItem = async (id: number, label: string) => {
    if (!confirm(`确认删除「${label}」状态？`)) return;
    const res = await fetch(`/api/customer-statuses/${id}`, { method: 'DELETE' });
    if (!res.ok) { alert((await res.json()).error || '删除失败'); return; }
    load();
  };

  const addItem = async () => {
    if (!addLabel.trim()) { setError('请填写状态名称'); return; }
    setSaving(true);
    const res = await fetch('/api/customer-statuses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: addLabel.trim(), color: addColor, shape: addShape }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error || '添加失败'); return; }
    setAddLabel(''); setAddOpen(false); setError(''); load();
  };

  const ShapePicker = ({ value, onChange }: { value: string; onChange: (s: string) => void }) => (
    <div className="flex flex-wrap gap-2">
      {SHAPES.map(s => (
        <button key={s.key} onClick={() => onChange(s.key)}
          className="px-2.5 py-1 rounded-lg text-xs transition-colors"
          style={{ background: value === s.key ? 'rgba(99,102,241,0.2)' : 'var(--bg-base)', border: `1px solid ${value === s.key ? 'var(--accent)' : 'var(--border)'}`, color: value === s.key ? 'var(--accent)' : 'var(--text-secondary)' }}>
          {s.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>客户状态管理</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>地图中形状对应客户状态，可自定义名称、颜色和形状</p>
        </div>
        <button onClick={() => { setAddOpen(o => !o); setError(''); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加状态
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
      {addOpen && (
        <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>新增客户状态</p>
          <input value={addLabel} onChange={e => setAddLabel(e.target.value)} placeholder="状态名称"
            className="w-full px-3 py-2 rounded-lg text-sm mb-2 outline-none"
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>颜色</p>
          <div className="mb-3"><ColorPicker value={addColor} onChange={setAddColor} /></div>
          <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>形状</p>
          <div className="mb-3"><ShapePicker value={addShape} onChange={setAddShape} /></div>
          <div className="flex gap-2">
            <button onClick={addItem} disabled={saving}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
              style={{ background: addColor }}>{saving ? '保存中…' : '确认添加'}</button>
            <button onClick={() => { setAddOpen(false); setError(''); }}
              className="px-4 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>取消</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {items.length === 0 && <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>加载中…</p>}
        {items.map(t => (
          <div key={t.id}>
            {editingId === t.id ? (
              <div className="p-3 rounded-xl" style={{ background: 'var(--bg-input)', border: `1px solid ${t.color}40` }}>
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="状态名称"
                  className="w-full px-3 py-2 rounded-lg text-sm mb-2 outline-none"
                  style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>颜色</p>
                <div className="mb-3"><ColorPicker value={editColor} onChange={setEditColor} /></div>
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>形状</p>
                <div className="mb-3"><ShapePicker value={editShape} onChange={setEditShape} /></div>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(t.id)} disabled={saving}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: editColor }}>{saving ? '保存中…' : '保存'}</button>
                  <button onClick={cancelEdit}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>取消</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)' }}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: t.color + '22', color: t.color, border: `1px solid ${t.color}44` }}>{SHAPES.find(s => s.key === t.shape)?.label || t.shape}</span>
                <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{t.label}</span>
                <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-zinc-700" style={{ color: 'var(--text-muted)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={() => deleteItem(t.id, t.label)} className="p-1.5 rounded-lg hover:bg-red-900/40" style={{ color: '#ef4444' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shared input styles ───────────────────────────────────
const INP_CLS = 'w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors';
const INP_ST: React.CSSProperties = { background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  );
}

function SelectField({ label, value, onChange, options, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; hint?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <select value={value} onChange={e => onChange(e.target.value)}
          style={{ width: '100%', padding: '10px 36px 10px 12px', borderRadius: '12px', fontSize: '13px', outline: 'none', WebkitAppearance: 'none', appearance: 'none', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer' }}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <svg style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', width: '15px', height: '15px', color: 'var(--text-muted)' }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {hint && <div className="mt-2">{hint}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-semibold mb-4 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{title}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// ── Profile card (view mode) ──────────────────────────────
function ProfileCard({ profile, passwordSet, onEdit }: { profile: Profile; passwordSet: boolean; onEdit: () => void }) {
  const hasInfo = profile.display_name || profile.company || profile.phone;
  const initial = profile.display_name?.charAt(0)?.toUpperCase() || profile.company?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="rounded-2xl p-5 relative" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <button onClick={onEdit}
        className="absolute top-4 right-4 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium"
        style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' }}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        编辑
      </button>

      {!hasInfo ? (
        <div className="flex flex-col items-center justify-center py-6 gap-3">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
            style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', border: '2px dashed var(--border)' }}>
            ?
          </div>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>尚未填写个人信息</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>点击右上角「编辑」开始填写</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-4 pr-16">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
            style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
            {initial}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            {profile.display_name && <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{profile.display_name}</p>}
            {(profile.title || profile.company) && (
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{[profile.title, profile.company].filter(Boolean).join(' @ ')}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 pt-0.5">
              {profile.phone && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>📱 {profile.phone}</span>}
              {profile.wechat_id && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>💬 {profile.wechat_id}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Password + Amap status row */}
      <div className="mt-4 pt-3 border-t flex items-center gap-4 flex-wrap" style={{ borderColor: 'var(--border)' }}>
        <span className={`flex items-center gap-1.5 text-xs ${passwordSet ? 'text-emerald-400' : 'text-amber-400'}`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          {passwordSet ? '已设置密码' : '未设置密码'}
        </span>
        <span className={`flex items-center gap-1.5 text-xs ${profile.amap_key ? 'text-emerald-400' : 'text-amber-400'}`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          {profile.amap_key ? '高德 Key 已配置' : '高德 Key 未配置'}
        </span>
      </div>
    </div>
  );
}

// ── Amap key edit modal ───────────────────────────────────
function AmapKeyModal({ current, currentSec, onSave, onClose }: {
  current: string; currentSec: string;
  onSave: (key: string, sec: string) => void; onClose: () => void;
}) {
  const [key, setKey] = useState(current);
  const [sec, setSec] = useState(currentSec);
  const [saving, setSaving] = useState(false);

  const doSave = async () => {
    if (!key.trim()) return;
    setSaving(true);
    await onSave(key.trim(), sec.trim());
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}>
      <div style={{ width: '100%', maxWidth: '400px', borderRadius: '20px', padding: '24px', background: '#1a1a20', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>修改高德地图 API Key</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>在 lbs.amap.com 控制台获取</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>
        <div className="space-y-3">
          <Field label="API Key *">
            <input value={key} onChange={e => setKey(e.target.value)} placeholder="粘贴高德 JS API Key"
              className={INP_CLS} style={INP_ST} autoFocus />
          </Field>
          <Field label="安全密钥（地理编码必填）">
            <input value={sec} onChange={e => setSec(e.target.value)} placeholder="粘贴 securityJsCode"
              className={INP_CLS} style={INP_ST} />
          </Field>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            取消
          </button>
          <button onClick={doSave} disabled={!key.trim() || saving}
            className="flex-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
            style={{ flex: 2, background: '#2563eb' }}>
            {saving ? '保存中…' : '保存 Key'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main settings page ────────────────────────────────────
export default function SettingsPage() {
  const { device } = useDevice();
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Profile>(DEFAULT_PROFILE);
  const [passwordSet, setPasswordSet] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [amapEditOpen, setAmapEditOpen] = useState(false);
  const [aiKey, setAiKey] = useState('');
  const [aiKeySaved, setAiKeySaved] = useState('');
  const [aiKeyEditing, setAiKeyEditing] = useState(false);
  const [aiKeyTesting, setAiKeyTesting] = useState(false);
  const [aiKeyStatus, setAiKeyStatus] = useState<'idle'|'valid'|'invalid'>('idle');
  const [aiKeyError, setAiKeyError] = useState('');
  const [oaiKey, setOaiKey] = useState('');
  const [oaiKeySaved, setOaiKeySaved] = useState('');
  const [oaiKeyEditing, setOaiKeyEditing] = useState(false);
  const [oaiKeySaving, setOaiKeySaving] = useState(false);

  useEffect(() => {
    const fromLocal = (): Profile => ({
      display_name: localStorage.getItem('crm-display-name') || '',
      phone: localStorage.getItem('crm-phone') || '',
      company: localStorage.getItem('crm-company') || '',
      title: localStorage.getItem('crm-title') || '',
      wechat_id: localStorage.getItem('crm-wechat-id') || '',
      amap_key: localStorage.getItem('crm-amap-key') || '',
      amap_security: localStorage.getItem('crm-amap-security') || '',
      theme: (localStorage.getItem('crm-theme') as Theme) || 'dark',
      record_shortcut: (localStorage.getItem('crm-record-shortcut') as Shortcut) || 'vol-down-double',
    });
    const localPwSet = !!localStorage.getItem('crm-password-hash');
    const local = fromLocal();
    setProfile(local); setForm(local);
    setPasswordSet(localPwSet);
    setLoaded(true);

    fetch('/api/settings').then(r => r.json()).then((data: Record<string, string>) => {
      if (!data || Object.keys(data).length === 0) return;
      const merged: Profile = {
        display_name: data.display_name ?? local.display_name,
        phone: data.phone ?? local.phone,
        company: data.company ?? local.company,
        title: data.title ?? local.title,
        wechat_id: data.wechat_id ?? local.wechat_id,
        amap_key: data.amap_key ?? local.amap_key,
        amap_security: data.amap_security ?? local.amap_security,
        theme: (data.theme as Theme) ?? local.theme,
        record_shortcut: (data.record_shortcut as Shortcut) ?? local.record_shortcut,
      };
      const mergedPwSet = localPwSet || !!data.password_hash;
      localStorage.setItem('crm-display-name', merged.display_name);
      localStorage.setItem('crm-phone', merged.phone);
      localStorage.setItem('crm-company', merged.company);
      localStorage.setItem('crm-title', merged.title);
      localStorage.setItem('crm-wechat-id', merged.wechat_id);
      if (merged.amap_key) { localStorage.setItem('crm-amap-key', merged.amap_key); localStorage.setItem('crm-amap-security', merged.amap_security); }
      localStorage.setItem('crm-theme', merged.theme);
      localStorage.setItem('crm-record-shortcut', merged.record_shortcut);
      if (data.password_hash) localStorage.setItem('crm-password-hash', data.password_hash);
      setProfile(merged); setForm(merged);
      setPasswordSet(mergedPwSet);
      document.documentElement.setAttribute('data-theme', merged.theme);
      if (data.anthropic_key) { setAiKeySaved(data.anthropic_key); setAiKeyStatus('valid'); }
      if (data.openai_key) setOaiKeySaved(data.openai_key);
    }).catch(() => {});
    // Also check localStorage
    const localAiKey = localStorage.getItem('crm-anthropic-key') || '';
    if (localAiKey) { setAiKeySaved(localAiKey); setAiKeyStatus('valid'); }
    const localOaiKey = localStorage.getItem('crm-openai-key') || '';
    if (localOaiKey) setOaiKeySaved(localOaiKey);
  }, []);

  const pwMismatch = !!pwInput && pwInput !== pwConfirm;
  const pwOk = !pwInput || pwInput === pwConfirm;

  const save = async () => {
    if (!pwOk) return;
    setSaving(true);
    // Theme + local
    localStorage.setItem('crm-display-name', form.display_name);
    localStorage.setItem('crm-phone', form.phone);
    localStorage.setItem('crm-company', form.company);
    localStorage.setItem('crm-title', form.title);
    localStorage.setItem('crm-wechat-id', form.wechat_id);
    localStorage.setItem('crm-theme', form.theme);
    localStorage.setItem('crm-record-shortcut', form.record_shortcut);
    document.documentElement.setAttribute('data-theme', form.theme);

    const payload: Record<string, string> = {
      display_name: form.display_name, phone: form.phone, company: form.company,
      title: form.title, wechat_id: form.wechat_id,
      theme: form.theme, record_shortcut: form.record_shortcut,
    };
    // Password
    if (pwInput) {
      const hash = await hashPassword(pwInput);
      payload.password_hash = hash;
      localStorage.setItem('crm-password-hash', hash);
      setPasswordSet(true);
    }
    await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
    setProfile(form);
    setSaving(false); setSaved(true);
    setEditing(false); setPwInput(''); setPwConfirm('');
    setTimeout(() => setSaved(false), 2500);
  };

  const saveAmapKey = async (key: string, sec: string) => {
    const newForm = { ...form, amap_key: key, amap_security: sec };
    setForm(newForm); setProfile(p => ({ ...p, amap_key: key, amap_security: sec }));
    localStorage.setItem('crm-amap-key', key);
    localStorage.setItem('crm-amap-security', sec);
    await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amap_key: key, amap_security: sec }),
    }).catch(() => {});
    setAmapEditOpen(false);
  };

  const set = (k: keyof Profile, v: string) => setForm(f => ({ ...f, [k]: v }));
  const maxW = device === 'desktop' ? 'max-w-xl mx-auto' : device === 'tablet' ? 'max-w-lg mx-auto' : '';

  const themeOptions = [
    { value: 'dark', label: '🌙  深色模式（深色背景）' },
    { value: 'light', label: '☀️  浅色模式（浅色背景）' },
    { value: 'system', label: '📱  跟随系统（自动切换）' },
  ];

  const shortcutOptions = [
    { value: 'vol-down-double', label: '连按两次音量减键' },
    { value: 'power-vol-down', label: '同时按电源键 + 音量减键' },
  ];

  if (!loaded) return null;

  return (
    <div className={maxW}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-xl"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>设置</h1>
        </div>
        {saved && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            已同步到云端
          </span>
        )}
      </div>

      <div className="space-y-4">

        {/* ── Profile card / edit form ── */}
        {!editing ? (
          <ProfileCard profile={profile} passwordSet={passwordSet} onEdit={() => { setForm(profile); setEditing(true); setPwInput(''); setPwConfirm(''); }} />
        ) : (
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>个人信息</p>
              <button onClick={() => setEditing(false)} className="text-xs" style={{ color: 'var(--text-muted)' }}>取消</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="姓名">
                <input value={form.display_name} onChange={e => set('display_name', e.target.value)}
                  placeholder="你的名字" className={INP_CLS} style={INP_ST} />
              </Field>
              <Field label="手机号">
                <input value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="138xxxxxxxx" className={INP_CLS} style={INP_ST} type="tel" />
              </Field>
              <Field label="公司">
                <input value={form.company} onChange={e => set('company', e.target.value)}
                  placeholder="所在公司" className={INP_CLS} style={INP_ST} />
              </Field>
              <Field label="职位">
                <input value={form.title} onChange={e => set('title', e.target.value)}
                  placeholder="职位/职称" className={INP_CLS} style={INP_ST} />
              </Field>
            </div>
            <Field label="微信号">
              <input value={form.wechat_id} onChange={e => set('wechat_id', e.target.value)}
                placeholder="微信号" className={INP_CLS} style={INP_ST} />
            </Field>

            {/* ── Password section ── */}
            <div className="pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
                {passwordSet ? '修改登录密码' : '设置登录密码'}
                <span className="ml-2 font-normal" style={{ color: 'var(--text-muted)' }}>（留空则不修改）</span>
              </p>
              <div className="space-y-3">
                <Field label={passwordSet ? '新密码' : '密码'} hint="密码经过加密后保存到云端，可跨设备登录">
                  <div style={{ position: 'relative' }}>
                    <input type={showPw ? 'text' : 'password'} value={pwInput} onChange={e => setPwInput(e.target.value)}
                      placeholder={passwordSet ? '输入新密码（留空不修改）' : '设置登录密码'}
                      className={INP_CLS} style={{ ...INP_ST, paddingRight: '40px' }} />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {showPw ? '隐藏' : '显示'}
                    </button>
                  </div>
                </Field>
                {pwInput && (
                  <Field label="确认密码">
                    <input type={showPw ? 'text' : 'password'} value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
                      placeholder="再次输入密码"
                      className={INP_CLS} style={{ ...INP_ST, borderColor: pwMismatch ? '#ef4444' : 'var(--border)' }} />
                    {pwMismatch && <p className="text-xs mt-1 text-red-400">密码不一致</p>}
                    {!pwMismatch && pwConfirm && <p className="text-xs mt-1 text-emerald-400">✓ 密码一致</p>}
                  </Field>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Theme ── */}
        <Section title="主题颜色">
          <SelectField label="显示主题"
            value={form.theme}
            onChange={v => { set('theme', v); document.documentElement.setAttribute('data-theme', v); }}
            options={themeOptions}
          />
        </Section>

        {/* ── Shortcut ── */}
        <Section title="快速录音快捷键">
          <SelectField label="硬件快捷键方案"
            value={form.record_shortcut}
            onChange={v => set('record_shortcut', v)}
            options={shortcutOptions}
            hint={
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <span className="text-emerald-400 flex-shrink-0">✓</span>
                  <div>
                    <p className="text-xs font-medium text-emerald-400">支持：Android 7.0 及以上</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>需在 APP 内开启"辅助功能"权限后生效</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <span className="text-red-400 flex-shrink-0">✗</span>
                  <div>
                    <p className="text-xs font-medium text-red-400">不支持：iOS / 网页版</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>iOS 系统限制，无法监听后台硬件按键</p>
                  </div>
                </div>
              </div>
            }
          />
        </Section>

        {/* ── Amap Key ── */}
        <Section title="高德地图 API Key">
          {profile.amap_key ? (
            /* Key already saved → show masked + modify button */
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>API Key</span>
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />已配置
                  </span>
                </div>
                <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {profile.amap_key.substring(0, 6)}{'•'.repeat(8)}{profile.amap_key.slice(-4)}
                </p>
                {profile.amap_security && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    安全密钥：{'•'.repeat(6)} 已配置
                  </p>
                )}
              </div>
              <button onClick={() => setAmapEditOpen(true)}
                className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                修改 API Key
              </button>
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Key 已同步到云端，更换设备无需重填</p>
            </div>
          ) : (
            /* No key yet → show input form inline */
            <div className="space-y-3">
              <Field label="API Key *" hint="在 lbs.amap.com 控制台，创建 Web端(JS API) 类型的 Key">
                <input value={form.amap_key} onChange={e => set('amap_key', e.target.value)}
                  placeholder="粘贴高德 JS API Key" className={INP_CLS} style={INP_ST} />
              </Field>
              <Field label="安全密钥" hint="Key 详情页可查，地理编码必填">
                <input value={form.amap_security} onChange={e => set('amap_security', e.target.value)}
                  placeholder="粘贴 securityJsCode" className={INP_CLS} style={INP_ST} />
              </Field>
              <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', color: 'var(--text-muted)' }}>
                保存后 Key 会同步到云端，更换设备无需重新填写
              </div>
            </div>
          )}
        </Section>

        {/* ── Anthropic API Key ── */}
        <Section title="Anthropic API Key（AI 分析功能）">
          {aiKeySaved && !aiKeyEditing ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>API Key</span>
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />已配置
                  </span>
                </div>
                <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {aiKeySaved.substring(0, 7)}{'•'.repeat(10)}{aiKeySaved.slice(-4)}
                </p>
              </div>
              <button onClick={() => { setAiKey(aiKeySaved); setAiKeyEditing(true); setAiKeyStatus('idle'); setAiKeyError(''); }}
                className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                修改 API Key
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="API Key" hint="在 console.anthropic.com → API Keys 中获取">
                <input value={aiKeyEditing ? aiKey : ''} onChange={e => { setAiKey(e.target.value); setAiKeyStatus('idle'); setAiKeyError(''); }}
                  placeholder="sk-ant-api03-..." className={INP_CLS} style={INP_ST} />
              </Field>
              <div className="flex gap-2">
                <button onClick={async () => {
                  if (!aiKey.trim()) return;
                  setAiKeyTesting(true); setAiKeyStatus('idle'); setAiKeyError('');
                  const res = await fetch('/api/test-ai-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: aiKey.trim() }) });
                  const data = await res.json();
                  setAiKeyTesting(false);
                  if (data.valid) {
                    setAiKeyStatus('valid');
                    setAiKeySaved(aiKey.trim());
                    setAiKeyEditing(false);
                    localStorage.setItem('crm-anthropic-key', aiKey.trim());
                    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anthropic_key: aiKey.trim() }) });
                  } else {
                    setAiKeyStatus('invalid'); setAiKeyError(data.error || '验证失败');
                  }
                }} disabled={aiKeyTesting || !aiKey.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: aiKeyStatus === 'valid' ? 'rgba(16,185,129,0.15)' : aiKeyStatus === 'invalid' ? 'rgba(239,68,68,0.1)' : 'var(--accent)', color: aiKeyStatus === 'valid' ? '#34d399' : aiKeyStatus === 'invalid' ? '#f87171' : '#fff', border: 'none', cursor: aiKeyTesting || !aiKey.trim() ? 'default' : 'pointer', opacity: aiKeyTesting || !aiKey.trim() ? 0.5 : 1 }}>
                  {aiKeyTesting ? '验证中…' : aiKeyStatus === 'valid' ? '✓ 验证通过，已保存' : aiKeyStatus === 'invalid' ? '✗ 验证失败' : '验证并保存'}
                </button>
                {aiKeyEditing && (
                  <button onClick={() => { setAiKeyEditing(false); setAiKey(''); setAiKeyStatus('idle'); setAiKeyError(''); }}
                    className="px-4 py-2.5 rounded-xl text-sm"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}>取消</button>
                )}
              </div>
              {aiKeyError && <p className="text-xs text-red-400">{aiKeyError}</p>}
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Key 保存后同步到云端，文档上传、语音总结等 AI 功能均使用此 Key</p>
            </div>
          )}
        </Section>

        {/* ── OpenAI API Key (Whisper) ── */}
        <Section title="OpenAI API Key（语音转写）">
          {oaiKeySaved && !oaiKeyEditing ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>API Key</span>
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />已配置
                  </span>
                </div>
                <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {oaiKeySaved.substring(0, 7)}{'•'.repeat(10)}{oaiKeySaved.slice(-4)}
                </p>
              </div>
              <button onClick={() => { setOaiKey(oaiKeySaved); setOaiKeyEditing(true); }}
                className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                修改 API Key
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="API Key" hint="在 platform.openai.com → API keys 中获取，用于 Whisper 语音转写">
                <input value={oaiKeyEditing ? oaiKey : ''} onChange={e => setOaiKey(e.target.value)}
                  placeholder="sk-proj-..." className={INP_CLS} style={INP_ST} />
              </Field>
              <div className="flex gap-2">
                <button onClick={async () => {
                  if (!oaiKey.trim()) return;
                  setOaiKeySaving(true);
                  await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ openai_key: oaiKey.trim() }) });
                  setOaiKeySaved(oaiKey.trim());
                  localStorage.setItem('crm-openai-key', oaiKey.trim());
                  setOaiKeyEditing(false); setOaiKey('');
                  setOaiKeySaving(false);
                }} disabled={oaiKeySaving || !oaiKey.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'var(--accent)', border: 'none', cursor: oaiKeySaving || !oaiKey.trim() ? 'default' : 'pointer' }}>
                  {oaiKeySaving ? '保存中…' : '保存'}
                </button>
                {oaiKeyEditing && (
                  <button onClick={() => { setOaiKeyEditing(false); setOaiKey(''); }}
                    className="px-4 py-2.5 rounded-xl text-sm"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}>取消</button>
                )}
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>配置后可在录音页面用 Whisper 转写，比浏览器内置识别更准确</p>
            </div>
          )}
        </Section>

        {/* ── Customer attributes ── */}
        <CustomerAttrManager />

        {/* ── Customer statuses ── */}
        <CustomerStatusManager />

        {/* ── Save ── */}
        <button onClick={save} disabled={saving || !pwOk}
          className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: saved ? '#10b981' : 'var(--accent)' }}>
          {saving ? '保存中…' : saved ? '✓ 已保存并同步' : '保存设置'}
        </button>
      </div>

      {/* ── Amap key modal ── */}
      {amapEditOpen && (
        <AmapKeyModal
          current={profile.amap_key} currentSec={profile.amap_security}
          onSave={saveAmapKey} onClose={() => setAmapEditOpen(false)}
        />
      )}
    </div>
  );
}
