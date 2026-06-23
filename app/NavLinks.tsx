'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AIAssistant from './AIAssistant';

const NAV = [
  { href: '/', label: '首页', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/customers', label: '客户列表', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/map', label: '客户地图', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { href: '/wechat', label: '微信跟进', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      <nav className="flex items-center gap-1">
        {/* 普通页面导航 */}
        {NAV.map(n => {
          const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={n.icon} />
              </svg>
              <span className="hidden sm:inline">{n.label}</span>
            </Link>
          );
        })}

        {/* 分隔线 */}
        <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />

        {/* AI 助手入口 —— 独立按钮，风格与普通导航一致但用紫色强调 */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-ai-assistant'))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-violet-900/30"
          style={{ color: '#a78bfa', border: 'none', background: 'transparent', cursor: 'pointer' }}
          title="AI助手"
        >
          {/* chat-bubble icon */}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="hidden sm:inline">AI助手</span>
        </button>
      </nav>

      {/* AIAssistant 和触发按钮在同一 Client Component 树中，保证已挂载 */}
      <AIAssistant />
    </>
  );
}
