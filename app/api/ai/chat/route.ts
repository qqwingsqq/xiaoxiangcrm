import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { callAI } from '@/lib/openrouter';

export async function POST(req: NextRequest) {
  const { message, history = [] } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: '消息不能为空' }, { status: 400 });

  const db = await ensureDb();
  const { rows: customers } = await db.execute('SELECT id, name FROM customers ORDER BY created_at DESC LIMIT 60');
  const customerList = (customers as unknown as { id: number; name: string }[]).map(c => `${c.name}(id:${c.id})`).join('、');

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const systemPrompt = `你是小象智能CRM系统的AI销售助手，帮助销售人员快速记录工作。

今天日期：${todayStr}
当前客户列表：${customerList || '暂无客户'}

任务：
1. 用简洁友好的中文回复用户（1-3句话）
2. 在回复末尾加一个[ACTION]JSON标签，包含识别到的操作意图

[ACTION]类型说明：
- follow_up：记录与客户的跟进（通话、拜访、沟通记录等）
  {"type":"follow_up","customer_name":"客户名","title":"跟进标题","content":"具体内容","date":"YYYY-MM-DD或null"}
- schedule：添加日程（会议、拜访、展会等）
  {"type":"schedule","title":"日程标题","date":"YYYY-MM-DD","time":"HH:MM或null","description":"备注"}
- reminder：设置提醒（仅当明确提到客户列表中某个客户名时使用）
  {"type":"reminder","customer_name":"客户名","content":"提醒内容","date":"YYYY-MM-DD或null"}
- none：普通对话
  {"type":"none"}

规则：
- 相对日期（明天、下周五等）请计算成具体日期
- 如果用户提到客户名，优先从客户列表中匹配，保持原始说法
- 如果用户说"提醒我去见客户"、"提醒我联系一下"等，但未指明客户列表里的具体客户名，请使用schedule类型而不是reminder类型
- 每条消息只返回一个[ACTION]
- [ACTION]内只能是有效JSON，不要换行注释`;

  try {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...(history as { role: 'user' | 'assistant'; content: string }[]),
      { role: 'user' as const, content: message.trim() },
    ];
    const raw = await callAI(messages, 512);

    const actionMatch = raw.match(/\[ACTION\]([\s\S]*?)\[\/ACTION\]/);
    let action: Record<string, unknown> | null = null;
    const reply = raw.replace(/\[ACTION\][\s\S]*?\[\/ACTION\]/g, '').trim();

    if (actionMatch) {
      try { action = JSON.parse(actionMatch[1].trim()); } catch { /* ignore parse error */ }
    }
    if (!action) action = { type: 'none' };

    return NextResponse.json({ reply, action });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('401')) return NextResponse.json({ error: 'API Key 无效，请在设置中重新配置' }, { status: 401 });
    return NextResponse.json({ error: '网络错误，请稍后再试' }, { status: 500 });
  }
}