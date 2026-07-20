'use client';

import Link from 'next/link';

interface Contact {
  id: number;
  name: string;
  wxid: string | null;
  role: string | null;
  chat_count: number;
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
            {c.name}
            {c.chat_count > 0 && (
              <span className="ml-1 text-[10px] px-1 rounded-full" style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>
                {c.chat_count}
              </span>
            )}
            {c.role && <span className="text-zinc-500">·{c.role}</span>}
          </Link>
        )) : (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>未填写</span>
        )}
      </div>
    </div>
  );
}
