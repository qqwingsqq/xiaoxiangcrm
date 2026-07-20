'use client';

import Link from 'next/link';

interface Contact {
  id: number;
  name: string;
  wechat_id: string | null;
  is_primary: number;
}

export default function ContactList({
  contacts,
  customerId,
}: {
  contacts: Contact[];
  customerId: number;
}) {
  return (
    <div className="flex gap-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
      <span className="w-20 flex-shrink-0 text-xs pt-0.5" style={{ color: 'var(--text-muted)' }}>联系人</span>
      <div className="flex flex-wrap gap-2">
        {contacts.length > 0 ? contacts.map((c) => (
          <Link
            key={c.id}
            href={`/customers/${customerId}/contacts/${c.id}`}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-all cursor-pointer hover:opacity-80"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}>
            {c.name}{c.is_primary ? ' · 主' : ''}
            {c.wechat_id && <span className="text-zinc-500">({c.wechat_id})</span>}
          </Link>
        )) : (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>未填写</span>
        )}
      </div>
    </div>
  );
}
