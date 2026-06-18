'use client';

import { useState } from 'react';

export default function WeChatButton({ wechatId }: { wechatId: string }) {
  const [status, setStatus] = useState<'idle' | 'copied'>('idle');

  const handle = async () => {
    // Copy WeChat ID to clipboard
    try {
      await navigator.clipboard.writeText(wechatId);
    } catch {
      const el = document.createElement('input');
      el.value = wechatId;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setStatus('copied');
    setTimeout(() => setStatus('idle'), 2500);

    // Open WeChat — try specific contact first, fallback to WeChat home
    setTimeout(() => {
      window.location.href = `weixin://dl/profile?username=${encodeURIComponent(wechatId)}`;
    }, 200);
  };

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <span className="text-sm font-mono select-all" style={{ color: 'var(--text-primary)' }}>
        {wechatId}
      </span>
      <button
        onClick={handle}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all active:scale-95"
        style={{
          background: status === 'copied' ? 'rgba(16,185,129,0.12)' : 'rgba(7,193,96,0.08)',
          border: `1px solid ${status === 'copied' ? 'rgba(16,185,129,0.35)' : 'rgba(7,193,96,0.25)'}`,
          color: status === 'copied' ? '#10b981' : '#07c160',
        }}
      >
        {/* WeChat icon */}
        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.295.295a.328.328 0 00.168-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.603-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.136 0 .246-.11.246-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.49.49 0 01.177-.554C22.956 18.117 24 16.487 24 14.667c0-3.12-2.843-5.842-7.063-5.809zM14.59 13.24c-.535 0-.969-.44-.969-.982 0-.542.434-.982.97-.982.535 0 .97.44.97.982 0 .542-.435.982-.97.982zm4.797 0c-.535 0-.969-.44-.969-.982 0-.542.434-.982.97-.982.535 0 .97.44.97.982 0 .542-.434.982-.97.982z"/>
        </svg>
        {status === 'copied' ? '已复制，正在打开微信…' : '复制并打开微信'}
      </button>
    </div>
  );
}
