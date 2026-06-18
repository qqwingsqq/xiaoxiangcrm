'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Phase = 'idle' | 'recording' | 'paused' | 'done' | 'saving' | 'saved';

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
  interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((e: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  }
  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
  }
  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }
  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    [index: number]: SpeechRecognitionAlternative;
  }
  interface SpeechRecognitionAlternative {
    readonly transcript: string;
  }
  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
  }
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

export default function QuickRecordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const transcriptRef = useRef('');
  transcriptRef.current = transcript;

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      setError('您的浏览器不支持语音识别，请使用 Chrome 或 Safari');
    }
    return () => stopTimer();
  }, []);

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const startTimer = () => {
    startTimeRef.current = Date.now() - seconds * 1000;
    timerRef.current = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
  };

  const createRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.lang = 'zh-CN';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += text;
        else interim += text;
      }
      if (final) {
        setTranscript(prev => {
          const newText = prev ? prev + (prev.endsWith('，') || prev.endsWith('。') ? '' : '，') + final : final;
          return newText;
        });
      }
      setInterimText(interim);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech') return;
      if (e.error === 'not-allowed') {
        setError('请允许麦克风权限后重试');
        setPhase('idle');
        stopTimer();
      }
    };

    rec.onend = () => {
      // Auto-restart if still recording
      if (recognitionRef.current === rec) {
        try { rec.start(); } catch {}
      }
    };

    return rec;
  }, []);

  const startRecording = async () => {
    setError('');
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('无法获取麦克风权限，请在浏览器设置中允许');
      return;
    }

    const rec = createRecognition();
    if (!rec) return;
    recognitionRef.current = rec;
    try {
      rec.start();
      setPhase('recording');
      startTimer();
    } catch (e) {
      setError('启动语音识别失败：' + String(e));
    }
  };

  const pauseRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    stopTimer();
    setPhase('paused');
    setInterimText('');
  };

  const resumeRecording = () => {
    const rec = createRecognition();
    if (!rec) return;
    recognitionRef.current = rec;
    rec.start();
    setPhase('recording');
    startTimer();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    stopTimer();
    setInterimText('');
    setPhase('done');
  };

  const saveRecord = async () => {
    if (!transcript.trim()) { setError('还没有录入任何内容'); return; }
    setPhase('saving');
    const res = await fetch('/api/voice-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: transcript.trim(), duration: seconds }),
    });
    if (res.ok) {
      const data = await res.json();
      setSavedId(data.id);
      setPhase('saved');
    } else {
      setError('保存失败，请重试');
      setPhase('done');
    }
  };

  const reset = () => {
    setTranscript('');
    setInterimText('');
    setSeconds(0);
    setSavedId(null);
    setError('');
    setPhase('idle');
  };

  // ── Saved screen ──
  if (phase === 'saved' && savedId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6" style={{ background: '#0f172a' }}>
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-white mb-1">录音已保存</h2>
          <p className="text-sm text-zinc-400">时长 {fmtTime(seconds)} · {transcript.length} 字</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href={`/?highlight=${savedId}`}
            className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-medium text-center hover:bg-blue-500 transition-colors">
            回首页处理这条记录
          </Link>
          <button onClick={reset}
            className="w-full py-3 rounded-xl text-sm font-medium text-zinc-300 hover:text-white transition-colors"
            style={{ background: '#1e293b' }}>
            继续录制新内容
          </button>
          <Link href="/"
            className="w-full py-3 rounded-xl text-sm text-zinc-500 text-center hover:text-zinc-300 transition-colors">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  // ── Main recording screen ──
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f172a' }}>
      {/* Minimal header */}
      <div className="flex items-center justify-between px-5 pt-safe pt-4 pb-2">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Link>
        <span className="text-xs text-zinc-500">快速语音记录</span>
        {phase === 'done' && (
          <button onClick={reset} className="text-xs text-blue-400 hover:text-blue-300">重录</button>
        )}
        {phase !== 'done' && <div className="w-6" />}
      </div>

      {/* Timer */}
      <div className="text-center pt-8 pb-4">
        <div className={`text-5xl font-mono font-light tabular-nums ${phase === 'recording' ? 'text-white' : 'text-zinc-500'}`}>
          {fmtTime(seconds)}
        </div>
        <div className="mt-2 h-5 flex items-center justify-center">
          {phase === 'recording' && (
            <span className="flex items-center gap-1.5 text-xs text-red-400">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              正在录音
            </span>
          )}
          {phase === 'paused' && <span className="text-xs text-amber-400">已暂停</span>}
          {phase === 'done' && <span className="text-xs text-emerald-400">录音完成</span>}
          {phase === 'idle' && !error && <span className="text-xs text-zinc-600">点击按钮开始录音</span>}
        </div>
      </div>

      {/* Transcript area */}
      <div className="flex-1 mx-4 mb-4 overflow-hidden rounded-2xl" style={{ background: '#1e293b' }}>
        <div className="h-full overflow-y-auto p-4">
          {transcript || interimText ? (
            <p className="text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">
              {transcript}
              {interimText && <span className="text-zinc-500">{transcript ? '，' : ''}{interimText}</span>}
            </p>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
              <svg className="w-12 h-12 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <p className="text-sm text-zinc-600">语音将实时转写显示在这里</p>
              <p className="text-xs text-zinc-700">支持普通话识别</p>
            </div>
          )}
        </div>
      </div>

      {/* Editable in done phase */}
      {phase === 'done' && (
        <div className="mx-4 mb-3">
          <textarea
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            placeholder="可以在这里编辑转写内容..."
            rows={4}
            className="w-full px-4 py-3 rounded-2xl text-sm text-zinc-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: '#1e293b' }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mb-3 px-4 py-2.5 rounded-xl text-xs text-red-400" style={{ background: 'rgba(239,68,68,0.1)' }}>
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="pb-safe pb-10 px-6">
        {/* Primary button */}
        {phase === 'idle' && (
          <button onClick={startRecording} disabled={!supported}
            className="w-full flex flex-col items-center gap-1 disabled:opacity-40">
            <div className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-red-900/50">
              <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16c-2.47 0-4.52-1.8-4.93-4.15-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
              </svg>
            </div>
            <span className="text-xs text-zinc-500 mt-1">点击开始录音</span>
          </button>
        )}

        {phase === 'recording' && (
          <div className="flex gap-4 justify-center">
            <button onClick={pauseRecording}
              className="flex flex-col items-center gap-1 group">
              <div className="w-14 h-14 rounded-full group-hover:bg-zinc-700 transition-colors flex items-center justify-center" style={{ background: '#1e293b' }}>
                <svg className="w-6 h-6 text-zinc-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              </div>
              <span className="text-xs text-zinc-600">暂停</span>
            </button>
            <button onClick={stopRecording}
              className="flex flex-col items-center gap-1 group">
              <div className="w-20 h-20 rounded-full bg-red-600 group-hover:bg-red-500 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-red-900/50">
                <div className="w-8 h-8 bg-white rounded-sm" />
              </div>
              <span className="text-xs text-zinc-500">停止</span>
            </button>
          </div>
        )}

        {phase === 'paused' && (
          <div className="flex gap-4 justify-center">
            <button onClick={resumeRecording}
              className="flex flex-col items-center gap-1 group">
              <div className="w-14 h-14 rounded-full group-hover:bg-zinc-700 transition-colors flex items-center justify-center" style={{ background: '#1e293b' }}>
                <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="text-xs text-zinc-600">继续</span>
            </button>
            <button onClick={stopRecording}
              className="flex flex-col items-center gap-1 group">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#1e293b' }}>
                <div className="w-8 h-8 bg-zinc-400 rounded-sm group-hover:bg-white transition-colors" />
              </div>
              <span className="text-xs text-zinc-500">完成</span>
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col gap-3">
            <button onClick={saveRecord}
              className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white text-sm font-semibold transition-all">
              保存到首页 →
            </button>
            <p className="text-xs text-center text-zinc-600">保存后可在首页选择归属客户并用 AI 总结</p>
          </div>
        )}

        {phase === 'saving' && (
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-zinc-400">保存中...</span>
          </div>
        )}
      </div>
    </div>
  );
}
