'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useDevice } from '../DevicePreviewProvider';

type Theme = 'dark' | 'light' | 'system';
type Shortcut = 'vol-down-double' | 'power-vol-down';

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

export default function SettingsPage() {
  const { device } = useDevice();
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [wechatId, setWechatId] = useState('');
  const [theme, setTheme] = useState<Theme>('dark');
  const [shortcut, setShortcut] = useState<Shortcut>('vol-down-double');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisplayName(localStorage.getItem('crm-display-name') || '');
    setPassword(localStorage.getItem('crm-password') || '');
    setWechatId(localStorage.getItem('crm-wechat-id') || '');
    setTheme((localStorage.getItem('crm-theme') as Theme) || 'dark');
    setShortcut((localStorage.getItem('crm-record-shortcut') as Shortcut) || 'vol-down-double');
  }, []);

  const save = () => {
    localStorage.setItem('crm-display-name', displayName);
    localStorage.setItem('crm-password', password);
    localStorage.setItem('crm-wechat-id', wechatId);
    localStorage.setItem('crm-theme', theme);
    localStorage.setItem('crm-record-shortcut', shortcut);
    document.documentElement.setAttribute('data-theme', theme);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputClass = 'w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors';
  const inputStyle = {
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  };

  const maxW = device === 'desktop' ? 'max-w-xl mx-auto' : device === 'tablet' ? 'max-w-lg mx-auto' : '';

  const themeOptions = [
    { value: 'dark', label: '深色', icon: '🌙', desc: '深色背景' },
    { value: 'light', label: '浅色', icon: '☀️', desc: '浅色背景' },
    { value: 'system', label: '跟随系统', icon: '📱', desc: '自动切换' },
  ] as const;

  const shortcutOptions = [
    {
      value: 'vol-down-double' as const,
      label: '连按两次音量减键',
      desc: '快速双击音量下键启动录音',
    },
    {
      value: 'power-vol-down' as const,
      label: '同时按电源 + 音量减键',
      desc: '电源键与音量下键同时按下',
    },
  ];

  return (
    <div className={maxW}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="p-2 rounded-xl transition-colors"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>设置</h1>
      </div>

      <div className="space-y-4">
        {/* Account info */}
        <Section title="账号信息">
          <Field label="显示名称">
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="你的名字"
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Field label="登录密码" hint="密码仅存储在本设备，不加密上传服务器">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="设置本地密码"
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Field label="关联微信账号">
            <input
              value={wechatId}
              onChange={e => setWechatId(e.target.value)}
              placeholder="输入微信号"
              className={inputClass}
              style={inputStyle}
            />
          </Field>
        </Section>

        {/* Theme */}
        <Section title="主题颜色">
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map(opt => {
              const active = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    setTheme(opt.value);
                    document.documentElement.setAttribute('data-theme', opt.value);
                  }}
                  className="flex flex-col items-center gap-2 p-3.5 rounded-xl transition-all"
                  style={{
                    background: active ? 'rgba(59,130,246,0.1)' : 'var(--bg-input)',
                    border: `1px solid ${active ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`,
                  }}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <div className="text-center">
                    <p className="text-xs font-medium" style={{ color: active ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {opt.label}
                    </p>
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
              const active = shortcut === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setShortcut(opt.value)}
                  className="w-full flex items-start gap-3 p-4 rounded-xl text-left transition-all"
                  style={{
                    background: active ? 'rgba(59,130,246,0.06)' : 'var(--bg-input)',
                    border: `1px solid ${active ? 'rgba(59,130,246,0.35)' : 'var(--border)'}`,
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center"
                    style={{ borderColor: active ? 'var(--accent)' : 'var(--border-light)' }}
                  >
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
          <div
            className="flex items-start gap-2.5 p-3.5 rounded-xl"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs" style={{ color: 'rgba(251,191,36,0.8)' }}>
              此功能需要在 Android APP 中额外开启辅助功能权限，网页版不支持后台监听硬件按键。安装 APK 并完成配置后此设置才会生效。
            </p>
          </div>
        </Section>

        {/* Save */}
        <button
          onClick={save}
          className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: saved ? '#10b981' : 'var(--accent)' }}
        >
          {saved ? '✓ 已保存' : '保存设置'}
        </button>
      </div>
    </div>
  );
}
