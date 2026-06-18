'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getAudio, deleteAudio } from '@/lib/audioStorage';
import dynamic from 'next/dynamic';

const MindMapModal = dynamic(() => import('./MindMapModal'), { ssr: false });

interface VoiceRecord {
  id: number;
  title: string | null;
  transcript: string | null;
  summary: string | null;
  key_points: string;
  duration: number | null;
  customer_id: number | null;
  customer_name: string | null;
  status: string;
  created_at: string;
}

interface Customer { id: number; name: string; type: string; }

function fmtTime(s: number | null) {
  if (!s) return '';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── Audio player component ────────────────────────────────
function AudioPlayer({ recordId }: { recordId: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const prevUrlRef = useRef<string | null>(null);

  useEffect(() => {
    getAudio(recordId).then(blob => {
      if (blob) {
        const objUrl = URL.createObjectURL(blob);
        setUrl(objUrl);
        prevUrlRef.current = objUrl;
      }
      setChecked(true);
    });
    return () => { if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current); };
  }, [recordId]);

  if (!checked) return null;
  if (!url) return null;

  return (
    <div style={{ marginTop: '8px' }}>
      <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>🎵 录音文件（本设备）</p>
      <audio controls src={url} style={{ width: '100%', height: '32px', borderRadius: '8px', outline: 'none' }} />
      <a href={url} download={`录音_${recordId}.webm`}
        style={{ display: 'inline-block', marginTop: '4px', fontSize: '11px', color: '#60a5fa' }}>
        ↓ 下载录音
      </a>
    </div>
  );
}

// ── Schedule add inline form ──────────────────────────────
function AddToCalendar({ text, onAdded }: { text: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().substring(0, 10);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('09:00');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch('/api/calendar-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: text.substring(0, 60), event_date: date, event_time: time, description: text }),
    });
    setSaving(false);
    setOpen(false);
    onAdded();
  };

  if (open) {
    return (
      <div style={{ marginTop: '6px', padding: '8px 10px', borderRadius: '10px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <p style={{ fontSize: '11px', color: '#93c5fd', marginBottom: '6px', fontWeight: 500 }}>📅 加入日程</p>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ flex: 1, padding: '4px 8px', borderRadius: '6px', fontSize: '11px', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', outline: 'none' }} />
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            style={{ width: '80px', padding: '4px 6px', borderRadius: '6px', fontSize: '11px', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', outline: 'none' }} />
        </div>
        <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</p>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setOpen(false)} style={{ flex: 1, padding: '4px 0', borderRadius: '6px', fontSize: '11px', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer' }}>取消</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: '4px 0', borderRadius: '6px', fontSize: '11px', background: '#2563eb', border: 'none', color: 'white', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? '保存中…' : '确认加入'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setOpen(true)}
      style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa', cursor: 'pointer', marginLeft: '6px', flexShrink: 0 }}>
      + 加入日程
    </button>
  );
}

// ── Assign modal ─────────────────────────────────────────
function AssignModal({ record, customers, onClose, onAssigned }: {
  record: VoiceRecord; customers: Customer[];
  onClose: () => void; onAssigned: (r: VoiceRecord) => void;
}) {
  const [customerId, setCustomerId] = useState('');
  const [followUps, setFollowUps] = useState<{ id: number; title: string }[]>([]);
  const [followUpId, setFollowUpId] = useState('');
  const [createNew, setCreateNew] = useState(true);
  const [newTitle, setNewTitle] = useState(record.title || record.transcript?.substring(0, 30) || '语音跟进记录');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customerId) { setFollowUps([]); return; }
    fetch(`/api/customers/${customerId}/follow-ups`).then(r => r.json()).then(setFollowUps);
  }, [customerId]);

  const handleSave = async () => {
    if (!customerId) { alert('请选择客户'); return; }
    setSaving(true);
    let fId = followUpId ? Number(followUpId) : null;
    if (createNew || !fId) {
      const res = await fetch(`/api/customers/${customerId}/follow-ups`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, content: record.transcript, follow_up_date: new Date().toISOString().substring(0, 10) }),
      });
      if (res.ok) fId = (await res.json()).id;
    }
    const res = await fetch(`/api/voice-records/${record.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: Number(customerId), follow_up_id: fId, status: 'assigned' }),
    });
    if (res.ok) onAssigned(await res.json());
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
        style={{ background: '#1e1e23', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">将记录归属到客户</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {record.transcript && (
          <div className="p-3 rounded-xl text-xs text-zinc-400 leading-relaxed max-h-24 overflow-y-auto" style={{ background: '#111' }}>
            {record.transcript.substring(0, 200)}{record.transcript.length > 200 ? '...' : ''}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">选择客户</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: '#111', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="">请选择客户...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {customerId && (
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">跟进记录</label>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setCreateNew(true)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${createNew ? 'bg-blue-600 text-white' : 'text-zinc-400'}`}
                  style={!createNew ? { background: '#111', border: '1px solid var(--border)' } : {}}>新建跟进</button>
                <button onClick={() => setCreateNew(false)} disabled={followUps.length === 0}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${!createNew ? 'bg-blue-600 text-white' : 'text-zinc-400'}`}
                  style={createNew ? { background: '#111', border: '1px solid var(--border)' } : {}}>
                  已有 ({followUps.length})</button>
              </div>
              {createNew ? (
                <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  placeholder="跟进记录标题"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: '#111', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              ) : (
                <select value={followUpId} onChange={e => setFollowUpId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: '#111', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <option value="">选择跟进记录...</option>
                  {followUps.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
        <button onClick={handleSave} disabled={!customerId || saving}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
          {saving ? '保存中...' : '确认归属'}
        </button>
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────
export default function VoiceRecordWidget() {
  const [records, setRecords] = useState<VoiceRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<VoiceRecord | null>(null);
  const [summarizing, setSummarizing] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [mindMap, setMindMap] = useState<VoiceRecord | null>(null);
  const [calendarAdded, setCalendarAdded] = useState<Set<string>>(new Set());

  const load = async () => {
    const [rRes, cRes] = await Promise.all([fetch('/api/voice-records'), fetch('/api/customers')]);
    setRecords(await rRes.json());
    setCustomers(await cRes.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const summarize = async (id: number) => {
    setSummarizing(id);
    const res = await fetch(`/api/voice-records/${id}/summarize`, { method: 'POST' });
    if (res.ok) {
      const updated = await res.json();
      setRecords(r => r.map(x => x.id === id ? { ...x, ...updated } : x));
    } else {
      const e = await res.json(); alert(e.error || 'AI 总结失败');
    }
    setSummarizing(null);
  };

  const deleteRecord = async (id: number) => {
    if (!confirm('确认删除这条语音记录？')) return;
    await fetch(`/api/voice-records/${id}`, { method: 'DELETE' });
    await deleteAudio(id).catch(() => {});
    setRecords(r => r.filter(x => x.id !== id));
  };

  const markCalendarAdded = (key: string) => {
    setCalendarAdded(prev => new Set([...prev, key]));
  };

  const unassignedCount = records.filter(r => !r.customer_id).length;

  return (
    <>
      {assigning && (
        <AssignModal record={assigning} customers={customers}
          onClose={() => setAssigning(null)}
          onAssigned={updated => { setRecords(r => r.map(x => x.id === updated.id ? { ...x, ...updated } : x)); setAssigning(null); }} />
      )}
      {mindMap && (() => {
        const kps: string[] = (() => { try { return JSON.parse(mindMap.key_points); } catch { return []; } })();
        return (
          <MindMapModal
            title={mindMap.title || mindMap.created_at.substring(0, 16) + ' 的录音'}
            summary={mindMap.summary || ''}
            keyPoints={kps}
            onClose={() => setMindMap(null)}
          />
        );
      })()}

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">语音记录</h3>
            {unassignedCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full text-amber-400" style={{ background: 'rgba(245,158,11,0.1)' }}>
                {unassignedCount} 条待处理
              </span>
            )}
          </div>
          <Link href="/quick-record"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-300 hover:text-red-200 transition-colors"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            快速录音
          </Link>
        </div>

        {loading ? (
          <p className="text-xs text-center py-4 text-zinc-600">加载中...</p>
        ) : records.length === 0 ? (
          <div className="text-center py-8 rounded-xl" style={{ background: '#1c1c1f', border: '1px dashed var(--border)' }}>
            <svg className="w-10 h-10 text-zinc-700 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <p className="text-xs text-zinc-600 mb-2">暂无语音记录</p>
            <Link href="/quick-record" className="text-xs text-blue-400 hover:text-blue-300">立即开始录音 →</Link>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {records.map(r => {
              const keyPoints: string[] = (() => { try { return JSON.parse(r.key_points); } catch { return []; } })();
              const isExpanded = expanded === r.id;
              const isPending = !r.customer_id;
              const hasSummary = !!r.summary;

              return (
                <div key={r.id} className="rounded-xl overflow-hidden"
                  style={{ background: '#1c1c1f', border: `1px solid ${isPending ? 'rgba(245,158,11,0.25)' : 'var(--border)'}` }}>
                  {/* Header row */}
                  <div className="flex items-start gap-2.5 p-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: isPending ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)' }}>
                      <svg className={`w-3.5 h-3.5 ${isPending ? 'text-amber-400' : 'text-blue-400'}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16c-2.47 0-4.52-1.8-4.93-4.15-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-zinc-200 truncate">
                          {r.title || r.created_at.substring(0, 16) + ' 的录音'}
                        </span>
                        {r.duration && <span className="text-xs text-zinc-600">{fmtTime(r.duration)}</span>}
                        {r.customer_name && (
                          <span className="text-xs px-1.5 py-0.5 rounded text-blue-400" style={{ background: 'rgba(59,130,246,0.1)' }}>{r.customer_name}</span>
                        )}
                        {isPending && <span className="text-xs text-amber-500">待归属</span>}
                      </div>
                      {r.summary ? (
                        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{r.summary}</p>
                      ) : r.transcript ? (
                        <p className="text-xs text-zinc-600 mt-0.5 line-clamp-1">{r.transcript}</p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Expand */}
                      {r.transcript && (
                        <button onClick={() => setExpanded(isExpanded ? null : r.id)}
                          className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
                          <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                      {/* Mind map */}
                      {hasSummary && keyPoints.length > 0 && (
                        <button onClick={() => setMindMap(r)} title="思维导图"
                          className="text-xs px-2 py-1 rounded-lg font-medium transition-colors"
                          style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }}>
                          🗺️
                        </button>
                      )}
                      {/* AI summarize */}
                      {r.transcript && !r.summary && (
                        <button onClick={() => summarize(r.id)} disabled={summarizing === r.id}
                          className="text-xs px-2 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
                          style={{ background: '#1d4ed8', color: 'white' }}
                          title="AI 总结">
                          {summarizing === r.id ? '...' : '✨'}
                        </button>
                      )}
                      {/* Assign */}
                      {isPending && (
                        <button onClick={() => setAssigning(r)}
                          className="text-xs px-2 py-1 rounded-lg text-amber-400 hover:text-amber-300 font-medium transition-colors"
                          style={{ background: 'rgba(245,158,11,0.1)' }}>
                          归属
                        </button>
                      )}
                      {/* Delete */}
                      <button onClick={() => deleteRecord(r.id)}
                        className="p-1.5 rounded-lg text-zinc-700 hover:text-red-400 hover:bg-zinc-800 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t space-y-3" style={{ borderColor: '#2a2a2e' }}>
                      {/* Audio player */}
                      <AudioPlayer recordId={r.id} />

                      {r.summary && (
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">📋 摘要</p>
                          <p className="text-xs text-zinc-300 leading-relaxed">{r.summary}</p>
                        </div>
                      )}

                      {keyPoints.length > 0 && (
                        <div>
                          <p className="text-xs text-zinc-500 mb-1.5">✨ 要点 <span style={{ color: '#64748b', fontWeight: 400 }}>— 可加入日程</span></p>
                          <ul className="space-y-1.5">
                            {keyPoints.map((p, i) => {
                              const key = `${r.id}-kp-${i}`;
                              const added = calendarAdded.has(key);
                              return (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="text-blue-500 flex-shrink-0 mt-0.5">{i + 1}.</span>
                                  <span className="text-xs text-zinc-400 flex-1">{p}</span>
                                  {added ? (
                                    <span style={{ fontSize: '10px', color: '#10b981', flexShrink: 0 }}>✓ 已加入</span>
                                  ) : (
                                    <AddToCalendar text={p} onAdded={() => markCalendarAdded(key)} />
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {r.transcript && !r.summary && (
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">转写文字</p>
                          <p className="text-xs text-zinc-400 leading-relaxed max-h-32 overflow-y-auto">{r.transcript}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
