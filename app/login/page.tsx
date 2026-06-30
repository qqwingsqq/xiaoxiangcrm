'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [resetMethod, setResetMethod] = useState<'phone' | 'email'>('phone');
  const [resetContact, setResetContact] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function switchMode(nextMode: 'login' | 'register' | 'forgot') {
    setMode(nextMode);
    setError('');
    setSuccess('');
    if (nextMode !== 'forgot') {
      setResetCode('');
      setCodeRequested(false);
      setNewPassword('');
      setConfirmPassword('');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'forgot' && newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setLoading(true);
    try {
      const url = mode === 'login'
        ? '/api/auth/login'
        : mode === 'register'
          ? '/api/auth/register'
          : '/api/auth/forgot-password';
      const body = mode === 'login'
        ? { username, password }
        : mode === 'register'
          ? { username, password, display_name: displayName, phone, email }
          : { action: 'reset-password', method: resetMethod, contact: resetContact, code: resetCode, newPassword };

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
      if (mode === 'forgot') {
        setSuccess('密码已重置，请使用新密码登录');
        setMode('login');
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setResetContact('');
        setResetCode('');
        setCodeRequested(false);
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

  async function requestResetCode() {
    setError('');
    setSuccess('');
    if (!resetContact.trim()) {
      setError(resetMethod === 'phone' ? '请输入手机号' : '请输入邮箱');
      return;
    }
    setCodeLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request-code', method: resetMethod, contact: resetContact }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '验证码发送失败');
        return;
      }
      setCodeRequested(true);
      setResetCode('');
      setSuccess(data.devCode ? `验证码已生成：${data.devCode}，10分钟内有效` : '验证码已发送，10分钟内有效');
    } catch {
      setError('网络错误，请重试');
    } finally {
      setCodeLoading(false);
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
              onClick={() => switchMode('login')}
              className="flex-1 py-2 text-sm font-medium transition-colors"
              style={{
                background: mode === 'login' ? 'var(--accent)' : 'transparent',
                color: mode === 'login' ? '#fff' : 'var(--text-muted)',
              }}>
              登录账户
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className="flex-1 py-2 text-sm font-medium transition-colors"
              style={{
                background: mode === 'register' ? 'var(--accent)' : 'transparent',
                color: mode === 'register' ? '#fff' : 'var(--text-muted)',
              }}>
              创建新账户
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'forgot' && (
              <div className="rounded-lg px-3 py-2 text-xs"
                style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: 'var(--text-muted)' }}>
                请输入注册时绑定的手机号或邮箱，获取验证码后即可重置密码。新密码可以与旧密码相同。
              </div>
            )}

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
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            )}

            {mode !== 'forgot' && (
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
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            )}

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                    手机号（用于找回密码）
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="请输入手机号"
                    autoComplete="tel"
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                    邮箱（用于找回密码）
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="请输入邮箱"
                    autoComplete="email"
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </>
            )}

            {mode === 'forgot' ? (
              <>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                    找回方式
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setResetMethod('phone'); setResetContact(''); setResetCode(''); setCodeRequested(false); setError(''); setSuccess(''); }}
                      className="py-2 rounded-lg text-sm font-medium border"
                      style={{
                        background: resetMethod === 'phone' ? 'rgba(59,130,246,0.18)' : 'var(--bg-input)',
                        borderColor: resetMethod === 'phone' ? 'var(--accent)' : 'var(--border)',
                        color: resetMethod === 'phone' ? 'var(--accent)' : 'var(--text-muted)',
                      }}>
                      手机号
                    </button>
                    <button
                      type="button"
                      onClick={() => { setResetMethod('email'); setResetContact(''); setResetCode(''); setCodeRequested(false); setError(''); setSuccess(''); }}
                      className="py-2 rounded-lg text-sm font-medium border"
                      style={{
                        background: resetMethod === 'email' ? 'rgba(59,130,246,0.18)' : 'var(--bg-input)',
                        borderColor: resetMethod === 'email' ? 'var(--accent)' : 'var(--border)',
                        color: resetMethod === 'email' ? 'var(--accent)' : 'var(--text-muted)',
                      }}>
                      邮箱
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                    {resetMethod === 'phone' ? '手机号' : '邮箱'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type={resetMethod === 'phone' ? 'tel' : 'email'}
                      value={resetContact}
                      onChange={e => { setResetContact(e.target.value); setResetCode(''); setCodeRequested(false); setSuccess(''); }}
                      placeholder={resetMethod === 'phone' ? '请输入手机号' : '请输入邮箱'}
                      required
                      autoComplete={resetMethod === 'phone' ? 'tel' : 'email'}
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm border outline-none"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    />
                    <button
                      type="button"
                      onClick={requestResetCode}
                      disabled={codeLoading || !resetContact.trim()}
                      className="px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap disabled:opacity-50"
                      style={{ background: 'var(--accent)', color: '#fff' }}>
                      {codeLoading ? '发送中' : codeRequested ? '重新获取' : '获取验证码'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                    验证码
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={resetCode}
                    onChange={e => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="请输入6位验证码"
                    required
                    maxLength={6}
                    autoComplete="one-time-code"
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none tracking-widest"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                    新密码
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="至少6位"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                    确认新密码
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="再次输入新密码"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                    style={{
                      background: 'var(--bg-input)',
                      borderColor: confirmPassword && newPassword !== confirmPassword ? '#ef4444' : 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </>
            ) : (
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
                  minLength={mode === 'register' ? 6 : undefined}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {success && (
              <p className="text-xs text-emerald-400 bg-emerald-400/10 rounded-lg px-3 py-2">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {loading ? '请稍候...' : mode === 'login' ? '登录' : mode === 'register' ? '创建账户并登录' : '重置密码'}
            </button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="text-xs text-center"
                style={{ color: 'var(--accent)' }}>
                忘记密码？通过手机号或邮箱找回
              </button>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs text-center"
                style={{ color: 'var(--text-muted)' }}>
                返回登录
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
