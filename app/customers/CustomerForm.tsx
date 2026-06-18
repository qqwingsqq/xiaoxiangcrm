'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CUSTOMER_TYPES = [
  { value: 'dealer', label: '经销商' },
  { value: 'terminal', label: '终端客户' },
  { value: 'partner', label: '合作伙伴' },
  { value: 'potential', label: '潜在客户' },
];

const SUGGESTED_TAGS = ['重要客户', '待跟进', '已成交', 'VIP', '新客户', '老客户'];

interface FormData {
  name: string;
  type: string;
  address: string;
  contact_name: string;
  contact_info: string;
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
    name: '', type: '', address: '', contact_name: '', contact_info: '', tags: [],
  });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  return (
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
          <select value={form.type} onChange={e => set('type', e.target.value)}
            className={inputClass} style={{ ...inputStyle }}>
            <option value="">请选择客户类型</option>
            {CUSTOMER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>地址</label>
          <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
            placeholder="请输入客户地址" className={inputClass} style={inputStyle} />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>联系人</label>
          <input type="text" value={form.contact_name} onChange={e => set('contact_name', e.target.value)}
            placeholder="联系人姓名" className={inputClass} style={inputStyle} />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>联系方式</label>
          <input type="text" value={form.contact_info} onChange={e => set('contact_info', e.target.value)}
            placeholder="电话 / 微信 / 邮箱" className={inputClass} style={inputStyle} />
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
  );
}
