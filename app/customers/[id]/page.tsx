import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ensureDb } from '@/lib/db';
import DeleteButton from './DeleteButton';
import FollowUps from './FollowUps';
import WeChatButton from '../WeChatButton';

const TYPE_LABELS: Record<string, string> = {
  dealer: '经销商', terminal: '终端客户', partner: '合作伙伴', potential: '潜在客户',
};
const TYPE_COLORS: Record<string, string> = {
  dealer: 'bg-purple-900/60 text-purple-300 border border-purple-700/50',
  terminal: 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50',
  partner: 'bg-blue-900/60 text-blue-300 border border-blue-700/50',
  potential: 'bg-amber-900/60 text-amber-300 border border-amber-700/50',
};

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
      <span className="w-20 flex-shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm" style={{ color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {value || '未填写'}
      </span>
    </div>
  );
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await ensureDb();
  const { rows: [row] } = await db.execute({ sql: 'SELECT * FROM customers WHERE id = ?', args: [id] });
  if (!row) notFound();
  const customer = row as unknown as {
    id: number; name: string; type: string; address: string | null;
    contact_name: string | null; contact_info: string | null;
    wechat_id: string | null;
    tags: string; created_at: string; updated_at: string;
  };

  let tags: string[] = [];
  try { tags = JSON.parse(customer.tags); } catch { tags = []; }

  return (
    <div className="space-y-5">
      {/* 面包屑 */}
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Link href="/" className="hover:text-blue-400 transition-colors">客户列表</Link>
        <span>›</span>
        <span className="text-zinc-300">{customer.name}</span>
      </div>

      {/* 客户信息卡 */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h2 className="text-lg font-semibold text-white">{customer.name}</h2>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${TYPE_COLORS[customer.type] || 'bg-zinc-800 text-zinc-400'}`}>
                {TYPE_LABELS[customer.type] || customer.type}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>创建于 {customer.created_at}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/customers/${customer.id}/edit`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white transition-colors"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              编辑
            </Link>
            <DeleteButton customerId={customer.id} customerName={customer.name} />
          </div>
        </div>

        <Row label="联系人" value={customer.contact_name} />
        <Row label="联系方式" value={customer.contact_info} />
        <div className="flex gap-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="w-20 flex-shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>微信号</span>
          {customer.wechat_id
            ? <WeChatButton wechatId={customer.wechat_id} />
            : <span className="text-sm" style={{ color: 'var(--text-muted)' }}>未填写</span>
          }
        </div>
        <div className="flex gap-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="w-20 flex-shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>地址</span>
          {customer.address ? (
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{customer.address}</span>
              <a
                href={`https://uri.amap.com/search?keyword=${encodeURIComponent(customer.address)}&src=xiaoxiangcrm`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md flex-shrink-0 transition-colors"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' }}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                高德地图
              </a>
            </div>
          ) : (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>未填写</span>
          )}
        </div>
        <div className="flex gap-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="w-20 flex-shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>客户标签</span>
          <div className="flex flex-wrap gap-1.5">
            {tags.length > 0 ? tags.map((tag, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded text-zinc-400" style={{ background: '#333336' }}>{tag}</span>
            )) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>未添加标签</span>}
          </div>
        </div>
        <div className="flex gap-4 py-3">
          <span className="w-20 flex-shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>最后更新</span>
          <span className="text-sm text-zinc-400">{customer.updated_at}</span>
        </div>
      </div>

      {/* 跟进记录 */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <FollowUps customerId={customer.id} />
      </div>
    </div>
  );
}
