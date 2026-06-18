'use client';

import { useState, useEffect, useRef } from 'react';
import { useDevice } from '../DevicePreviewProvider';

declare global {
  interface Window { AMap: any; }
}

interface Customer {
  id: number;
  name: string;
  type: string;
  address: string | null;
  contact_name: string | null;
}

interface GeoItem {
  customer: Customer;
  position: [number, number] | null;
  failed: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  dealer: '#a855f7', terminal: '#10b981', partner: '#3b82f6', potential: '#f59e0b',
};
const TYPE_LABELS: Record<string, string> = {
  dealer: '经销商', terminal: '终端客户', partner: '合作伙伴', potential: '潜在客户',
};

function loadScript(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.AMap) { resolve(); return; }
    const s = document.createElement('script');
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.Geocoder`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('load failed'));
    document.head.appendChild(s);
  });
}

function buildInfoContent(c: Customer, color: string, label: string) {
  return `
    <div style="padding:10px 12px;background:#1e1e22;border:1px solid #3f3f46;border-radius:10px;min-width:180px;box-shadow:0 4px 16px rgba(0,0,0,0.5);font-family:-apple-system,'PingFang SC',sans-serif">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <span style="width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0;display:block"></span>
        <b style="font-size:13px;color:#f4f4f5">${c.name}</b>
      </div>
      <p style="margin:0 0 3px;font-size:11px;color:#71717a">${label}</p>
      ${c.contact_name ? `<p style="margin:0 0 3px;font-size:11px;color:#a1a1aa">👤 ${c.contact_name}</p>` : ''}
      <p style="margin:0 0 8px;font-size:10px;color:#52525b">📍 ${c.address || ''}</p>
      <a href="/customers/${c.id}" style="font-size:12px;color:#3b82f6;text-decoration:none">查看详情 →</a>
    </div>
  `;
}

export default function MapPage() {
  const { device } = useDevice();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const markersRef = useRef<Map<number, any>>(new Map());
  const infoWinRef = useRef<any>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [filter, setFilter] = useState('all');
  const [mapBuilt, setMapBuilt] = useState(false);
  const [geoItems, setGeoItems] = useState<GeoItem[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [listSearch, setListSearch] = useState('');

  const fetchCustomers = () => {
    fetch('/api/customers')
      .then(r => r.json())
      .then((data: Customer[]) => setCustomers(data.filter(c => c.address?.trim())));
  };

  useEffect(() => {
    setApiKey(localStorage.getItem('crm-amap-key') || '');
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;
    let cancelled = false;

    const build = async () => {
      setLoading(true);
      setLoadError('');
      try {
        await loadScript(apiKey);
      } catch {
        if (!cancelled) {
          setLoadError('API Key 无效或网络错误，请检查后重试');
          setLoading(false);
        }
        return;
      }
      if (cancelled || !mapRef.current) return;

      if (mapInst.current) { mapInst.current.destroy(); mapInst.current = null; }
      markersRef.current.clear();

      const isLight = (() => {
        const t = localStorage.getItem('crm-theme') || 'dark';
        if (t === 'light') return true;
        if (t === 'dark') return false;
        return window.matchMedia('(prefers-color-scheme: light)').matches;
      })();

      const map = new window.AMap.Map(mapRef.current, {
        zoom: 5,
        center: [108.55, 34.32],
        mapStyle: isLight ? 'amap://styles/normal' : 'amap://styles/dark',
      });
      mapInst.current = map;
      setLoading(false);
      setMapBuilt(true);

      const geocoder = new window.AMap.Geocoder({ city: '全国' });
      const infoWin = new window.AMap.InfoWindow({ isCustom: true, offset: new window.AMap.Pixel(0, -14) });
      infoWinRef.current = infoWin;

      const toShow = filter === 'all' ? customers : customers.filter(c => c.type === filter);
      if (!cancelled) {
        setGeoItems(toShow.map(c => ({ customer: c, position: null, failed: false })));
        setProgress({ done: 0, total: toShow.length });
      }

      let doneCount = 0;
      toShow.forEach(c => {
        if (!c.address || cancelled) return;
        geocoder.getLocation(c.address, (status: string, result: any) => {
          if (cancelled) return;
          doneCount++;
          setProgress({ done: doneCount, total: toShow.length });

          if (status !== 'complete' || !result.geocodes?.length) {
            setGeoItems(prev => prev.map(item =>
              item.customer.id === c.id ? { ...item, failed: true } : item
            ));
            return;
          }

          const { lng, lat } = result.geocodes[0].location;
          const color = TYPE_COLORS[c.type] || '#6b7280';
          const label = TYPE_LABELS[c.type] || c.type;

          setGeoItems(prev => prev.map(item =>
            item.customer.id === c.id ? { ...item, position: [lng, lat] as [number, number] } : item
          ));

          const marker = new window.AMap.Marker({
            position: [lng, lat],
            content: `<div style="width:13px;height:13px;background:${color};border:2.5px solid rgba(255,255,255,0.85);border-radius:50%;box-shadow:0 0 8px ${color}80;cursor:pointer"></div>`,
            offset: new window.AMap.Pixel(-6, -6),
            title: c.name,
            zIndex: 100,
          });

          markersRef.current.set(c.id, marker);

          marker.on('click', () => {
            setActiveId(c.id);
            infoWin.setContent(buildInfoContent(c, color, label));
            infoWin.open(map, [lng, lat]);
          });

          map.add(marker);
        });
      });
    };

    build();
    return () => {
      cancelled = true;
      markersRef.current.clear();
      mapInst.current?.destroy();
      mapInst.current = null;
      infoWinRef.current = null;
      setMapBuilt(false);
      setGeoItems([]);
    };
  }, [apiKey, filter, customers]);

  const flyTo = (item: GeoItem) => {
    if (!item.position || !mapInst.current) return;
    const [lng, lat] = item.position;
    setActiveId(item.customer.id);
    mapInst.current.setZoom(15);
    mapInst.current.panTo([lng, lat]);
    if (infoWinRef.current) {
      const c = item.customer;
      const color = TYPE_COLORS[c.type] || '#6b7280';
      const label = TYPE_LABELS[c.type] || c.type;
      infoWinRef.current.setContent(buildInfoContent(c, color, label));
      infoWinRef.current.open(mapInst.current, [lng, lat]);
    }
  };

  const saveKey = () => {
    const k = keyInput.trim();
    if (!k) return;
    localStorage.setItem('crm-amap-key', k);
    setApiKey(k);
    setKeyInput('');
  };

  const mapH = device === 'mobile' ? 350 : device === 'tablet' ? 500 : 600;
  const listH = device === 'mobile' ? 200 : mapH;
  const isMobile = device === 'mobile';

  const filteredGeoItems = geoItems.filter(item =>
    !listSearch ||
    item.customer.name.includes(listSearch) ||
    (item.customer.address || '').includes(listSearch)
  );

  // ── Setup screen ─────────────────────────────────────
  if (!apiKey) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <svg className="w-8 h-8" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>使用高德地图需要 API Key</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>免费注册，每天 200 万次调用</p>
        </div>

        <div className="rounded-2xl p-5 mb-4 space-y-2.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>申请步骤</p>
          {[
            '打开 lbs.amap.com 注册/登录',
            '进入"控制台" → "应用管理" → "创建新应用"',
            '添加 Key，服务平台选 Web端（JS API）',
            '复制 Key 粘贴到下方',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold"
                style={{ background: 'var(--accent)', color: '#fff' }}>{i + 1}</span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{step}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <input
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveKey()}
            placeholder="粘贴高德 JS API Key"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <button
            onClick={saveKey}
            disabled={!keyInput.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            保存并加载地图
          </button>
        </div>
        <p className="text-xs text-center mt-3" style={{ color: 'var(--text-muted)' }}>Key 仅保存在本设备，不上传服务器</p>
      </div>
    );
  }

  // ── Map screen ───────────────────────────────────────
  const typeCounts = customers.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-3">
      {/* Header + filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>客户地图</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {customers.length} 个客户有地址
              {progress.total > 0 && progress.done < progress.total
                ? ` · 标注中 ${progress.done}/${progress.total}` : ''}
            </p>
          </div>
          <button onClick={fetchCustomers}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[{ key: 'all', label: '全部', color: 'var(--accent)' },
            ...Object.entries(TYPE_LABELS).map(([k, l]) => ({ key: k, label: l, color: TYPE_COLORS[k] }))
          ].map(opt => (
            <button key={opt.key} onClick={() => setFilter(opt.key)}
              className="text-xs px-2.5 py-1 rounded-lg transition-colors"
              style={{
                background: filter === opt.key ? opt.color + '22' : 'var(--bg-card)',
                border: `1px solid ${filter === opt.key ? opt.color + '55' : 'var(--border)'}`,
                color: filter === opt.key ? opt.color : 'var(--text-secondary)',
              }}>
              {opt.label}
              {opt.key !== 'all' && typeCounts[opt.key] ? ` ${typeCounts[opt.key]}` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Map + List */}
      <div className={`flex gap-3 ${isMobile ? 'flex-col' : 'flex-row items-start'}`}>

        {/* Map */}
        <div className="relative rounded-2xl overflow-hidden flex-1"
          style={{ height: mapH, border: '1px solid var(--border)', minWidth: 0 }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm text-white"
                style={{ background: 'rgba(10,10,14,0.85)', border: '1px solid #3f3f46' }}>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                地图加载中…
              </div>
            </div>
          )}

          {!loading && loadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4"
              style={{ background: 'var(--bg-base)' }}>
              <p className="text-sm text-red-400 text-center">{loadError}</p>
              <button
                onClick={() => { localStorage.removeItem('crm-amap-key'); setApiKey(''); }}
                className="text-xs px-4 py-2 rounded-lg"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                重新设置 Key
              </button>
            </div>
          )}

          {!loading && mapBuilt && customers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="px-4 py-2 rounded-xl text-xs" style={{ background: 'rgba(0,0,0,0.6)', color: '#a1a1aa' }}>
                暂无客户地址，请先填写客户地址
              </div>
            </div>
          )}
        </div>

        {/* Customer list sidebar */}
        <div className="flex flex-col rounded-2xl overflow-hidden flex-shrink-0"
          style={{
            width: isMobile ? '100%' : '256px',
            height: listH,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
          }}>
          {/* List header */}
          <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>客户列表</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {filteredGeoItems.filter(i => i.position).length}/{filteredGeoItems.length} 已标注
            </span>
          </div>

          {/* Search */}
          <div className="px-2 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder="搜索客户…"
                className="w-full pl-8 pr-2 py-1.5 rounded-lg text-xs outline-none"
                style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto">
            {filteredGeoItems.length === 0 && (
              <div className="flex items-center justify-center h-full px-4">
                <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  {customers.length === 0 ? '暂无客户地址' : '未找到匹配客户'}
                </p>
              </div>
            )}
            {filteredGeoItems.map(item => {
              const color = TYPE_COLORS[item.customer.type] || '#6b7280';
              const isActive = activeId === item.customer.id;
              const canFly = !!item.position;
              return (
                <button
                  key={item.customer.id}
                  onClick={() => flyTo(item)}
                  disabled={!canFly}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors disabled:cursor-default"
                  style={{
                    background: isActive ? `${color}18` : 'transparent',
                    borderBottom: '1px solid var(--border)',
                    borderLeft: isActive ? `2px solid ${color}` : '2px solid transparent',
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: canFly ? color : 'var(--border)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate"
                      style={{ color: canFly ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {item.customer.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {TYPE_LABELS[item.customer.type] || item.customer.type}
                    </p>
                  </div>
                  {item.failed ? (
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>未找到</span>
                  ) : !item.position ? (
                    <div className="w-3 h-3 border border-zinc-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  ) : (
                    <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isActive ? color : 'var(--text-muted)' }}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend + key */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-0.5">
        <div className="flex items-center gap-4 flex-wrap">
          {Object.entries(TYPE_LABELS).map(([k, l]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full border border-white/40" style={{ background: TYPE_COLORS[k] }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{l}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => { localStorage.removeItem('crm-amap-key'); setApiKey(''); }}
          className="text-xs"
          style={{ color: 'var(--text-muted)' }}>
          更换 Key
        </button>
      </div>
    </div>
  );
}
