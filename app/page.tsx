'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import VoiceRecordWidget from './VoiceRecordWidget';
import CalendarWidget from './CalendarWidget';
import { useDevice } from './DevicePreviewProvider';

const TYPE_LABELS: Record<string, string> = {
  dealer: '经销商', terminal: '终端客户', partner: '合作伙伴', potential: '潜在客户',
};
const TYPE_DOT: Record<string, string> = {
  dealer: '#a855f7', terminal: '#10b981', partner: '#3b82f6', potential: '#f59e0b',
};

interface DashData {
  totalCustomers: number;
  customerStats: { type: string; count: number }[];
  recentFollowUps: {
    id: number; title: string; customer_name: string; customer_type: string;
    created_at: string; content: string | null; customer_id?: number;
  }[];
  pendingReminders: {
    id: number; content: string; customer_name: string; remind_date: string | null;
  }[];
  customerLocations: { id: number; name: string; type: string; address: string }[];
  customersByType: { type: string; count: number }[];
  recentCustomers: {
    id: number; name: string; type: string;
    contact_name: string | null; contact_info: string | null; created_at: string;
  }[];
}

// ── 圆环图 ──────────────────────────────────────────────
function DonutChart({ data, size = 80 }: { data: { type: string; count: number }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <p className="text-xs text-zinc-600 text-center py-4">暂无数据</p>;
  let cum = 0;
  const cx = 50, cy = 50, r = 40, inner = 26;
  const segs = data.map(d => { const s = cum; cum += d.count / total; return { ...d, s, p: d.count / total }; });
  function arc(p: number, s: number) {
    const a1 = s * 2 * Math.PI - Math.PI / 2, a2 = (s + p) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const ix1 = cx + inner * Math.cos(a1), iy1 = cy + inner * Math.sin(a1);
    const ix2 = cx + inner * Math.cos(a2), iy2 = cy + inner * Math.sin(a2);
    return `M${x1} ${y1} A${r} ${r} 0 ${p > 0.5 ? 1 : 0} 1 ${x2} ${y2} L${ix2} ${iy2} A${inner} ${inner} 0 ${p > 0.5 ? 1 : 0} 0 ${ix1} ${iy1}Z`;
  }
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" style={{ width: size, height: size, flexShrink: 0 }}>
        {segs.map((s, i) => <path key={i} d={arc(s.p, s.s)} fill={TYPE_DOT[s.type] || '#6b7280'} />)}
        <text x="50" y="55" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">{total}</text>
      </svg>
      <div className="flex-1 space-y-1.5 min-w-0">
        {segs.map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TYPE_DOT[s.type] || '#6b7280' }} />
              <span className="text-xs text-zinc-400 truncate">{TYPE_LABELS[s.type] || s.type}</span>
            </div>
            <span className="text-xs font-semibold text-zinc-200 flex-shrink-0">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 进度条关联图 ──────────────────────────────────────
function RelationBars({ data }: { data: { type: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;
  return (
    <div className="space-y-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
      {data.map(d => (
        <div key={d.type}>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-zinc-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: TYPE_DOT[d.type] }} />
              {TYPE_LABELS[d.type]}
            </span>
            <span className="text-xs text-zinc-500">{d.count}家 · {Math.round(d.count / total * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-track)' }}>
            <div className="h-full rounded-full" style={{ width: `${d.count / total * 100}%`, background: TYPE_DOT[d.type] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 卡片容器 ──────────────────────────────────────────
function Card({ children, className = '', style = {}, square = false }: {
  children: React.ReactNode; className?: string;
  style?: React.CSSProperties; square?: boolean;
}) {
  return (
    <div className={`rounded-2xl overflow-hidden ${square ? 'relative' : ''} ${className}`}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', aspectRatio: square ? '1/1' : undefined, ...style }}>
      {square ? <div className="absolute inset-0 p-4 flex flex-col">{children}</div> : <div className="p-4 h-full flex flex-col">{children}</div>}
    </div>
  );
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 flex-shrink-0">
      <span className="text-sm font-semibold text-white">{title}</span>
      {action}
    </div>
  );
}

// ── 地址分布 ──────────────────────────────────────────
function LocationContent({ locations }: { locations: DashData['customerLocations'] }) {
  const groups: Record<string, typeof locations> = {};
  for (const loc of locations) {
    const k = loc.address.substring(0, 2);
    if (!groups[k]) groups[k] = [];
    groups[k].push(loc);
  }
  const entries = Object.entries(groups).slice(0, 10);
  if (entries.length === 0) return <p className="text-xs text-zinc-600 text-center py-4">暂无地址数据</p>;
  return (
    <div className="space-y-2 overflow-y-auto flex-1">
      {entries.map(([region, locs]) => (
        <div key={region} className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 w-8 flex-shrink-0">{region}</span>
          <div className="flex flex-wrap gap-1">
            {locs.slice(0, 3).map(l => (
              <Link key={l.id} href={`/customers/${l.id}`}
                className="text-xs px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity"
                style={{ background: `${TYPE_DOT[l.type]}18`, color: TYPE_DOT[l.type] }}>
                {l.name.substring(0, 4)}
              </Link>
            ))}
            {locs.length > 3 && <span className="text-xs text-zinc-600">+{locs.length - 3}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════
export default function DashboardPage() {
  const { device } = useDevice();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<DashData['pendingReminders']>([]);

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(d => {
      setData(d); setReminders(d.pendingReminders || []); setLoading(false);
    });
  }, []);

  const markDone = async (id: number) => {
    await fetch(`/api/reminders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_done: 1 }),
    });
    setReminders(r => r.filter(x => x.id !== id));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const stats = [
    { label: '客户总数', value: data?.totalCustomers ?? 0, color: '#3b82f6', href: '/customers', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: '待办提醒', value: reminders.length, color: '#f59e0b', href: '#', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
    { label: '近期跟进', value: data?.recentFollowUps.length ?? 0, color: '#10b981', href: '/customers', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { label: '地址覆盖', value: data?.customerLocations.length ?? 0, color: '#a855f7', href: '/customers', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' },
  ];

  // ── 手机布局 (390px, 6.8英寸) ──────────────────────
  if (device === 'mobile') {
    return (
      <div className="space-y-3">
        {/* 统计数字：2列紧凑横条 */}
        <div className="grid grid-cols-2 gap-2">
          {stats.map(s => (
            <Link key={s.label} href={s.href}
              className="rounded-xl px-3 py-3 flex items-center gap-3 active:scale-95 transition-transform"
              style={{ background: `${s.color}12`, border: `1px solid ${s.color}28` }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}20` }}>
                <svg style={{ color: s.color, width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={s.icon} />
                </svg>
              </div>
              <div>
                <p className="text-xl font-bold text-white leading-none">{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: s.color }}>{s.label}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* 客户名单 */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <CardHeader title="最近客户" action={<Link href="/customers" className="text-xs text-blue-400">全部 →</Link>} />
          <div className="space-y-1">
            {(data?.recentCustomers || []).slice(0, 5).map(c => (
              <Link key={c.id} href={`/customers/${c.id}`}
                className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-zinc-800 active:bg-zinc-800 transition-colors group">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                  style={{ background: `${TYPE_DOT[c.type]}20`, color: TYPE_DOT[c.type] }}>{c.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate group-hover:text-blue-400 transition-colors">{c.name}</p>
                  <p className="text-xs text-zinc-500">{TYPE_LABELS[c.type]}</p>
                </div>
              </Link>
            ))}
          </div>
          <Link href="/customers/new" className="mt-3 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs text-blue-400 border border-dashed border-zinc-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            添加客户
          </Link>
        </div>

        {/* 待办事项 */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <CardHeader title="待办提醒" action={reminders.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full text-amber-400" style={{ background: 'rgba(245,158,11,0.12)' }}>{reminders.length}</span>
          )} />
          {reminders.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-3">
              <span className="text-lg">🎉</span>
              <p className="text-xs text-zinc-500">暂无待办</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.slice(0, 4).map(r => (
                <div key={r.id} className="flex items-start gap-2.5 px-2 py-2 rounded-xl" style={{ background: 'var(--bg-inner)' }}>
                  <button onClick={() => markDone(r.id)} className="mt-0.5 w-4 h-4 rounded border border-zinc-600 flex-shrink-0 hover:border-emerald-500 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 leading-relaxed">{r.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-blue-400">{r.customer_name}</span>
                      {r.remind_date && <span className="text-xs text-amber-400">{r.remind_date}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 客户分布 + 地址分布：2列 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold text-white mb-2">客户分布</p>
            <DonutChart data={data?.customersByType || []} size={64} />
          </div>
          <div className="rounded-2xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold text-white mb-2">地址分布 <span className="font-normal text-zinc-500">({data?.customerLocations.length || 0}家)</span></p>
            <LocationContent locations={data?.customerLocations || []} />
          </div>
        </div>

        {/* 近期跟进 */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <CardHeader title="近期跟进" />
          <div className="space-y-2">
            {(data?.recentFollowUps || []).slice(0, 4).map(f => (
              <Link key={f.id} href={`/customers/${f.customer_id || 0}`}
                className="flex items-start gap-2.5 px-2 py-2 rounded-xl group" style={{ background: 'var(--bg-inner)' }}>
                <div className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ background: TYPE_DOT[f.customer_type] || '#6b7280' }} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-200 truncate group-hover:text-blue-400 transition-colors">{f.title}</p>
                  <p className="text-xs text-zinc-500">{f.customer_name} · {f.created_at.substring(0, 10)}</p>
                </div>
              </Link>
            ))}
            {(data?.recentFollowUps || []).length === 0 && <p className="text-xs text-zinc-600 text-center py-2">暂无跟进记录</p>}
          </div>
        </div>

        {/* 日历 */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <CalendarWidget />
        </div>

        {/* 快速录音：横向横幅 */}
        <Link href="/quick-record"
          className="rounded-2xl px-5 py-4 flex items-center gap-4 active:scale-95 transition-transform"
          style={{ background: '#0f0f1a', border: '1px solid rgba(239,68,68,0.3)' }}>
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20 scale-150" />
            <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/50 relative z-10">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16c-2.47 0-4.52-1.8-4.93-4.15-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">快速语音记录</p>
            <p className="text-xs text-zinc-500 mt-0.5">点击立即开始录音</p>
          </div>
          <svg className="w-5 h-5 text-zinc-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* 语音记录 */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <VoiceRecordWidget />
        </div>
      </div>
    );
  }

  // ── 平板布局 (768px, 11英寸) ────────────────────────
  if (device === 'tablet') {
    return (
      <div className="space-y-4">
        {/* 行1：4统计条 */}
        <div className="grid grid-cols-4 gap-3">
          {stats.map(s => (
            <Link key={s.label} href={s.href}
              className="rounded-2xl p-4 flex items-center gap-3 hover:opacity-90 transition-opacity"
              style={{ background: `${s.color}12`, border: `1px solid ${s.color}28` }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}20` }}>
                <svg className="w-4.5 h-4.5" style={{ color: s.color, width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={s.icon} />
                </svg>
              </div>
              <div>
                <p className="text-xl font-bold text-white leading-none">{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: s.color }}>{s.label}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* 行2：客户名单(2/5) + 待办(2/5) + 分布图(1.6/5) */}
        <div className="grid gap-3" style={{ gridTemplateColumns: '2fr 2fr 1.6fr' }}>
          {/* 客户名单 */}
          <div className="rounded-2xl p-4 flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 280 }}>
            <CardHeader title="最近客户" action={<Link href="/customers" className="text-xs text-blue-400">全部 →</Link>} />
            <div className="flex-1 overflow-y-auto space-y-2">
              {(data?.recentCustomers || []).slice(0, 6).map(c => (
                <Link key={c.id} href={`/customers/${c.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-800 transition-colors group">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                    style={{ background: `${TYPE_DOT[c.type]}20`, color: TYPE_DOT[c.type] }}>{c.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200 truncate group-hover:text-blue-400 transition-colors">{c.name}</p>
                    <p className="text-xs text-zinc-500">{c.contact_name || TYPE_LABELS[c.type]}</p>
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/customers/new" className="mt-3 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs text-blue-400 border border-dashed border-zinc-700 hover:border-blue-600 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              添加新客户
            </Link>
          </div>

          {/* 待办事项 */}
          <div className="rounded-2xl p-4 flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 280 }}>
            <CardHeader title="待办提醒" action={reminders.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full text-amber-400" style={{ background: 'rgba(245,158,11,0.1)' }}>{reminders.length} 条</span>
            )} />
            <div className="flex-1 overflow-y-auto space-y-2">
              {reminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <span className="text-3xl">🎉</span>
                  <p className="text-sm text-zinc-600">全部完成了</p>
                </div>
              ) : reminders.map(r => (
                <div key={r.id} className="flex items-start gap-2.5 p-2 rounded-xl" style={{ background: 'var(--bg-inner)' }}>
                  <button onClick={() => markDone(r.id)} className="mt-0.5 w-4 h-4 rounded border border-zinc-600 flex-shrink-0 hover:border-emerald-500 hover:bg-emerald-500/10 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 leading-relaxed">{r.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-blue-400">{r.customer_name}</span>
                      {r.remind_date && <span className="text-xs text-amber-400">{r.remind_date}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 客户分布图 */}
          <div className="rounded-2xl p-4 flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 280 }}>
            <CardHeader title="客户分布" />
            <div className="flex-1 flex flex-col justify-center overflow-hidden">
              <DonutChart data={data?.customersByType || []} size={76} />
              <RelationBars data={data?.customersByType || []} />
            </div>
          </div>
        </div>

        {/* 行3：地址分布 + 近期跟进 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4 flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 220 }}>
            <CardHeader title="客户地址分布" action={<span className="text-xs text-zinc-500">{data?.customerLocations.length || 0} 家</span>} />
            <LocationContent locations={data?.customerLocations || []} />
          </div>
          <div className="rounded-2xl p-4 flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 220 }}>
            <CardHeader title="近期跟进" />
            <div className="flex-1 overflow-y-auto space-y-2">
              {(data?.recentFollowUps || []).slice(0, 4).map(f => (
                <Link key={f.id} href={`/customers/${f.customer_id || 0}`}
                  className="flex gap-2.5 p-2 rounded-xl hover:bg-zinc-800 transition-colors group block" style={{ background: 'var(--bg-inner)' }}>
                  <div className="w-1 rounded-full flex-shrink-0 mt-0.5" style={{ background: TYPE_DOT[f.customer_type] || '#6b7280', alignSelf: 'stretch' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200 truncate group-hover:text-blue-400 transition-colors">{f.title}</p>
                    <p className="text-xs text-zinc-500">{f.customer_name} · {f.created_at.substring(0, 10)}</p>
                  </div>
                </Link>
              ))}
              {(data?.recentFollowUps || []).length === 0 && <p className="text-xs text-zinc-600 text-center py-4">暂无跟进记录</p>}
            </div>
          </div>
        </div>

        {/* 行4：日历 */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <CalendarWidget />
        </div>

        {/* 行5：语音记录（全宽） */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <VoiceRecordWidget />
        </div>
      </div>
    );
  }

  // ── 电脑布局 (14英寸, 1280px+) ──────────────────────
  return (
    <div className="space-y-5">
      {/* 行1：4个统计条（宽扁形） */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map(s => (
          <Link key={s.label} href={s.href}
            className="rounded-2xl p-5 flex items-center gap-4 hover:opacity-90 transition-opacity"
            style={{ background: `${s.color}10`, border: `1px solid ${s.color}25` }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}20` }}>
              <svg style={{ color: s.color, width: 22, height: 22 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={s.icon} />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white leading-none">{s.value}</p>
              <p className="text-xs mt-1" style={{ color: s.color }}>{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* 行2：客户名单 + 待办事项 + 分布图（3列等宽） */}
      <div className="grid grid-cols-3 gap-4">
        {/* 客户名单 */}
        <div className="rounded-2xl p-5 flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 320 }}>
          <CardHeader title="最近客户" action={<Link href="/customers" className="text-xs text-blue-400 hover:text-blue-300">查看全部 →</Link>} />
          <div className="flex-1 overflow-y-auto space-y-1">
            {(data?.recentCustomers || []).map(c => (
              <Link key={c.id} href={`/customers/${c.id}`} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-zinc-800 transition-colors group">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                  style={{ background: `${TYPE_DOT[c.type]}20`, color: TYPE_DOT[c.type] }}>{c.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-blue-400 transition-colors">{c.name}</p>
                  <p className="text-xs text-zinc-500">{c.contact_name || TYPE_LABELS[c.type]}</p>
                </div>
                <span className="text-xs text-zinc-600 flex-shrink-0">{TYPE_LABELS[c.type]}</span>
              </Link>
            ))}
          </div>
          <Link href="/customers/new" className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm text-blue-400 border border-dashed border-zinc-700 hover:border-blue-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            添加新客户
          </Link>
        </div>

        {/* 待办事项 */}
        <div className="rounded-2xl p-5 flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 320 }}>
          <CardHeader title="待办提醒" action={reminders.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full text-amber-400" style={{ background: 'rgba(245,158,11,0.1)' }}>{reminders.length} 条待处理</span>
          )} />
          <div className="flex-1 overflow-y-auto space-y-2">
            {reminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <span className="text-4xl">🎉</span>
                <p className="text-sm text-zinc-500">暂无待办事项</p>
              </div>
            ) : reminders.map(r => (
              <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-inner)' }}>
                <button onClick={() => markDone(r.id)} className="mt-0.5 w-4 h-4 rounded border border-zinc-600 flex-shrink-0 hover:border-emerald-500 hover:bg-emerald-500/10 transition-colors" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 leading-relaxed">{r.content}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Link href="#" className="text-xs text-blue-400 hover:underline">{r.customer_name}</Link>
                    {r.remind_date && <span className="text-xs text-amber-400">{r.remind_date}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 客户分布 */}
        <div className="rounded-2xl p-5 flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 320 }}>
          <CardHeader title="客户分布" />
          <div className="flex-1 flex flex-col justify-center overflow-hidden">
            <DonutChart data={data?.customersByType || []} size={96} />
            <RelationBars data={data?.customersByType || []} />
          </div>
        </div>
      </div>

      {/* 行3：地址分布 + 近期跟进（2列） */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 240 }}>
          <CardHeader title="客户地址分布" action={<span className="text-xs text-zinc-500">{data?.customerLocations.length || 0} 家有地址记录</span>} />
          <LocationContent locations={data?.customerLocations || []} />
        </div>
        <div className="rounded-2xl p-5 flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 240 }}>
          <CardHeader title="近期跟进记录" />
          <div className="flex-1 overflow-y-auto space-y-2">
            {(data?.recentFollowUps || []).map(f => (
              <Link key={f.id} href={`/customers/${f.customer_id || 0}`}
                className="flex gap-3 p-3 rounded-xl hover:bg-zinc-800 transition-colors group block" style={{ background: 'var(--bg-inner)' }}>
                <div className="w-1 rounded-full flex-shrink-0" style={{ background: TYPE_DOT[f.customer_type] || '#6b7280', alignSelf: 'stretch' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-blue-400 transition-colors">{f.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{f.customer_name} · {f.created_at.substring(0, 10)}</p>
                  {f.content && <p className="text-xs text-zinc-600 mt-0.5 line-clamp-1">{f.content}</p>}
                </div>
              </Link>
            ))}
            {(data?.recentFollowUps || []).length === 0 && <p className="text-sm text-zinc-600 text-center py-6">暂无跟进记录</p>}
          </div>
        </div>
      </div>

      {/* 行4：日历 */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <CalendarWidget />
      </div>

      {/* 行5：语音记录（全宽） */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <VoiceRecordWidget />
      </div>
    </div>
  );
}
