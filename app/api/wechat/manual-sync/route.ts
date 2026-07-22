import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { getMonitorUserId, getSessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const userId = getMonitorUserId(req) ?? getSessionUser(req)?.id;
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const db = await ensureDb();

    // 1. 统计 pending 分析任务数量（通过 customers 表过滤 user_id，兼容旧数据）
    const { rows: pendingRows } = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM wechat_chats wc
            JOIN customers c ON c.id = wc.customer_id
            WHERE wc.analysis_status = 'pending'
              AND (c.user_id = ? OR c.user_id IS NULL)`,
      args: [userId],
    });
    const pendingCount = (pendingRows[0] as any)?.cnt ?? 0;

    // 2. 检查最近是否有新同步的记录（最近5分钟内创建的）
    const { rows: recentRows } = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM wechat_chats wc
            JOIN customers c ON c.id = wc.customer_id
            WHERE wc.created_at > datetime('now', '-5 minutes')
              AND (c.user_id = ? OR c.user_id IS NULL)`,
      args: [userId],
    });
    const recentCount = (recentRows[0] as any)?.cnt ?? 0;

    // 3. 如果有 pending 的，触发批量分析（最多10条）
    let analyzed = 0;
    if (pendingCount > 0) {
      try {
        const { rows: chatRows } = await db.execute({
          sql: `SELECT wc.id FROM wechat_chats wc
                JOIN customers c ON c.id = wc.customer_id
                WHERE wc.analysis_status = 'pending'
                  AND (c.user_id = ? OR c.user_id IS NULL)
                ORDER BY wc.created_at DESC LIMIT 10`,
          args: [userId],
        });
        // 获取 AI API Key（键值对表结构）
        const { rows: settingRows } = await db.execute({
          sql: `SELECT value FROM user_settings WHERE key = 'ai_api_key' LIMIT 1`,
          args: [],
        });
        const apiKey = (settingRows[0] as any)?.value;
        if (apiKey && chatRows.length > 0) {
          const { default: Anthropic } = await import('@anthropic-ai/sdk');
          const client = new Anthropic({ apiKey });
          for (const row of chatRows) {
            const { rows: chats } = await db.execute({
              sql: `SELECT raw_content FROM wechat_chats WHERE id = ?`,
              args: [(row as any).id],
            });
            if (chats.length > 0) {
              const raw = (chats[0] as any).raw_content;
              try {
                const msg = await client.messages.create({
                  model: 'claude-haiku-4-5-20251001',
                  max_tokens: 300,
                  messages: [{ role: 'user', content: `分析这段微信聊天记录，返回JSON：{"summary":"摘要(50字内)","intent":"意向等级(high/medium/low/none)","next_action":"建议下一步"}\n\n聊天内容：${raw.substring(0, 2000)}` }],
                });
                const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
                const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
                await db.execute({
                  sql: `UPDATE wechat_chats SET analysis_status = 'done', summary = ?, intent_level = ?, next_action = ? WHERE id = ?`,
                  args: [parsed.summary || null, parsed.intent || null, parsed.next_action || null, (row as any).id],
                });
                analyzed++;
              } catch {
                await db.execute({
                  sql: `UPDATE wechat_chats SET analysis_status = 'error' WHERE id = ?`,
                  args: [(row as any).id],
                });
              }
            }
          }
        }
      } catch {
        // AI 分析失败不影响同步结果
      }
    }

    return NextResponse.json({
      added: recentCount,
      skipped: 0,
      analyzed,
      pending: pendingCount - analyzed,
      message: recentCount > 0
        ? `最近5分钟内有 ${recentCount} 条新记录已同步`
        : '暂无新记录，请确认手机端同步程序正在运行',
    });
  } catch (err: any) {
    console.error('manual-sync error:', err);
    return NextResponse.json({ error: err.message || '服务器内部错误' }, { status: 500 });
  }
}
