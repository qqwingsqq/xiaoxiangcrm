import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ensureDb } from '@/lib/db';
import DeleteButton from './DeleteButton';
import FollowUps from './FollowUps';
import WeChatButton from '../WeChatButton';
import NavButton from './NavButton';


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
  const [{ rows: [row] }, { rows: attrRows }, { rows: statusRows }] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM customers WHERE id = ?', args: [id] }),
    db.execute('SELECT * FROM customer_attributes ORDER BY sort_order, id'),
    db.execute('SELECT * FROM customer_statuses ORDER BY sort_order, id'),
  ]);
  if (!row) notFound();
  type AttrRow = { key: string; label: string; color: string };
  type StatusRow = { key: string; label: string; shape: string; color: string };
  const attrMap = Object.fromEntries((attrRows as unknown as AttrRow[]).map(t => [t.key, t]));
  const statusMap = Object.fromEntries((statusRows as unknown as StatusRow[]).map(t => [t.key, t]));
  const customer = row as unknown as {
    id: number; name: string; type: string;
    customer_attribute: string | null; customer_status: string | null;
    address: string | null; contact_name: string | null; contact_info: string | null;
    wechat_id: string | null; tags: string; created_at: string; updated_at: string;
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
              {customer.customer_attribute && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${attrMap[customer.customer_attribute]?.color || '#6b7280'}22`, color: attrMap[customer.customer_attribute]?.color || '#9ca3af' }}>
                  {attrMap[customer.customer_attribute]?.label || customer.customer_attribute}
                </span>
              )}
              {customer.customer_status && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${statusMap[customer.customer_status]?.color || '#6b7280'}22`, color: statusMap[customer.customer_status]?.color || '#9ca3af' }}>
                  {statusMap[customer.customer_status]?.label || customer.customer_status}
                </span>
              )}
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
              <Link
                href={`/map?id=${customer.id}`}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md flex-shrink-0 transition-colors"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' }}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                客户地图
              </Link>
              <NavButton name={customer.name} address={customer.address ?? ''} />
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
