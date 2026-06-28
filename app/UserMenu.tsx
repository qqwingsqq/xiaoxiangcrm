'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  username: string;
  display_name: string | null;
}

export default function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.id) setUser(data); })
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  if (!user) return null;

  const label = user.display_name || user.username;
  const initial = label[0]?.toUpperCase() || '?';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-zinc-800"
        title={label}>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: 'var(--accent)' }}>
          {initial}
        </div>
        <span className="text-xs hidden sm:block max-w-[80px] truncate" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 w-36 rounded-lg border shadow-lg z-50 py-1 text-sm"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{label}</p>
              {user.display_name && (
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>@{user.username}</p>
              )}
            </div>
            <button
              onClick={logout}
              className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-400 transition-colors">
              退出登录
            </button>
          </div>
        </>
      )}
    </div>
  );
}
