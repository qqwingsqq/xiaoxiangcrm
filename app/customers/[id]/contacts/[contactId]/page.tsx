import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ensureDb } from '@/lib/db';

interface ChatRow {
  id: number;
  raw_content: string;
  summary: string | null;
  chat_date: string | null;
  created_at: string;
  analysis_status: string;
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string; contactId: string }>;
}) {
  const { id, contactId } = await params;
  const db = await ensureDb();

  // 查询客户信息
  const { rows: [customer] } = await db.execute({
    sql: 'SELECT id, name, type, address, contact_info, wechat_id, customer_attribute, status FROM customers WHERE id = ?',
    args: [id],
  });
  if (!customer) notFound();

  // 查询联系人信息（从 wechat_contacts 表）
  const { rows: [contact] } = await db.execute({
    sql: 'SELECT * FROM wechat_contacts WHERE id = ? AND customer_id = ?',
    args: [contactId, id],
  });
  if (!contact) notFound();

  // 查询该联系人的聊天记录，按日期倒序
  const { rows: chats } = await db.execute({
    sql: `SELECT id, raw_content, summary, chat_date, created_at, analysis_status
          FROM wechat_chats
          WHERE customer_id = ? AND wechat_contact_id = ?
          ORDER BY chat_date DESC, created_at DESC`,
    args: [id, contactId],
  });

  // 按日期分组
  const grouped = (chats as ChatRow[]).reduce<Record<string, ChatRow[]>>((acc, chat) => {
    const date = chat.chat_date || chat.created_at.substring(0, 10);
    acc[date] = acc[date] || [];
    acc[date].push(chat);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      {/* 面包屑 */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/customers" className="hover:text-blue-400 transition-colors">客户列表</Link>
        <span>/</span>
        <Link href={`/customers/${id}`} className="hover:text-blue-400 transition-colors truncate max-w-xs">{customer.name as string}</Link>
        <span>/</span>
        <span className="text-zinc-300">{contact.name as string}</span>
      </div>

      {/* 客户基础信息卡片 */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-white">{customer.name as string}</h1>
            <p className="text-xs text-zinc-500 mt-1">{(customer.address as string) || '暂无地址'}</p>
          </div>
          <Link href={`/customers/${id}`}
            className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
            ← 返回客户详情
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-zinc-500 block mb-1">联系人</span>
            <span className="text-zinc-200">{contact.name as string}</span>
          </div>
          <div>
            <span className="text-zinc-500 block mb-1">微信号</span>
            <span className="text-zinc-200">{(contact.wxid as string) || '—'}</span>
          </div>
          <div>
            <span className="text-zinc-500 block mb-1">职务</span>
            <span className="text-zinc-200">{(contact.role as string) || '—'}</span>
          </div>
          <div>
            <span className="text-zinc-500 block mb-1">聊天记录</span>
            <span className="text-zinc-200">{chats.length} 条</span>
          </div>
        </div>
      </div>

      {/* 微信聊天记录 */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">{contact.name as string} 的微信聊天记录</h2>
          <span className="text-xs text-zinc-500">{chats.length} 条</span>
        </div>

        {chats.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center py-8">暂无聊天记录</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([date, dayChats]) => (
              <div key={date} className="space-y-2">
                {/* 日期分隔线 */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                  <span className="text-xs text-zinc-500">{date}</span>
                  <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                </div>
                {/* 当天聊天记录 */}
                <div className="space-y-2">
                  {dayChats.map(chat => (
                    <div key={chat.id} className="rounded-lg p-3" style={{ background: 'var(--bg-inner)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-zinc-500">
                          {chat.chat_date || chat.created_at.substring(0, 10)}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          chat.analysis_status === 'done'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-zinc-700 text-zinc-500'
                        }`}>
                          {chat.analysis_status === 'done' ? '已分析' : '未分析'}
                        </span>
                      </div>
                      {chat.summary ? (
                        <p className="text-xs text-zinc-300 leading-relaxed">{chat.summary}</p>
                      ) : (
                        <p className="text-xs text-zinc-500 leading-relaxed line-clamp-3">{chat.raw_content}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
