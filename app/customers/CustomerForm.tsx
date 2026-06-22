'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const AddressPicker = dynamic(() => import('./AddressPicker'), { ssr: false });

const SUGGESTED_TAGS = ['重要客户', '待跟进', '已成交', 'VIP', '新客户', '老客户'];

interface CustomerType { id: number; key: string; label: string; color: string; }

interface FormData {
  name: string;
  type: string;
  address: string;
  contact_name: string;
  contact_info: string;
  wechat_id: string;
  tags: string[];
}

interface Props {
  initial?: FormData;
  customerId?: number;
}

const inputClass = "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors";
const inputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' };

export default function CustomerForm({ initial, customerId }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(initial || {
    name: '', type: '', address: '', contact_name: '', contact_info: '', wechat_id: '', tags: [],
  });
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    fetch('/api/customer-types').then(r => r.json()).then(setCustomerTypes).catch(() => {});
  }, []);

  const set = (field: keyof FormData, value: string | string[]) =>
    setForm(f => ({ ...f, [field]: value }));

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]);
    setTagInput('');
  };

  const removeTag = (tag: string) => set('tags', form.tags.filter(t => t !== tag));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('请填写客户名称'); return; }
    if (!form.type) { setError('请选择客户类型'); return; }
    setSaving(true);
    try {
      const url = customerId ? `/api/customers/${customerId}` : '/api/customers';
      const res = await fetch(url, {
        method: customerId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { setError((await res.json()).error || '保存失败'); return; }
      const data = await res.json();
      router.push(`/customers/${customerId || data.id}`);
      router.refresh();
    } catch {
      setError('网络错误，请重试');
    } finally {
      setSaving(false);
    }
  };

  const selectedType = customerTypes.find(t => t.key === form.type);

  return (
    <>
    {showPicker && (
      <AddressPicker
        onSelect={(addr) => { set('address', addr); setShowPicker(false); }}
        onClose={() => setShowPicker(false)}
      />
    )}
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            客户名称 <span className="text-red-400">*</span>
          </label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="请输入客户名称" className={inputClass} style={inputStyle} />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            客户类型 <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              {selectedType && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: selectedType.color }} />
              )}
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className={inputClass} style={{ ...inputStyle, paddingLeft: selectedType ? '1.75rem' : undefined }}>
                <option value="">请选择客户类型</option>
                {customerTypes.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          {customerTypes.length === 0 && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              可在 <a href="/settings" className="text-blue-400 hover:underline">设置</a> 中管理客户类型
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>地址</label>
          <div className="flex gap-2">
            <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="请输入客户地址" className={inputClass} style={inputStyle} />
            <button type="button" onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium flex-shrink-0 transition-colors"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              地图选点
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>联系人</label>
          <input type="text" value={form.contact_name} onChange={e => set('contact_name', e.target.value)}
            placeholder="联系人姓名" className={inputClass} style={inputStyle} />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>联系方式</label>
          <input type="text" value={form.contact_info} onChange={e => set('contact_info', e.target.value)}
            placeholder="电话 / 邮箱" className={inputClass} style={inputStyle} />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            微信号
            <span className="ml-1.5 font-normal" style={{ color: 'var(--text-muted)' }}>填写后可一键跳转微信</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#07c160' }}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.295.295a.328.328 0 00.168-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.603-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.136 0 .246-.11.246-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.49.49 0 01.177-.554C22.956 18.117 24 16.487 24 14.667c0-3.12-2.843-5.842-7.063-5.809zM14.59 13.24c-.535 0-.969-.44-.969-.982 0-.542.434-.982.97-.982.535 0 .97.44.97.982 0 .542-.435.982-.97.982zm4.797 0c-.535 0-.969-.44-.969-.982 0-.542.434-.982.97-.982.535 0 .97.44.97.982 0 .542-.434.982-.97.982z"/>
              </svg>
            </span>
            <input type="text" value={form.wechat_id} onChange={e => set('wechat_id', e.target.value)}
              placeholder="输入微信号（非昵称）" className={inputClass} style={{ ...inputStyle, paddingLeft: '2rem' }} />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>客户标签</label>
        <div className="flex gap-2 mb-2">
          <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
            placeholder="输入标签后按回车添加" className={inputClass} style={inputStyle} />
          <button type="button" onClick={() => addTag(tagInput)}
            className="px-4 py-2 rounded-lg text-sm transition-colors flex-shrink-0 text-zinc-300 hover:text-white"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
            添加
          </button>
        </div>
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {form.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full text-blue-300"
                style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="hover:text-white ml-0.5 text-blue-400">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>快速选择：</span>
          {SUGGESTED_TAGS.filter(t => !form.tags.includes(t)).map(tag => (
            <button key={tag} type="button" onClick={() => addTag(tag)}
              className="text-xs px-2.5 py-1 rounded-full transition-colors hover:text-blue-300"
              style={{ border: '1px dashed var(--border-light)', color: 'var(--text-muted)' }}>
              + {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors">
          {saving ? '保存中...' : '保存'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-6 py-2 rounded-lg text-sm font-medium transition-colors text-zinc-300 hover:text-white"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
          取消
        </button>
      </div>
    </form>
    </>
  );
}
