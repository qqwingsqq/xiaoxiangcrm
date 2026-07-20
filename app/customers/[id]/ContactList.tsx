'use client';

import { useState } from 'react';
import WeChatChats from './WeChatChats';

interface Contact {
  id: number;
  name: string;
  wechat_id: string | null;
  is_primary: number;
}

export default function ContactList({ 
  contacts, 
  customerId,
  wechatId 
}: { 
  contacts: Contact[]; 
  customerId: number;
  wechatId: string | null;
}) {
  const [activeContactId, setActiveContactId] = useState<number | null>(null);

  return (
    <>
      {/* 联系人列表 - 可点击筛选 */}
      <div className="flex gap-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="w-20 flex-shrink-0 text-xs pt-0.5" style={{ color: 'var(--text-muted)' }}>联系人</span>
        <div className="flex flex-wrap gap-2">
          {contacts.length > 0 ? contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveContactId(activeContactId === c.id ? null : c.id)}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-all cursor-pointer"
              style={{
                background: activeContactId === c.id ? 'rgba(59,130,246,0.15)' : 'var(--bg-input)',
                border: `1px solid ${activeContactId === c.id ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`,
                color: activeContactId === c.id ? '#60a5fa' : 'var(--text-primary)',
              }}>
              {c.name}{c.is_primary ? ' · 主' : ''}
              {c.wechat_id && <span className="text-zinc-500">({c.wechat_id})</span>}
            </button>
          )) : (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>未填写</span>
          )}
        </div>
      </div>

      {/* 微信聊天记录 */}
      <WeChatChats customerId={customerId} selectedContactId={activeContactId} />
    </>
  );
}