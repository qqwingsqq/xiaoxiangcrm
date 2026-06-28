'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { username, password }
        : { username, password, display_name: displayName };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '操作失败');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <img src="/Logo.png" alt="小象智能" className="h-14 w-auto" />
          <div>
            <h1 className="text-xl font-bold text-center" style={{ color: 'var(--text-primary)' }}>
              小象智能 CRM
            </h1>
            <p className="text-xs text-center mt-1" style={{ color: 'var(--text-muted)' }}>
              客户关系管理系统
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-xl border p-6 shadow-lg"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {/* Mode tabs */}
          <div className="flex mb-6 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className="flex-1 py-2 text-sm font-medium transition-colors"
              style={{
                background: mode === 'login' ? 'var(--accent)' : 'transparent',
                color: mode === 'login' ? '#fff' : 'var(--text-muted)',
              }}>
              登录
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className="flex-1 py-2 text-sm font-medium transition-colors"
              style={{
                background: mode === 'register' ? 'var(--accent)' : 'transparent',
                color: mode === 'register' ? '#fff' : 'var(--text-muted)',
              }}>
              首次注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                  显示名称（可选）
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="例：张三"
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2"
                  style={{
                    background: 'var(--bg-input)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            )}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="请输入用户名"
                required
                autoComplete="username"
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'register' ? '至少6位' : '请输入密码'}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {loading ? '请稍候...' : mode === 'login' ? '登录' : '注册并登录'}
            </button>
          </form>

          {mode === 'register' && (
            <p className="text-xs mt-4 text-center" style={{ color: 'var(--text-muted)' }}>
              注册仅在系统没有任何账户时可用
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
