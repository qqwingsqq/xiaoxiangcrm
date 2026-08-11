'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';

interface OrganizeProgress {
  done: number;
  remaining: number;
}

interface OrganizeContextValue {
  organizing: boolean;
  progress: OrganizeProgress | null;
  error: string;
  done: string;
  startOrganize: () => void;
  clearStatus: () => void;
}

const OrganizeContext = createContext<OrganizeContextValue>({
  organizing: false,
  progress: null,
  error: '',
  done: '',
  startOrganize: () => {},
  clearStatus: () => {},
});

export function useOrganize() {
  return useContext(OrganizeContext);
}

export function OrganizeProvider({ children }: { children: ReactNode }) {
  const [organizing, setOrganizing] = useState(false);
  const [progress, setProgress] = useState<OrganizeProgress | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const runningRef = useRef(false);
  const errorRef = useRef('');

  // Resume from sessionStorage on mount (handles page refresh)
  useEffect(() => {
    const saved = sessionStorage.getItem('crm_organizing');
    if (saved === 'true' && !runningRef.current) {
      runningRef.current = true;
      setOrganizing(true);
      setProgress({ done: 0, remaining: 0 });
      runOrganizeLoop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist organizing state
  useEffect(() => {
    if (organizing) {
      sessionStorage.setItem('crm_organizing', 'true');
    } else {
      sessionStorage.removeItem('crm_organizing');
    }
  }, [organizing]);

  const runOrganizeLoop = useCallback(async () => {
    let totalDone = 0;
    let hadError = false;

    while (true) {
      try {
        const res = await fetch('/api/wechat/batch-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_size: 8 }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setError(errData.error || 'API请求失败，状态码 ' + res.status);
          errorRef.current = errData.error || 'API请求失败';
          hadError = true;
          break;
        }
        const data = await res.json();
        if (data.failed > 0 && data.processed === 0) {
          setError('AI分析失败，请在设置页面检查API Key是否正确配置');
          errorRef.current = 'AI分析失败';
          hadError = true;
          break;
        }
        totalDone += data.processed ?? 0;
        setProgress({ done: totalDone, remaining: data.remaining ?? 0 });
        if (data.done || data.remaining === 0) break;
        await new Promise(r => setTimeout(r, 800));
      } catch (e) {
        setError('网络错误：' + String(e).substring(0, 100));
        errorRef.current = '网络错误';
        hadError = true;
        break;
      }
    }

    if (totalDone > 0) {
      setDone('整理完成，共处理 ' + totalDone + ' 条记录');
    } else if (!hadError) {
      setDone('没有需要整理的新记录');
    }
    setOrganizing(false);
    runningRef.current = false;
    sessionStorage.removeItem('crm_organizing');
  }, []);

  const startOrganize = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    errorRef.current = '';
    setError('');
    setDone('');
    setProgress({ done: 0, remaining: 0 });
    setOrganizing(true);
    runOrganizeLoop();
  }, [runOrganizeLoop]);

  const clearStatus = useCallback(() => {
    setError('');
    setDone('');
  }, []);

  return (
    <OrganizeContext.Provider value={{ organizing, progress, error, done, startOrganize, clearStatus }}>
      {children}
      {/* Global floating progress indicator - visible on all pages */}
      {organizing && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 9999,
            background: 'rgba(22,163,74,0.95)',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 500,
            maxWidth: 320,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          {progress
            ? `后台整理中 ${progress.done}/${progress.done + progress.remaining}`
            : '后台整理中...'}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </OrganizeContext.Provider>
  );
}