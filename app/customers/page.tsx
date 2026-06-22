'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useDevice } from '../DevicePreviewProvider';

interface Customer {
  id: number;
  name: string;
  type: string;
  address: string | null;
  contact_name: string | null;
  contact_info: string | null;
  tags: string;
  created_at: string;
}

interface CustomerType { id: number; key: string; label: string; color: string; }

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const { device } = useDevice();

  useEffect(() => {
    fetch('/api/customer-types').then(r => r.json()).then(setCustomerTypes).catch(() => {});
  }, []);

  const typeMap = Object.fromEntries(customerTypes.map(t => [t.key, t]));

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (typeFilter) params.set('type', typeFilter);
    const res = await fetch(`/api/customers?${params}`);
    setCustomers(await res.json());
    setLoading(false);
  }, [search, typeFilter]);

  useEffect(() => {
    const t = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(t);
  }, [fetchCustomers]);

  const parseTags = (tags: string): string[] => {
    try { return JSON.parse(tags); } catch { return []; }
  };

  return (
    <div>
      {/* 固定搜索栏 */}
      <div className={`sticky ${device === 'desktop' ? 'top-14' : 'top-0'} z-40 -mx-4 sm:-mx-6 px-3 sm:px-6 py-2 mb-3`}
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
        {/* 单行：搜索框 + 筛选 + 添加按钮 */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="搜索客户..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="py-1.5 px-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 flex-shrink-0"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', maxWidth: 80 }}
          >
            <option value="">全部</option>
            {customerTypes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <Link href="/customers/new"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-500 transition-colors flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">添加客户</span>
            <span className="sm:hidden">添加</span>
          </Link>
        </div>
        {/* 统计 & 清除 — 仅在有内容时显示 */}
        <div className="flex items-center gap-2 mt-1 h-4">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {customers.length} 位客户
          </span>
          {(search || typeFilter) && (
            <button onClick={() => { setSearch(''); setTypeFilter(''); }}
              className="text-xs text-blue-400 hover:text-blue-300">× 清除</button>
          )}
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: 'var(--bg-card)' }}>
            <svg className="w-7 h-7 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            {search || typeFilter ? '未找到匹配的客户' : '暂无客户数据'}
          </p>
          <Link href="/customers/new" className="text-sm text-blue-400 hover:text-blue-300">添加第一个客户 →</Link>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {customers.map(c => {
            const tags = parseTags(c.tags);
            return (
              <Link key={c.id} href={`/customers/${c.id}`}
                className="flex items-center gap-4 rounded-xl px-4 py-3.5 transition-all group"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#3b82f6'; el.style.background = 'var(--bg-card-hover)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.background = 'var(--bg-card)'; }}
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                  style={{ background: `${typeMap[c.type]?.color || '#6b7280'}22`, color: typeMap[c.type]?.color || '#6b7280' }}>
                  {c.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-zinc-100 group-hover:text-blue-400 transition-colors truncate">
                      {c.name}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: `${typeMap[c.type]?.color || '#6b7280'}22`, color: typeMap[c.type]?.color || '#9ca3af' }}>
                      {typeMap[c.type]?.label || c.type}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {c.contact_name && <span>{c.contact_name}</span>}
                    {c.contact_info && <span>{c.contact_info}</span>}
                    {c.address && <span className="hidden sm:inline truncate max-w-xs">{c.address}</span>}
                  </div>
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="hidden sm:flex gap-1 flex-wrap justify-end max-w-[160px]">
                    {tags.slice(0, 2).map((tag, i) => (
                      <span key={i} className="text-xs px-1.5 py-0.5 rounded text-zinc-500"
                        style={{ background: '#333336' }}>{tag}</span>
                    ))}
                    {tags.length > 2 && <span className="text-xs text-zinc-600">+{tags.length - 2}</span>}
                  </div>
                )}

                <svg className="w-4 h-4 text-zinc-600 flex-shrink-0 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
