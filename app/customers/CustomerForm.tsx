'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const AddressPicker = dynamic(() => import('./AddressPicker'), { ssr: false });

const SUGGESTED_TAGS = ['重要客户', '待跟进', 'VIP', '新客户', '老客户'];
const SHAPE_ICONS: Record<string, string> = {
  circle: '●', square: '■', diamond: '◆', triangle: '▲', star: '★', cross: '✕',
};

interface CAttr { id: number; key: string; label: string; color: string; }
interface CStatus { id: number; key: string; label: string; shape: string; color: string; }
interface FormData {
  name: string; customer_attribute: string; customer_status: string;
  address: string; contact_name: string; contact_info: string; wechat_id: string; tags: string[];
}
interface Props { initial?: Partial<FormData>; customerId?: number; }

const IC = 'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors';
const IS = { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' };

export default function CustomerForm({ initial, customerId }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({
    name: '', customer_attribute: '', customer_status: '',
    address: '', contact_name: '', contact_info: '', wechat_id: '', tags: [],
    ...initial,
  });
  const [attributes, setAttributes] = useState<CAttr[]>([]);
  const [statuses, setStatuses] = useState<CStatus[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/customer-attributes').then(r => r.json()),
      fetch('/api/customer-statuses').then(r => r.json()),
    ]).then(([a, s]) => { setAttributes(a); setStatuses(s); }).catch(() => {});
  }, []);

  const set = (field: keyof FormData, value: string | string[]) =>
    setForm(f => ({ ...f, [field]: value }));
  const addTag = (tag: string) => { const t = tag.trim(); if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]); setTagInput(''); };
  const removeTag = (tag: string) => set('tags', form.tags.filter(t => t !== tag));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!form.name.trim()) { setError('请填写客户名称'); return; }
    if (!form.customer_attribute) { setError('请选择客户属性'); return; }
    if (!form.customer_status) { setError('请选择客户状态'); return; }
    setSaving(true);
    try {
      const url = customerId ? `/api/customers/${customerId}` : '/api/customers';
      const res = await fetch(url, { method: customerId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) { setError((await res.json()).error || '保存失败'); return; }
      const data = await res.json();
      router.push(`/customers/${customerId || data.id}`); router.refresh();
    } catch { setError('网络错误，请重试'); } finally { setSaving(false); }
  };

  const selAttr = attributes.find(a => a.key === form.customer_attribute);
  const selStatus = statuses.find(s => s.key === form.customer_status);

  return (
    <>
    {showPicker && <AddressPicker onSelect={addr => { set('address', addr); setShowPicker(false); }} onClose={() => setShowPicker(false)} />}
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '13px', color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</div>
      )}

      {/* ── 基本信息区 ── */}
      <Section label="基本信息">
        {/* 客户名称 */}
        <Field label="客户名称" required>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="请输入客户名称" className={IC} style={IS} />
        </Field>

        {/* 联系人 + 联系方式 — 桌面并排 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px' }}>
          <Field label="联系人">
            <input type="text" value={form.contact_name} onChange={e => set('contact_name', e.target.value)}
              placeholder="联系人姓名" className={IC} style={IS} />
          </Field>
          <Field label="联系方式">
            <input type="text" value={form.contact_info} onChange={e => set('contact_info', e.target.value)}
              placeholder="电话 / 邮箱" className={IC} style={IS} />
          </Field>
        </div>

        {/* 微信号 */}
        <Field label="微信号" hint="填写后可一键跳转微信">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#07c160', display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.295.295a.328.328 0 00.168-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.603-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.136 0 .246-.11.246-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.49.49 0 01.177-.554C22.956 18.117 24 16.487 24 14.667c0-3.12-2.843-5.842-7.063-5.809zM14.59 13.24c-.535 0-.969-.44-.969-.982 0-.542.434-.982.97-.982.535 0 .97.44.97.982 0 .542-.435.982-.97.982zm4.797 0c-.535 0-.969-.44-.969-.982 0-.542.434-.982.97-.982.535 0 .97.44.97.982 0 .542-.434.982-.97.982z"/></svg>
            </span>
            <input type="text" value={form.wechat_id} onChange={e => set('wechat_id', e.target.value)}
              placeholder="输入微信号（非昵称）" className={IC} style={{ ...IS, paddingLeft: '2rem' }} />
          </div>
        </Field>

        {/* 地址 */}
        <Field label="地址">
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="请输入客户地址" className={IC} style={IS} />
            <button type="button" onClick={() => setShowPicker(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              地图选点
            </button>
          </div>
        </Field>
      </Section>

      {/* ── 客户分类区 ── */}
      <Section label="客户分类">
        {/* 客户属性 */}
        <Field label="客户属性" required hint="决定地图颜色">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {attributes.map(a => (
              <button key={a.key} type="button" onClick={() => set('customer_attribute', a.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s',
                  background: form.customer_attribute === a.key ? `${a.color}22` : 'var(--bg-input)',
                  border: `1.5px solid ${form.customer_attribute === a.key ? a.color : 'var(--border)'}`,
                  color: form.customer_attribute === a.key ? a.color : 'var(--text-secondary)',
                  fontWeight: form.customer_attribute === a.key ? 600 : 400,
                }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: a.color }} />
                {a.label}
              </button>
            ))}
          </div>
        </Field>

        {/* 客户状态 */}
        <Field label="客户状态" required hint="决定地图形状">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {statuses.map(s => (
              <button key={s.key} type="button" onClick={() => set('customer_status', s.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s',
                  background: form.customer_status === s.key ? `${s.color}22` : 'var(--bg-input)',
                  border: `1.5px solid ${form.customer_status === s.key ? s.color : 'var(--border)'}`,
                  color: form.customer_status === s.key ? s.color : 'var(--text-secondary)',
                  fontWeight: form.customer_status === s.key ? 600 : 400,
                }}>
                <span style={{ fontSize: '11px', color: form.customer_status === s.key ? s.color : 'var(--text-muted)' }}>{SHAPE_ICONS[s.shape] || '●'}</span>
                {s.label}
              </button>
            ))}
          </div>
        </Field>

        {/* 地图标记预览 */}
        {selAttr && selStatus && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-inner)', fontSize: '12px' }}>
            <MapMarkerPreview color={selAttr.color} shape={selStatus.shape} />
            <div>
              <span style={{ color: 'var(--text-muted)' }}>地图标记预览：</span>
              <span style={{ color: selAttr.color, fontWeight: 600 }}>{selAttr.label}</span>
              <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>·</span>
              <span style={{ color: selStatus.color, fontWeight: 600 }}>{selStatus.label}</span>
            </div>
          </div>
        )}
        {(!selAttr || !selStatus) && (
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
            {!selAttr && !selStatus ? '请选择客户属性和状态' : !selAttr ? '请选择客户属性' : '请选择客户状态'}
          </p>
        )}
      </Section>

      {/* ── 客户标签区（可选）── */}
      <Section label="客户标签" optional>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
            placeholder="输入标签后按回车添加" className={IC} style={IS} />
          <button type="button" onClick={() => addTag(tagInput)}
            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', flexShrink: 0, color: 'var(--text-secondary)', background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer' }}>添加</button>
        </div>
        {form.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {form.tags.map(tag => (
              <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', color: '#93c5fd', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
                {tag}
                <button type="button" onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>快速选择：</span>
          {SUGGESTED_TAGS.filter(t => !form.tags.includes(t)).map(tag => (
            <button key={tag} type="button" onClick={() => addTag(tag)}
              style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', color: 'var(--text-muted)', background: 'none', border: '1px dashed var(--border-light)', cursor: 'pointer' }}>
              + {tag}
            </button>
          ))}
        </div>
      </Section>

      {/* ── 操作按钮 ── */}
      <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
        <button type="submit" disabled={saving}
          style={{ padding: '9px 28px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white', background: saving ? '#3b82f6aa' : '#3b82f6', border: 'none', cursor: saving ? 'default' : 'pointer', transition: 'background 0.15s' }}>
          {saving ? '保存中...' : '保存'}
        </button>
        <button type="button" onClick={() => router.back()}
          style={{ padding: '9px 20px', borderRadius: '8px', fontSize: '14px', color: 'var(--text-secondary)', background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer' }}>
          取消
        </button>
      </div>
    </form>
    </>
  );
}

function Section({ label, children, optional }: { label: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <div style={{ borderRadius: '12px', padding: '16px', background: 'var(--bg-inner)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '2px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        {optional && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>可选</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>
        {required && <span style={{ color: '#f87171', fontSize: '12px' }}>*</span>}
        {hint && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function MapMarkerPreview({ color, shape }: { color: string; shape: string }) {
  const s = 22;
  const shapeEl = () => {
    switch (shape) {
      case 'circle': return <circle cx={s/2} cy={s/2} r={8} fill={color} stroke="white" strokeWidth="1.5" />;
      case 'square': return <rect x={s/2-7} y={s/2-7} width={14} height={14} fill={color} stroke="white" strokeWidth="1.5" />;
      case 'diamond': return <polygon points={`${s/2},${s/2-9} ${s/2+9},${s/2} ${s/2},${s/2+9} ${s/2-9},${s/2}`} fill={color} stroke="white" strokeWidth="1.5" />;
      case 'triangle': return <polygon points={`${s/2},${s/2-9} ${s/2+9},${s/2+7} ${s/2-9},${s/2+7}`} fill={color} stroke="white" strokeWidth="1.5" />;
      case 'star': return <polygon points={`${s/2},${s/2-9} ${s/2+2.5},${s/2-3} ${s/2+9},${s/2-3} ${s/2+4},${s/2+2} ${s/2+6},${s/2+9} ${s/2},${s/2+5} ${s/2-6},${s/2+9} ${s/2-4},${s/2+2} ${s/2-9},${s/2-3} ${s/2-2.5},${s/2-3}`} fill={color} stroke="white" strokeWidth="1" />;
      case 'cross': return <><line x1={s/2-7} y1={s/2-7} x2={s/2+7} y2={s/2+7} stroke={color} strokeWidth="3" strokeLinecap="round" /><line x1={s/2+7} y1={s/2-7} x2={s/2-7} y2={s/2+7} stroke={color} strokeWidth="3" strokeLinecap="round" /></>;
      default: return <circle cx={s/2} cy={s/2} r={8} fill={color} stroke="white" strokeWidth="1.5" />;
    }
  };
  return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>{shapeEl()}</svg>;
}
