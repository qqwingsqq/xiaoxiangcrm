'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useDevice } from '../DevicePreviewProvider';

type Theme = 'dark' | 'light' | 'system';
type Shortcut = 'vol-down-double' | 'power-vol-down';

interface Profile {
  display_name: string;
  phone: string;
  company: string;
  title: string;
  wechat_id: string;
  amap_key: string;
  amap_security: string;
  theme: Theme;
  record_shortcut: Shortcut;
}

const DEFAULT_PROFILE: Profile = {
  display_name: '', phone: '', company: '', title: '',
  wechat_id: '', amap_key: '', amap_security: '',
  theme: 'dark', record_shortcut: 'vol-down-double',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-semibold mb-4 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {title}
      </p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
      {hint && <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  );
}

// ── Profile card (view mode) ──────────────────────────────
function ProfileCard({ profile, onEdit }: { profile: Profile; onEdit: () => void }) {
  const hasInfo = profile.display_name || profile.company || profile.phone;
  const initial = profile.display_name?.charAt(0)?.toUpperCase() || profile.company?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="rounded-2xl p-5 relative" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <button onClick={onEdit}
        className="absolute top-4 right-4 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
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
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0"
            style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
            {initial}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {profile.display_name && (
              <p className="text-lg font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{profile.display_name}</p>
            )}
            {(profile.title || profile.company) && (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {[profile.title, profile.company].filter(Boolean).join(' @ ')}
              </p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              {profile.phone && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {profile.phone}
                </span>
              )}
              {profile.wechat_id && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {profile.wechat_id}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Amap key status */}
      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>高德地图 API</span>
          {profile.amap_key ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              已配置
            </span>
          ) : (
            <span className="text-xs text-amber-400">未配置</span>
          )}
        </div>
        {profile.amap_key && (
          <p className="text-xs mt-0.5 font-mono truncate" style={{ color: 'var(--text-muted)' }}>
            {profile.amap_key.substring(0, 8)}••••••••{profile.amap_key.slice(-4)}
          </p>
        )}
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
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load from server first, fallback to localStorage
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

    const local = fromLocal();
    setProfile(local);
    setForm(local);
    setLoaded(true);

    // Fetch from server and merge (server overrides)
    fetch('/api/settings').then(r => r.json()).then((data: Record<string, string>) => {
      if (Object.keys(data).length === 0) return; // server has nothing yet
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
      // Save merged to localStorage
      Object.entries(merged).forEach(([k, v]) => {
        const lsKey = k === 'display_name' ? 'crm-display-name'
          : k === 'wechat_id' ? 'crm-wechat-id'
          : k === 'amap_key' ? 'crm-amap-key'
          : k === 'amap_security' ? 'crm-amap-security'
          : k === 'record_shortcut' ? 'crm-record-shortcut'
          : `crm-${k}`;
        if (v) localStorage.setItem(lsKey, v);
      });
      setProfile(merged);
      setForm(merged);
      if (merged.theme) document.documentElement.setAttribute('data-theme', merged.theme);
    }).catch(() => {});
  }, []);

  const saveToLocal = (p: Profile) => {
    localStorage.setItem('crm-display-name', p.display_name);
    localStorage.setItem('crm-phone', p.phone);
    localStorage.setItem('crm-company', p.company);
    localStorage.setItem('crm-title', p.title);
    localStorage.setItem('crm-wechat-id', p.wechat_id);
    localStorage.setItem('crm-amap-key', p.amap_key);
    localStorage.setItem('crm-amap-security', p.amap_security);
    localStorage.setItem('crm-theme', p.theme);
    localStorage.setItem('crm-record-shortcut', p.record_shortcut);
  };

  const save = async () => {
    setSaving(true);
    saveToLocal(form);
    document.documentElement.setAttribute('data-theme', form.theme);
    // Save to server
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: form.display_name,
        phone: form.phone,
        company: form.company,
        title: form.title,
        wechat_id: form.wechat_id,
        amap_key: form.amap_key,
        amap_security: form.amap_security,
        theme: form.theme,
        record_shortcut: form.record_shortcut,
      }),
    }).catch(() => {});
    setProfile(form);
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const set = (k: keyof Profile, v: string) => setForm(f => ({ ...f, [k]: v }));

  const inputClass = 'w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors';
  const inputStyle = { background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' };
  const maxW = device === 'desktop' ? 'max-w-xl mx-auto' : device === 'tablet' ? 'max-w-lg mx-auto' : '';

  const themeOptions = [
    { value: 'dark' as Theme, label: '深色', icon: '🌙', desc: '深色背景' },
    { value: 'light' as Theme, label: '浅色', icon: '☀️', desc: '浅色背景' },
    { value: 'system' as Theme, label: '跟随系统', icon: '📱', desc: '自动切换' },
  ];

  const shortcutOptions = [
    { value: 'vol-down-double' as Shortcut, label: '连按两次音量减键', desc: '快速双击音量下键启动录音' },
    { value: 'power-vol-down' as Shortcut, label: '同时按电源 + 音量减键', desc: '电源键与音量下键同时按下' },
  ];

  if (!loaded) return null;

  return (
    <div className={maxW}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/"
            className="p-2 rounded-xl transition-colors"
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
        {/* Profile panel / edit form */}
        {!editing ? (
          <ProfileCard profile={profile} onEdit={() => { setForm(profile); setEditing(true); }} />
        ) : (
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>个人信息</p>
              <button onClick={() => setEditing(false)} className="text-xs" style={{ color: 'var(--text-muted)' }}>取消</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="姓名">
                <input value={form.display_name} onChange={e => set('display_name', e.target.value)}
                  placeholder="你的名字" className={inputClass} style={inputStyle} />
              </Field>
              <Field label="手机号">
                <input value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="138xxxxxxxx" className={inputClass} style={inputStyle} type="tel" />
              </Field>
              <Field label="公司">
                <input value={form.company} onChange={e => set('company', e.target.value)}
                  placeholder="所在公司" className={inputClass} style={inputStyle} />
              </Field>
              <Field label="职位">
                <input value={form.title} onChange={e => set('title', e.target.value)}
                  placeholder="职位/职称" className={inputClass} style={inputStyle} />
              </Field>
            </div>
            <Field label="微信号">
              <input value={form.wechat_id} onChange={e => set('wechat_id', e.target.value)}
                placeholder="微信号" className={inputClass} style={inputStyle} />
            </Field>
          </div>
        )}

        {/* Theme */}
        <Section title="主题颜色">
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map(opt => {
              const active = form.theme === opt.value;
              return (
                <button key={opt.value}
                  onClick={() => { set('theme', opt.value); document.documentElement.setAttribute('data-theme', opt.value); }}
                  className="flex flex-col items-center gap-2 p-3.5 rounded-xl transition-all"
                  style={{ background: active ? 'rgba(59,130,246,0.1)' : 'var(--bg-input)', border: `1px solid ${active ? 'rgba(59,130,246,0.4)' : 'var(--border)'}` }}>
                  <span className="text-2xl">{opt.icon}</span>
                  <div className="text-center">
                    <p className="text-xs font-medium" style={{ color: active ? 'var(--accent)' : 'var(--text-primary)' }}>{opt.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Quick record shortcut */}
        <Section title="快速录音快捷键">
          <div className="space-y-2">
            {shortcutOptions.map(opt => {
              const active = form.record_shortcut === opt.value;
              return (
                <button key={opt.value} onClick={() => set('record_shortcut', opt.value)}
                  className="w-full flex items-start gap-3 p-4 rounded-xl text-left transition-all"
                  style={{ background: active ? 'rgba(59,130,246,0.06)' : 'var(--bg-input)', border: `1px solid ${active ? 'rgba(59,130,246,0.35)' : 'var(--border)'}` }}>
                  <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center"
                    style={{ borderColor: active ? 'var(--accent)' : 'var(--border-light)' }}>
                    {active && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{opt.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs" style={{ color: 'rgba(251,191,36,0.8)' }}>
              此功能需要在 Android APP 中额外开启辅助功能权限，网页版不支持后台监听硬件按键。
            </p>
          </div>
        </Section>

        {/* Amap key */}
        <Section title="高德地图 API Key">
          <Field label="API Key" hint="在 lbs.amap.com 控制台创建 Web端(JS API) 类型的 Key">
            <input value={form.amap_key} onChange={e => set('amap_key', e.target.value)}
              placeholder="粘贴高德 JS API Key" className={inputClass} style={inputStyle} />
          </Field>
          <Field label="安全密钥" hint="Key 详情页可查，地理编码必填">
            <input value={form.amap_security} onChange={e => set('amap_security', e.target.value)}
              placeholder="粘贴安全密钥（securityJsCode）" className={inputClass} style={inputStyle} />
          </Field>
          <div className="flex items-start gap-2.5 p-3 rounded-xl text-xs" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', color: 'var(--text-muted)' }}>
            Key 保存后会同步到云端，更换设备无需重新填写。
          </div>
        </Section>

        {/* Save */}
        <button onClick={save} disabled={saving}
          className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
          style={{ background: saved ? '#10b981' : 'var(--accent)' }}>
          {saving ? '保存中…' : saved ? '✓ 已保存并同步' : '保存设置'}
        </button>
      </div>
    </div>
  );
}
