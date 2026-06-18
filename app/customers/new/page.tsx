import Link from 'next/link';
import CustomerForm from '../CustomerForm';

export default function NewCustomerPage() {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
        <Link href="/" className="hover:text-blue-400 transition-colors">客户列表</Link>
        <span>›</span>
        <span className="text-zinc-300">添加客户</span>
      </div>
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 className="text-base font-semibold text-white mb-5">添加新客户</h2>
        <CustomerForm />
      </div>
    </div>
  );
}
