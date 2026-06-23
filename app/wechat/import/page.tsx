'use client';

export default function WeChatImportGuide() {
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

      {/* Steps */}
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
            title: '下载导入脚本',
            color: '#8b5cf6',
            content: (
              <div className="space-y-2 text-xs text-zinc-400">
                <p>脚本已包含在项目中，路径：</p>
                <code className="block px-3 py-2 rounded-lg text-xs font-mono text-zinc-300"
                  style={{ background: '#111', border: '1px solid #222' }}>
                  D:\小象智能AI\CRM\wechat-importer\wechat_importer.py
                </code>
                <p className="text-zinc-500">或者在 CRM 项目根目录的 <code className="text-zinc-300">wechat-importer/</code> 文件夹</p>
              </div>
            ),
          },
          {
            step: '3',
            title: '安装依赖',
            color: '#f59e0b',
            content: (
              <div className="space-y-2 text-xs text-zinc-400">
                <p>以管理员身份打开命令提示符，运行：</p>
                <code className="block px-3 py-2 rounded-lg text-xs font-mono text-zinc-300"
                  style={{ background: '#111', border: '1px solid #222' }}>
                  pip install pymem pycryptodome requests
                </code>
              </div>
            ),
          },
          {
            step: '4',
            title: '确保微信已登录并运行脚本',
            color: '#10b981',
            content: (
              <div className="space-y-2 text-xs text-zinc-400">
                <p>右键脚本 → 以管理员身份运行，或在命令行执行：</p>
                <code className="block px-3 py-2 rounded-lg text-xs font-mono text-zinc-300"
                  style={{ background: '#111', border: '1px solid #222' }}>
                  python wechat_importer.py
                </code>
                <p>脚本会自动：</p>
                <ul className="space-y-1 pl-3">
                  {[
                    '从微信进程内存提取数据库密钥',
                    '解密本地聊天数据库',
                    '显示联系人列表供选择',
                    '上传聊天记录并 AI 分析',
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
            step: '5',
            title: '如果自动获取密钥失败',
            color: '#f97316',
            content: (
              <div className="space-y-2 text-xs text-zinc-400">
                <p>使用开源工具手动获取微信数据库密钥：</p>
                <ol className="space-y-1.5 pl-3 list-decimal list-inside">
                  <li>下载 WeChatMsg：<a href="https://github.com/LC044/WeChatMsg/releases" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">github.com/LC044/WeChatMsg ↗</a></li>
                  <li>运行后点击「获取信息」，复制密钥（Key）</li>
                  <li>将密钥保存到文件 <code className="text-zinc-300">wechat_key.txt</code>，放在微信数据目录旁</li>
                  <li>重新运行导入脚本</li>
                </ol>
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
