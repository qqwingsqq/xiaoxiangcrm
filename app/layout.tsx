import type { Metadata } from 'next';
import './globals.css';
import { DevicePreviewProvider, DevicePreviewBar, DevicePreviewWrapper } from './DevicePreviewProvider';
import NavLinks from './NavLinks';
import PWAInit from './PWAInit';

export const metadata: Metadata = {
  title: '小象智能 · 客户管理',
  description: '小象智能 CRM 系统',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '小象CRM',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="theme-color" content="#18181b" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <PWAInit />
        <DevicePreviewProvider>
          <header className="sticky top-0 z-50 border-b" style={{ background: '#111113', borderColor: 'var(--border)' }}>
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2.5">
                  <img src="/logo.png" alt="小象智能" className="h-8 w-auto" />
                  <span className="font-semibold text-white text-sm hidden sm:block">小象智能</span>
                </div>
                <NavLinks />
              </div>
              <div className="flex items-center gap-2">
                {/* 快速语音入口 */}
                <a href="/quick-record"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-red-300 hover:text-red-200 hover:bg-red-900/30"
                  title="快速语音记录">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="hidden sm:inline">语音记录</span>
                </a>
                <DevicePreviewBar />
              </div>
            </div>
          </header>
          <DevicePreviewWrapper>
            {children}
          </DevicePreviewWrapper>
        </DevicePreviewProvider>
      </body>
    </html>
  );
}
