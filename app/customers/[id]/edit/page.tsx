import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ensureDb } from '@/lib/db';
import CustomerForm from '../../CustomerForm';

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await ensureDb();
  const { rows: [row] } = await db.execute({ sql: 'SELECT * FROM customers WHERE id = ?', args: [id] });
  if (!row) notFound();
  const customer = row as unknown as {
    id: number; name: string; type: string;
    customer_attribute: string | null; customer_status: string | null;
    address: string | null; contact_name: string | null; contact_info: string | null;
    wechat_id: string | null;
  };

  return (
    <div>
      <div className="flex items-center gap-2 text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
        <Link href="/" className="hover:text-blue-400 transition-colors">客户列表</Link>
        <span>›</span>
        <Link href={`/customers/${id}`} className="hover:text-blue-400 transition-colors">{customer.name}</Link>
        <span>›</span>
        <span className="text-zinc-300">编辑</span>
      </div>
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 className="text-base font-semibold text-white mb-5">编辑客户信息</h2>
        <CustomerForm
          initial={{
            name: customer.name,
            customer_attribute: customer.customer_attribute || '',
            customer_status: customer.customer_status || '',
            address: customer.address || '', contact_name: customer.contact_name || '',
            contact_info: customer.contact_info || '', wechat_id: customer.wechat_id || '',
          }}
          customerId={customer.id}
        />
      </div>
    </div>
  );
}
