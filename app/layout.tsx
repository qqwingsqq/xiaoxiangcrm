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
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('crm-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();` }} />
        <meta name="theme-color" content="#18181b" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="apple-touch-icon" href="/Logo.png" />
      </head>
      <body className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <PWAInit />
        <DevicePreviewProvider>
          <header className="sticky top-0 z-50 border-b" style={{ background: 'var(--bg-header)', borderColor: 'var(--border)' }}>
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2.5">
                  <img src="/Logo.png" alt="小象智能" className="h-8 w-auto" />
                  <span className="font-semibold text-sm hidden sm:block" style={{ color: 'var(--text-primary)' }}>小象智能</span>
                </div>
                <NavLinks />
              </div>
              <div className="flex items-center gap-1">
                {/* 设置 */}
                <a href="/settings"
                  className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-zinc-800"
                  title="设置"
                  style={{ color: 'var(--text-muted)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
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
