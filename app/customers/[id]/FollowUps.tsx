'use client';

import { useState, useEffect, useRef } from 'react';

interface DocFile {
  id: number;
  original_name: string;
  file_size: number | null;
  summary: string | null;
  key_points: string;
  reminders: string;
  analysis_status: string;
  created_at: string;
}

interface FollowUp {
  id: number;
  title: string;
  content: string | null;
  follow_up_date: string | null;
  created_at: string;
  doc_count: number;
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
};
const inputCls = 'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  const icons: Record<string, { icon: string; color: string }> = {
    doc: { icon: 'W', color: '#2563eb' }, docx: { icon: 'W', color: '#2563eb' },
    xls: { icon: 'X', color: '#16a34a' }, xlsx: { icon: 'X', color: '#16a34a' },
    ppt: { icon: 'P', color: '#dc2626' }, pptx: { icon: 'P', color: '#dc2626' },
    txt: { icon: 'T', color: '#6b7280' }, md: { icon: 'M', color: '#8b5cf6' },
    pdf: { icon: 'PDF', color: '#dc2626' },
    jpg: { icon: '🖼', color: '#f59e0b' }, jpeg: { icon: '🖼', color: '#f59e0b' },
    png: { icon: '🖼', color: '#f59e0b' }, gif: { icon: '🖼', color: '#f59e0b' },
    webp: { icon: '🖼', color: '#f59e0b' }, bmp: { icon: '🖼', color: '#f59e0b' },
  };
  return icons[ext || ''] || { icon: '📄', color: '#6b7280' };
}

function fmtSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function AddToCalendarBtn({ text, date }: { text: string; date?: string }) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().substring(0, 10);
  const [evDate, setEvDate] = useState(date || today);
  const [evTime, setEvTime] = useState('09:00');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch('/api/calendar-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: text.substring(0, 60), event_date: evDate, event_time: evTime, description: text }),
    });
    setSaving(false);
    setOpen(false);
    setDone(true);
  };

  if (done) return <span style={{ fontSize: '10px', color: '#10b981', flexShrink: 0 }}>✓ 已加入日程</span>;

  if (open) {
    return (
      <div style={{ marginTop: '6px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
          <input type="date" value={evDate} onChange={e => setEvDate(e.target.value)}
            style={{ flex: 1, padding: '3px 6px', borderRadius: '5px', fontSize: '11px', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', outline: 'none' }} />
          <input type="time" value={evTime} onChange={e => setEvTime(e.target.value)}
            style={{ width: '76px', padding: '3px 5px', borderRadius: '5px', fontSize: '11px', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button onClick={() => setOpen(false)} style={{ flex: 1, padding: '3px 0', borderRadius: '5px', fontSize: '10px', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer' }}>取消</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: '3px 0', borderRadius: '5px', fontSize: '10px', background: '#2563eb', border: 'none', color: 'white', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? '保存中…' : '确认加入'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setOpen(true)}
      style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '5px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
      + 加入日程
    </button>
  );
}

function DocumentCard({ doc, onDeleted, onAnalyzed }: {
  doc: DocFile;
  onDeleted: () => void;
  onAnalyzed: (d: DocFile) => void;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fi = fileIcon(doc.original_name);
  const keyPoints: string[] = (() => { try { return JSON.parse(doc.key_points); } catch { return []; } })();
  const docReminders: { content: string; remind_date?: string }[] = (() => { try { return JSON.parse(doc.reminders); } catch { return []; } })();

  const analyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/analyze`, { method: 'POST' });
      if (res.ok) { onAnalyzed(await res.json()); setExpanded(true); }
      else { const e = await res.json(); alert(e.error || 'AI 分析失败'); }
    } finally { setAnalyzing(false); }
  };

  const statusBadge: Record<string, React.ReactNode> = {
    pending: <span className="text-xs px-2 py-0.5 rounded-full text-zinc-500" style={{ background: '#2a2a2a' }}>待分析</span>,
    analyzing: <span className="text-xs px-2 py-0.5 rounded-full text-blue-400 animate-pulse" style={{ background: 'rgba(59,130,246,0.1)' }}>分析中...</span>,
    done: <span className="text-xs px-2 py-0.5 rounded-full text-emerald-400" style={{ background: 'rgba(16,185,129,0.1)' }}>已分析</span>,
    error: <span className="text-xs px-2 py-0.5 rounded-full text-red-400" style={{ background: 'rgba(239,68,68,0.1)' }}>失败</span>,
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#1c1c1f', border: '1px solid var(--border)' }}>
      {/* File header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-xs font-bold"
          style={{ background: `${fi.color}20`, color: fi.color }}>
          {fi.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-zinc-300 truncate">{doc.original_name}</p>
          <p className="text-xs text-zinc-600">{fmtSize(doc.file_size)} · {doc.created_at.substring(0, 10)}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {statusBadge[doc.analysis_status]}
          {doc.analysis_status === 'done' && (
            <button onClick={() => setExpanded(e => !e)}
              className="text-xs px-2 py-1 rounded text-blue-400 hover:text-blue-300 hover:bg-zinc-800 transition-colors">
              {expanded ? '收起' : '查看'}
            </button>
          )}
          {(doc.analysis_status === 'pending' || doc.analysis_status === 'error') && (
            <button onClick={analyze} disabled={analyzing}
              className="text-xs px-2.5 py-1 rounded text-white disabled:opacity-50 transition-colors font-medium"
              style={{ background: analyzing ? '#333' : '#1d4ed8' }}>
              {analyzing ? '分析中' : '✨ AI分析'}
            </button>
          )}
          <button onClick={() => { if (confirm(`删除"${doc.original_name}"？`)) { fetch(`/api/documents/${doc.id}`, { method: 'DELETE' }).then(onDeleted); } }}
            className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Analysis result */}
      {expanded && doc.analysis_status === 'done' && (
        <div className="px-3 pb-3 border-t space-y-3" style={{ borderColor: '#333' }}>
          {doc.summary && (
            <div className="pt-3">
              <p className="text-xs font-medium text-zinc-400 mb-1.5">📋 内容摘要</p>
              <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900 rounded-lg p-2.5">{doc.summary}</p>
            </div>
          )}
          {keyPoints.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1.5">✨ 重点提取 <span style={{ color: '#64748b', fontWeight: 400 }}>— 可加入日程</span></p>
              <ul className="space-y-2">
                {keyPoints.map((pt, i) => (
                  <li key={i} className="text-xs">
                    <div className="flex gap-2 items-start">
                      <span className="text-blue-400 flex-shrink-0 font-bold">{i + 1}.</span>
                      <span className="text-zinc-300 flex-1">{pt}</span>
                      <AddToCalendarBtn text={pt} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {docReminders.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1.5">🔔 跟进提醒 <span style={{ color: '#64748b', fontWeight: 400 }}>— 可加入日程</span></p>
              <ul className="space-y-1.5">
                {docReminders.map((r, i) => (
                  <li key={i} className="text-xs">
                    <div className="flex gap-2 items-start p-2 rounded-lg"
                      style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
                      <span className="text-amber-400 flex-shrink-0">!</span>
                      <span className="text-zinc-300 flex-1">{r.content}</span>
                      {r.remind_date && (
                        <span className="text-amber-400 flex-shrink-0 text-xs mr-1">{r.remind_date}</span>
                      )}
                      <AddToCalendarBtn text={r.content} date={r.remind_date} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FollowUps({ customerId }: { customerId: number }) {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: '', content: '', follow_up_date: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const [docsMap, setDocsMap] = useState<Record<number, DocFile[]>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeUploadId, setActiveUploadId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/customers/${customerId}/follow-ups`);
    setFollowUps(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, [customerId]);

  const loadDocs = async (followUpId: number) => {
    const res = await fetch(`/api/follow-ups/${followUpId}`);
    const data = await res.json();
    setDocsMap(m => ({ ...m, [followUpId]: data.documents || [] }));
  };

  const toggleExpand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!docsMap[id]) await loadDocs(id);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/customers/${customerId}/follow-ups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ title: '', content: '', follow_up_date: '' });
      setShowAdd(false);
      await load();
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除此跟进记录？')) return;
    await fetch(`/api/follow-ups/${id}`, { method: 'DELETE' });
    if (expandedId === id) setExpandedId(null);
    await load();
  };

  const handleUpload = async (followUpId: number, file: File) => {
    setUploading(followUpId);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('customer_id', String(customerId));
    fd.append('follow_up_id', String(followUpId));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (res.ok) {
      const doc = await res.json();
      setDocsMap(m => ({ ...m, [followUpId]: [...(m[followUpId] || []), doc] }));
      setFollowUps(f => f.map(fu => fu.id === followUpId ? { ...fu, doc_count: fu.doc_count + 1 } : fu));
    } else {
      alert((await res.json()).error || '上传失败');
    }
    setUploading(null);
    setActiveUploadId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">跟进记录</h3>
        <button onClick={() => setShowAdd(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-500 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加跟进
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-xl p-4 mb-4 space-y-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <input type="text" placeholder="跟进标题（必填）" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className={inputCls} style={inputStyle} />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={form.follow_up_date}
              onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))}
              className={inputCls} style={inputStyle} />
          </div>
          <textarea placeholder="跟进内容记录..." value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            rows={3} className={`${inputCls} resize-none`} style={inputStyle} />
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors">
              {saving ? '保存中...' : '保存'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-4 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
              取消
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-center py-8 text-zinc-600">加载中...</p>
      ) : followUps.length === 0 ? (
        <div className="text-center py-10 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-sm text-zinc-600">暂无跟进记录，点击「添加跟进」开始记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {followUps.map(fu => (
            <div key={fu.id} className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              {/* Header */}
              <div className="flex items-start gap-3 p-4">
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: '#3b82f6', opacity: 0.6 }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-zinc-100">{fu.title}</span>
                    {fu.follow_up_date && (
                      <span className="text-xs px-1.5 py-0.5 rounded text-blue-400"
                        style={{ background: 'rgba(59,130,246,0.1)' }}>📅 {fu.follow_up_date}</span>
                    )}
                    {fu.doc_count > 0 && (
                      <span className="text-xs text-zinc-500">📎 {fu.doc_count} 份文档</span>
                    )}
                  </div>
                  {fu.content && (
                    <p className="text-xs leading-relaxed text-zinc-500 whitespace-pre-line">{fu.content}</p>
                  )}
                  <p className="text-xs mt-1.5 text-zinc-600">记录于 {fu.created_at}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleExpand(fu.id)}
                    className="text-xs px-2.5 py-1.5 rounded-lg transition-colors text-zinc-400 hover:text-white hover:bg-zinc-700"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                    {expandedId === fu.id ? '收起' : '文档'}
                  </button>
                  <button onClick={() => handleDelete(fu.id)}
                    className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Documents panel */}
              {expandedId === fu.id && (
                <div className="border-t px-4 pb-4" style={{ borderColor: 'var(--border)' }}>
                  {/* Upload area */}
                  <div className="mt-3 mb-3">
                    <label
                      className="flex flex-col items-center justify-center gap-2 w-full py-5 rounded-xl cursor-pointer transition-colors border-2 border-dashed hover:border-blue-500 hover:bg-blue-500/5"
                      style={{ borderColor: uploading === fu.id ? '#3b82f6' : 'var(--border-light)', background: '#1c1c1f' }}>
                      {uploading === fu.id ? (
                        <>
                          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-blue-400">上传中...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <div className="text-center">
                            <p className="text-xs font-medium text-zinc-300">点击上传文档 / 拖拽文件到此处</p>
                            <p className="text-xs text-zinc-600 mt-0.5">支持 Word、Excel、PPT、TXT、PDF、图片（JPG/PNG等）</p>
                          </div>
                        </>
                      )}
                      <input type="file" className="hidden"
                        accept=".txt,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp"
                        disabled={uploading === fu.id}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(fu.id, file);
                          e.target.value = '';
                        }} />
                    </label>
                  </div>

                  {/* Document list */}
                  {(docsMap[fu.id] || []).length === 0 ? (
                    <p className="text-xs text-center py-2 text-zinc-600">暂无文档，上传后可使用 AI 自动分析提取重点</p>
                  ) : (
                    <div className="space-y-2">
                      {(docsMap[fu.id] || []).map(doc => (
                        <DocumentCard key={doc.id} doc={doc}
                          onDeleted={() => {
                            setDocsMap(m => ({ ...m, [fu.id]: m[fu.id].filter(d => d.id !== doc.id) }));
                            setFollowUps(f => f.map(f2 => f2.id === fu.id ? { ...f2, doc_count: Math.max(0, f2.doc_count - 1) } : f2));
                          }}
                          onAnalyzed={updated => {
                            setDocsMap(m => ({ ...m, [fu.id]: m[fu.id].map(d => d.id === updated.id ? updated : d) }));
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
