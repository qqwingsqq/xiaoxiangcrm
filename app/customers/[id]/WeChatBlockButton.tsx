'use client';

import { useState } from 'react';

export default function WeChatBlockButton({ wxid, customerName }: { wxid: string; customerName: string }) {
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const block = async () => {
    if (!confirm(`屏蔽「${customerName}」后，该联系人的新消息将不再自动导入。确认吗？`)) return;
    setLoading(true);
    await fetch('/api/wechat/blocklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wxid, name: customerName }),
    });
    setBlocked(true);
    setLoading(false);
  };

  if (blocked) {
    return (
      <div className="text-xs text-zinc-500 flex items-center gap-1.5 px-4 py-2.5 rounded-xl"
        style={{ background: 'rgba(107,114,128,0.08)', border: '1px solid var(--border)' }}>
        <span>🚫</span> 已屏蔽，新消息不再自动导入
      </div>
    );
  }

  return (
    <button onClick={block} disabled={loading}
      className="text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50 hover:opacity-90 w-full justify-center"
      style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#f87171' }}>
      {loading ? '处理中…' : '🚫 屏蔽该联系人的微信消息收集'}
    </button>
  );
}
