'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Document {
  id: number;
  customer_id: number;
  follow_up_id: number | null;
  original_name: string;
  stored_name: string;
  file_size: number;
  analysis_status: 'pending' | 'analyzing' | 'done' | 'error';
  summary: string | null;
  key_points: string | null;
  reminders: string | null;
  created_at: string;
}

function AddToCalendarBtn({ content, remindDate }: { content: string; remindDate?: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(remindDate || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('09:00');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (saved) return (
    <span style={{ fontSize: '11px', color: '#34d399', padding: '2px 8px', borderRadius: '6px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>✓ 已加入日程</span>
  );

  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      + 加入日程
    </button>
  );

  const save = async () => {
    setSaving(true);
    await fetch('/api/calendar-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: content, start_time: `${date}T${time}:00`, end_time: `${date}T${time}:00` }),
    });
    setSaving(false);
    setSaved(true);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
      <input type="time" value={time} onChange={e => setTime(e.target.value)}
        style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
      <button onClick={save} disabled={saving}
        style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '6px', background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
        {saving ? '保存…' : '确认'}
      </button>
      <button onClick={() => setOpen(false)}
        style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '6px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>取消</button>
    </div>
  );
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const icons: Record<string, { icon: string; color: string }> = {
    pdf: { icon: 'PDF', color: '#ef4444' },
    doc: { icon: 'DOC', color: '#3b82f6' },
    docx: { icon: 'DOC', color: '#3b82f6' },
    xls: { icon: 'XLS', color: '#22c55e' },
    xlsx: { icon: 'XLS', color: '#22c55e' },
    ppt: { icon: 'PPT', color: '#f97316' },
    pptx: { icon: 'PPT', color: '#f97316' },
    txt: { icon: 'TXT', color: '#a1a1aa' },
    png: { icon: 'IMG', color: '#a855f7' },
    jpg: { icon: 'IMG', color: '#a855f7' },
    jpeg: { icon: 'IMG', color: '#a855f7' },
  };
  const info = icons[ext] || { icon: 'FILE', color: '#6b7280' };
  return (
    <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: `${info.color}22`, border: `1px solid ${info.color}44` }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color: info.color }}>{info.icon}</span>
    </div>
  );
}

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const fetchDoc = useCallback(async () => {
    const res = await fetch(`/api/documents/${id}`);
    if (!res.ok) { setError('文档不存在'); setLoading(false); return null; }
    const d: Document = await res.json();
    setDoc(d);
    setLoading(false);
    return d;
  }, [id]);

  const startAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setError('');
    const res = await fetch(`/api/documents/${id}/analyze`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'AI 分析失败');
      setAnalyzing(false);
      return;
    }
    const updated: Document = await res.json();
    setDoc(updated);
    setAnalyzing(false);
  }, [id]);

  // On mount: fetch doc, auto-start analysis if pending
  useEffect(() => {
    fetchDoc().then(d => {
      if (d?.analysis_status === 'pending') startAnalysis();
    });
  }, [fetchDoc, startAnalysis]);

  // Poll while analyzing (from another session)
  useEffect(() => {
    if (!doc || doc.analysis_status !== 'analyzing') return;
    const timer = setInterval(async () => {
      const d = await fetchDoc();
      if (d && d.analysis_status !== 'analyzing') clearInterval(timer);
    }, 2000);
    return () => clearInterval(timer);
  }, [doc?.analysis_status, fetchDoc]);

  const keyPoints: string[] = (() => { try { return JSON.parse(doc?.key_points || '[]'); } catch { return []; } })();
  const reminders: { content: string; remind_date?: string }[] = (() => { try { return JSON.parse(doc?.reminders || '[]'); } catch { return []; } })();

  const isAnalyzing = analyzing || doc?.analysis_status === 'analyzing';
  const isDone = doc?.analysis_status === 'done';

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 16px' }}>
      <div style={{ width: '20px', height: '20px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (error && !doc) return (
    <div style={{ textAlign: 'center', padding: '60px 16px' }}>
      <p style={{ color: '#f87171', marginBottom: '12px' }}>{error}</p>
      <button onClick={() => router.back()} style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>返回</button>
    </div>
  );

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '0 0 40px' }}>
      {/* 面包屑 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: 0 }}>← 返回</button>
        <span>›</span>
        <span style={{ color: 'var(--text-secondary)' }}>文档分析</span>
      </div>

      {/* 文档信息卡 */}
      <div style={{ borderRadius: '16px', padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FileIcon name={doc?.original_name || ''} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc?.original_name}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {doc?.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''} · 上传于 {doc?.created_at?.slice(0, 10)}
            </p>
          </div>
          {!isDone && !isAnalyzing && (
            <button onClick={startAnalysis}
              style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '10px', background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer', flexShrink: 0 }}>
              ✨ AI 分析
            </button>
          )}
          {isDone && (
            <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399', flexShrink: 0 }}>
              ✓ 分析完成
            </span>
          )}
        </div>
      </div>

      {/* 分析中状态 */}
      {isAnalyzing && (
        <div style={{ borderRadius: '16px', padding: '32px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: '16px', textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px' }}>AI 正在分析文档…</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>正在读取文字和图片内容，提取关键信息</p>
        </div>
      )}

      {/* 错误 */}
      {error && (
        <div style={{ borderRadius: '12px', padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>
          {error}
          <button onClick={startAnalysis} style={{ marginLeft: '12px', fontSize: '12px', padding: '2px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', cursor: 'pointer' }}>重试</button>
        </div>
      )}

      {/* 分析结果 */}
      {isDone && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* 内容摘要 */}
          {doc?.summary && (
            <div style={{ borderRadius: '16px', padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '8px', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>📋</div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>内容摘要</p>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{doc.summary}</p>
            </div>
          )}

          {/* 重点提取 */}
          {keyPoints.length > 0 && (
            <div style={{ borderRadius: '16px', padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '8px', background: 'rgba(234,179,8,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>⭐</div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>关键重点</p>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-inner)', padding: '1px 7px', borderRadius: '10px', border: '1px solid var(--border)' }}>{keyPoints.length} 条</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {keyPoints.map((point, i) => (
                  <div key={i} style={{ borderRadius: '10px', padding: '10px 12px', background: 'var(--bg-inner)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '6px', background: 'rgba(234,179,8,0.2)', color: '#fbbf24', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>{i + 1}</span>
                      <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, flex: 1 }}>{point}</p>
                    </div>
                    <div style={{ marginTop: '8px', marginLeft: '26px' }}>
                      <AddToCalendarBtn content={point} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 跟进提醒 */}
          {reminders.length > 0 && (
            <div style={{ borderRadius: '16px', padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '8px', background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>🔔</div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>建议跟进事项</p>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-inner)', padding: '1px 7px', borderRadius: '10px', border: '1px solid var(--border)' }}>{reminders.length} 条</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {reminders.map((r, i) => (
                  <div key={i} style={{ borderRadius: '10px', padding: '10px 12px', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ color: '#c084fc', fontSize: '13px', flexShrink: 0, marginTop: '1px' }}>›</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>{r.content}</p>
                        {r.remind_date && (
                          <p style={{ fontSize: '11px', color: '#c084fc', marginTop: '3px' }}>建议时间：{r.remind_date}</p>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: '8px', marginLeft: '18px' }}>
                      <AddToCalendarBtn content={r.content} remindDate={r.remind_date} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 快速操作 */}
          <div style={{ borderRadius: '16px', padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>已提取 {keyPoints.length} 个重点，{reminders.length} 个跟进建议</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {doc?.follow_up_id && (
                <Link href={`/customers/${doc.customer_id}`}
                  style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '10px', background: 'var(--bg-inner)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                  查看跟进记录
                </Link>
              )}
              <button onClick={startAnalysis} disabled={isAnalyzing}
                style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa', cursor: 'pointer', opacity: isAnalyzing ? 0.5 : 1 }}>
                重新分析
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
