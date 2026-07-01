'use client';

import { useState } from 'react';

export default function WeChatImportGuide() {
  const [activeTab, setActiveTab] = useState<'bulk' | 'realtime'>('bulk');

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <a href="/wechat" className="hover:text-blue-400 transition-colors">微信跟进</a>
        <span>›</span>
        <span className="text-zinc-300">自动导入指南</span>
      </div>

      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8.5 4a6.5 6.5 0 00-3.5 12.01V19l2.7-1.35A6.5 6.5 0 108.5 4z" />
          </svg>
          自动导入电脑微信聊天记录
        </h2>
        <p className="text-xs text-zinc-500">一键读取本地微信聊天记录并 AI 提炼关键信息</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('bulk')}
          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: activeTab === 'bulk' ? 'var(--accent)' : 'var(--bg-card)',
            color: activeTab === 'bulk' ? 'white' : 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          📦 批量导入历史记录
        </button>
        <button
          onClick={() => setActiveTab('realtime')}
          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: activeTab === 'realtime' ? 'var(--accent)' : 'var(--bg-card)',
            color: activeTab === 'realtime' ? 'white' : 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          🔴 实时监控新消息
        </button>
      </div>

      {/* Bulk Import Tab */}
      {activeTab === 'bulk' && (
        <div className="space-y-3">
          {[
            {
              step: '1',
              title: '安装 Python',
              color: '#3b82f6',
              content: (
                <div className="space-y-2 text-xs text-zinc-400">
                  <p>下载并安装 Python 3.8 或更高版本：</p>
                  <a href="https://www.python.org/downloads/" target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300">
                    python.org/downloads ↗
                  </a>
                  <p className="text-zinc-500">安装时勾选「Add Python to PATH」</p>
                </div>
              ),
            },
            {
              step: '2',
              title: '安装依赖',
              color: '#8b5cf6',
              content: (
                <div className="space-y-2 text-xs text-zinc-400">
                  <p>以管理员身份打开命令提示符，进入脚本目录后运行：</p>
                  <code className="block px-3 py-2 rounded-lg text-xs font-mono text-zinc-300"
                    style={{ background: '#111', border: '1px solid #222' }}>
                    pip install -r requirements.txt
                  </code>
                  <p className="text-zinc-500">或手动安装：pip install requests pycryptodome pymem</p>
                </div>
              ),
            },
            {
              step: '3',
              title: '获取数据库密钥',
              color: '#f59e0b',
              content: (
                <div className="space-y-2 text-xs text-zinc-400">
                  <p>微信数据库是加密的，需要获取密钥才能解密：</p>
                  <ol className="space-y-1.5 pl-3 list-decimal list-inside">
                    <li>下载 WeChatMsg 工具：<a href="https://github.com/LC044/WeChatMsg/releases" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">github.com/LC044/WeChatMsg ↗</a></li>
                    <li>运行后点击「获取信息」，复制密钥（Key）</li>
                    <li>将密钥保存为 <code className="text-zinc-300">wechat_key.txt</code>，放在脚本目录下</li>
                  </ol>
                  <p className="text-zinc-500 mt-2">💡 也可以尝试让脚本自动从微信内存中提取密钥</p>
                </div>
              ),
            },
            {
              step: '4',
              title: '运行批量导入脚本',
              color: '#10b981',
              content: (
                <div className="space-y-2 text-xs text-zinc-400">
                  <p>确保微信已登录，右键脚本 → 以管理员身份运行：</p>
                  <code className="block px-3 py-2 rounded-lg text-xs font-mono text-zinc-300"
                    style={{ background: '#111', border: '1px solid #222' }}>
                    python wechat_importer.py
                  </code>
                  <p>脚本会自动：</p>
                  <ul className="space-y-1 pl-3">
                    {[
                      '自动检测微信数据目录',
                      '解密本地聊天数据库',
                      '显示联系人列表供选择',
                      '批量上传聊天记录到 CRM',
                    ].map((item, i) => (
                      <li key={i} className="flex gap-2 items-start">
                        <span className="text-green-400 flex-shrink-0">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            },
          ].map(({ step, title, color, content }) => (
            <div key={step} className="rounded-xl p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                  style={{ background: color }}>
                  {step}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-white mb-2">{title}</h3>
                  {content}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Realtime Monitor Tab */}
      {activeTab === 'realtime' && (
        <div className="space-y-3">
          {[
            {
              step: '1',
              title: '准备工作',
              color: '#3b82f6',
              content: (
                <div className="space-y-2 text-xs text-zinc-400">
                  <p>实时监控需要先完成以下准备：</p>
                  <ul className="space-y-1 pl-3">
                    <li className="flex gap-2 items-start">
                      <span className="text-blue-400 flex-shrink-0">•</span>
                      <span>安装 Python 和依赖（见批量导入步骤 1-2）</span>
                    </li>
                    <li className="flex gap-2 items-start">
                      <span className="text-blue-400 flex-shrink-0">•</span>
                      <span>获取微信数据库密钥（见批量导入步骤 3）</span>
                    </li>
                    <li className="flex gap-2 items-start">
                      <span className="text-blue-400 flex-shrink-0">•</span>
                      <span>确保 CRM 系统中配置了 <code className="text-zinc-300">MONITOR_API_KEY</code></span>
                    </li>
                  </ul>
                </div>
              ),
            },
            {
              step: '2',
              title: '配置监控参数',
              color: '#8b5cf6',
              content: (
                <div className="space-y-2 text-xs text-zinc-400">
                  <p>复制 <code className="text-zinc-300">config.example.env</code> 为 <code className="text-zinc-300">.env</code> 并填写：</p>
                  <code className="block px-3 py-2 rounded-lg text-xs font-mono text-zinc-300 whitespace-pre-wrap"
                    style={{ background: '#111', border: '1px solid #222' }}>
{`CRM_BASE_URL=http://localhost:3000
CRM_API_KEY=你的MONITOR_API_KEY
WECHAT_DATA_DIR=C:\\Users\\...\\WeChat Files
WECHAT_USER=你的微信文件夹名
WECHAT_DB_KEY=你的数据库密钥
POLL_INTERVAL=10`}
                  </code>
                </div>
              ),
            },
            {
              step: '3',
              title: '启动实时监控',
              color: '#10b981',
              content: (
                <div className="space-y-2 text-xs text-zinc-400">
                  <p>方式一：交互式启动（推荐首次使用）</p>
                  <code className="block px-3 py-2 rounded-lg text-xs font-mono text-zinc-300 mb-2"
                    style={{ background: '#111', border: '1px solid #222' }}>
                    python wechat_monitor.py
                  </code>
                  <p>方式二：后台守护进程模式</p>
                  <code className="block px-3 py-2 rounded-lg text-xs font-mono text-zinc-300"
                    style={{ background: '#111', border: '1px solid #222' }}>
                    python wechat_monitor.py --daemon
                  </code>
                  <p className="mt-2">监控运行时会：</p>
                  <ul className="space-y-1 pl-3">
                    {[
                      '每隔 10 秒检查微信新消息',
                      '自动识别联系人并同步到 CRM',
                      '支持断点续传，重启不丢消息',
                      '完全只读，不修改微信任何文件',
                    ].map((item, i) => (
                      <li key={i} className="flex gap-2 items-start">
                        <span className="text-green-400 flex-shrink-0">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            },
            {
              step: '4',
              title: '设置开机自启（可选）',
              color: '#f59e0b',
              content: (
                <div className="space-y-2 text-xs text-zinc-400">
                  <p>Windows 下设置开机自动启动监控：</p>
                  <ol className="space-y-1.5 pl-3 list-decimal list-inside">
                    <li>创建 <code className="text-zinc-300">start_monitor.bat</code> 文件</li>
                    <li>写入以下内容：</li>
                  </ol>
                  <code className="block px-3 py-2 rounded-lg text-xs font-mono text-zinc-300 mt-2"
                    style={{ background: '#111', border: '1px solid #222' }}>
{`@echo off
cd /d "D:\\path\\to\\wechat-importer"
python wechat_monitor.py --daemon`}
                  </code>
                  <p className="mt-2 text-zinc-500">将快捷方式放入「启动」文件夹即可开机自启</p>
                </div>
              ),
            },
          ].map(({ step, title, color, content }) => (
            <div key={step} className="rounded-xl p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                  style={{ background: color }}>
                  {step}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-white mb-2">{title}</h3>
                  {content}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Script location info */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-medium text-white mb-2">📁 脚本位置</h3>
        <code className="block px-3 py-2 rounded-lg text-xs font-mono text-zinc-300"
          style={{ background: '#111', border: '1px solid #222' }}>
          wechat-importer/
          <span className="text-zinc-500">
            {'\n'}  ├── wechat_importer.py    # 批量导入脚本
            {'\n'}  ├── wechat_monitor.py     # 实时监控脚本
            {'\n'}  ├── requirements.txt      # Python 依赖
            {'\n'}  ├── config.example.env    # 配置示例
            {'\n'}  └── wechat_key.txt        # 数据库密钥（需自行创建）
          </span>
        </code>
      </div>

      {/* Manual import alternative */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <h3 className="text-sm font-medium text-blue-400 mb-1">💡 也可以手动粘贴</h3>
        <p className="text-xs text-zinc-400">
          在微信中选中聊天内容复制，进入
          <a href="/customers" className="text-blue-400 hover:text-blue-300 mx-1">客户详情页</a>
          → 微信聊天记录 → 导入聊天，粘贴后 AI 自动提炼。
        </p>
      </div>
    </div>
  );
}
