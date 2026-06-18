'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteButton({ customerId, customerName }: { customerId: number; customerName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/customers/${customerId}`, { method: 'DELETE' });
    router.push('/');
    router.refresh();
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>确认删除"{customerName}"？</span>
        <button onClick={handleDelete} disabled={deleting}
          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-500 disabled:opacity-50 transition-colors">
          {deleting ? '删除中...' : '确认'}
        </button>
        <button onClick={() => setConfirming(false)}
          className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
          取消
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      删除
    </button>
  );
}
