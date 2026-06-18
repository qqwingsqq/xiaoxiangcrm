'use client';

import { useState, useEffect, useRef } from 'react';
import { useDevice } from '../DevicePreviewProvider';

declare global {
  interface Window { AMap: any; _AMapSecurityConfig: any; }
}

interface Customer {
  id: number; name: string; type: string;
  address: string | null; contact_name: string | null;
  map_lat: number | null; map_lng: number | null;
}

interface GeoItem {
  customer: Customer;
  position: [number, number] | null;
  failed: boolean;
  manual: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  dealer: '#a855f7', terminal: '#10b981', partner: '#3b82f6', potential: '#f59e0b',
};
const TYPE_LABELS: Record<string, string> = {
  dealer: '经销商', terminal: '终端客户', partner: '合作伙伴', potential: '潜在客户',
};

function loadScript(key: string, secCode?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (secCode) window._AMapSecurityConfig = { securityJsCode: secCode };
    if (window.AMap) { resolve(); return; }
    const s = document.createElement('script');
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.Geocoder,AMap.Geolocation`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('script load failed'));
    document.head.appendChild(s);
  });
}

function buildInfoContent(c: Customer, color: string, label: string, manual: boolean, pos?: [number, number]) {
  const navUrl = pos
    ? `https://uri.amap.com/navigation?to=${pos[0]},${pos[1]},${encodeURIComponent(c.name)}&mode=car&src=xiaoxiangcrm`
    : c.address
    ? `https://uri.amap.com/navigation?to=&toname=${encodeURIComponent(c.name)}&toadd=${encodeURIComponent(c.address)}&mode=car&src=xiaoxiangcrm`
    : null;
  return `
    <div style="padding:10px 12px;background:#1e1e22;border:1px solid #3f3f46;border-radius:10px;min-width:180px;box-shadow:0 4px 16px rgba(0,0,0,0.5);font-family:-apple-system,'PingFang SC',sans-serif">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <span style="width:7px;height:7px;background:${color};flex-shrink:0;display:block;${manual ? 'border-radius:2px;transform:rotate(45deg)' : 'border-radius:50%'}"></span>
        <b style="font-size:13px;color:#f4f4f5">${c.name}</b>
        ${manual ? '<span style="font-size:10px;color:#71717a;margin-left:2px">手动</span>' : ''}
      </div>
      <p style="margin:0 0 3px;font-size:11px;color:#71717a">${label}</p>
      ${c.contact_name ? `<p style="margin:0 0 3px;font-size:11px;color:#a1a1aa">👤 ${c.contact_name}</p>` : ''}
      <p style="margin:0 0 8px;font-size:10px;color:#52525b">📍 ${c.address || '手动标记位置'}</p>
      <div style="display:flex;gap:6px">
        <a href="/customers/${c.id}" style="flex:1;text-align:center;font-size:11px;color:#60a5fa;text-decoration:none;padding:4px 6px;border:1px solid rgba(59,130,246,0.3);border-radius:6px">查看详情</a>
        ${navUrl ? `<a href="${navUrl}" target="_blank" rel="noopener noreferrer" style="flex:1;text-align:center;font-size:11px;color:#34d399;text-decoration:none;padding:4px 6px;border:1px solid rgba(52,211,153,0.3);border-radius:6px">去这里</a>` : ''}
      </div>
    </div>
  `;
}

function haversine(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 100) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

export default function MapPage() {
  const { device } = useDevice();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const markersRef = useRef<Map<number, any>>(new Map());
  const infoWinRef = useRef<any>(null);
  const markingModeRef = useRef(false);
  const myMarkerRef = useRef<any>(null);
  const targetIdRef = useRef<number | null>(null);

  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [secCode, setSecCode] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [secInput, setSecInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [filter, setFilter] = useState('all');
  const [mapBuilt, setMapBuilt] = useState(false);
  const [geoItems, setGeoItems] = useState<GeoItem[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
  const [markingMode, setMarkingMode] = useState(false);
  const [markingPos, setMarkingPos] = useState<[number, number] | null>(null);
  const [markingCustomerId, setMarkingCustomerId] = useState<number>(0);
  const [myLocation, setMyLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');

  const fetchCustomers = () => {
    fetch('/api/customers').then(r => r.json()).then((data: Customer[]) => {
      setAllCustomers(data);
      setCustomers(data.filter(c => (c.map_lat && c.map_lng) || c.address?.trim()));
    });
  };

  useEffect(() => {
    setApiKey(localStorage.getItem('crm-amap-key') || '');
    setSecCode(localStorage.getItem('crm-amap-security') || '');
    fetchCustomers();
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) targetIdRef.current = Number(id);
  }, []);

  useEffect(() => { markingModeRef.current = markingMode; }, [markingMode]);

  useEffect(() => {
    if (mapInst.current) setTimeout(() => mapInst.current?.resize?.(), 150);
  }, [device]);

  // ── Auto-fly: fires whenever geoItems updates, once target is geocoded ────
  useEffect(() => {
    if (!targetIdRef.current || !mapBuilt) return;
    const item = geoItems.find(i => i.customer.id === targetIdRef.current && i.position);
    if (!item?.position) return;
    const [lng, lat] = item.position;
    targetIdRef.current = null;
    setTimeout(() => {
      if (!mapInst.current) return;
      mapInst.current.resize();
      mapInst.current.setZoomAndCenter(15, [lng, lat], true); // immediately=true
      setActiveId(item.customer.id);
      if (infoWinRef.current) {
        const c = item.customer;
        infoWinRef.current.setContent(buildInfoContent(c, TYPE_COLORS[c.type] || '#6b7280', TYPE_LABELS[c.type] || c.type, item.manual, item.position!));
        infoWinRef.current.open(mapInst.current, [lng, lat]);
      }
    }, 300);
  }, [geoItems, mapBuilt]);

  // ── My location marker ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!myLocation || !mapInst.current || !window.AMap) return;
    if (!document.getElementById('my-loc-css')) {
      const s = document.createElement('style'); s.id = 'my-loc-css';
      s.textContent = '@keyframes my-loc-pulse{0%{box-shadow:0 0 0 0 rgba(59,130,246,.6)}70%{box-shadow:0 0 0 12px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}}';
      document.head.appendChild(s);
    }
    if (myMarkerRef.current) mapInst.current.remove(myMarkerRef.current);
    const marker = new window.AMap.Marker({
      position: myLocation,
      content: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;animation:my-loc-pulse 2s infinite;cursor:default"></div>`,
      offset: new window.AMap.Pixel(-8, -8),
      title: '我的位置', zIndex: 200,
    });
    myMarkerRef.current = marker;
    mapInst.current.add(marker);
    mapInst.current.setZoomAndCenter(13, myLocation);
  }, [myLocation]);

  const createMarker = (map: any, infoWin: any, c: Customer, lng: number, lat: number, manual: boolean) => {
    const color = TYPE_COLORS[c.type] || '#6b7280';
    const label = TYPE_LABELS[c.type] || c.type;
    const marker = new window.AMap.Marker({
      position: [lng, lat],
      content: manual
        ? `<div style="width:14px;height:14px;background:${color};border:2.5px solid rgba(255,255,255,0.9);border-radius:3px;transform:rotate(45deg);box-shadow:0 0 8px ${color}80;cursor:pointer"></div>`
        : `<div style="width:13px;height:13px;background:${color};border:2.5px solid rgba(255,255,255,0.85);border-radius:50%;box-shadow:0 0 8px ${color}80;cursor:pointer"></div>`,
      offset: manual ? new window.AMap.Pixel(-7, -7) : new window.AMap.Pixel(-6, -6),
      title: c.name, zIndex: 100,
    });
    markersRef.current.set(c.id, marker);
    marker.on('click', () => {
      if (markingModeRef.current) return;
      setActiveId(c.id);
      infoWin.setContent(buildInfoContent(c, color, label, manual, [lng, lat]));
      infoWin.open(map, [lng, lat]);
    });
    map.add(marker);
  };

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;
    let cancelled = false;

    const build = async () => {
      setLoading(true); setLoadError('');
      try { await loadScript(apiKey, secCode || undefined); }
      catch {
        if (!cancelled) { setLoadError('API Key 无效或网络错误，请检查'); setLoading(false); }
        return;
      }
      if (cancelled || !mapRef.current) return;
      if (mapInst.current) { mapInst.current.destroy(); mapInst.current = null; }
      markersRef.current.clear();

      const isLight = (() => {
        const t = localStorage.getItem('crm-theme') || 'dark';
        if (t === 'light') return true; if (t === 'dark') return false;
        return window.matchMedia('(prefers-color-scheme: light)').matches;
      })();

      const map = new window.AMap.Map(mapRef.current, {
        zoom: 5, center: [108.55, 34.32],
        mapStyle: isLight ? 'amap://styles/normal' : 'amap://styles/dark',
      });
      mapInst.current = map;
      map.on('click', (e: any) => { if (markingModeRef.current) setMarkingPos([e.lnglat.lng, e.lnglat.lat]); });
      setLoading(false); setMapBuilt(true);

      // Re-add my location marker if already set
      if (myLocation && window.AMap) {
        if (!document.getElementById('my-loc-css')) {
          const s = document.createElement('style'); s.id = 'my-loc-css';
          s.textContent = '@keyframes my-loc-pulse{0%{box-shadow:0 0 0 0 rgba(59,130,246,.6)}70%{box-shadow:0 0 0 12px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}}';
          document.head.appendChild(s);
        }
        const myMarker = new window.AMap.Marker({
          position: myLocation,
          content: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;animation:my-loc-pulse 2s infinite;cursor:default"></div>`,
          offset: new window.AMap.Pixel(-8, -8), title: '我的位置', zIndex: 200,
        });
        myMarkerRef.current = myMarker;
        map.add(myMarker);
      }

      const geocoder = new window.AMap.Geocoder({ city: '全国' });
      const infoWin = new window.AMap.InfoWindow({ isCustom: true, offset: new window.AMap.Pixel(0, -14) });
      infoWinRef.current = infoWin;

      const toShow = filter === 'all' ? customers : customers.filter(c => c.type === filter);
      if (!cancelled) { setGeoItems(toShow.map(c => ({ customer: c, position: null, failed: false, manual: false }))); setProgress({ done: 0, total: toShow.length }); }

      let doneCount = 0;
      toShow.forEach(c => {
        if (cancelled) return;
        if (c.map_lat && c.map_lng) {
          const lng = c.map_lng, lat = c.map_lat;
          doneCount++; setProgress({ done: doneCount, total: toShow.length });
          setGeoItems(prev => prev.map(i => i.customer.id === c.id ? { ...i, position: [lng, lat], manual: true } : i));
          createMarker(map, infoWin, c, lng, lat, true);
          return;
        }
        if (!c.address) {
          doneCount++; setProgress({ done: doneCount, total: toShow.length });
          setGeoItems(prev => prev.map(i => i.customer.id === c.id ? { ...i, failed: true } : i));
          return;
        }
        geocoder.getLocation(c.address, (status: string, result: any) => {
          if (cancelled) return;
          doneCount++; setProgress({ done: doneCount, total: toShow.length });
          if (status !== 'complete' || !result.geocodes?.length) {
            setGeoItems(prev => prev.map(i => i.customer.id === c.id ? { ...i, failed: true } : i));
            return;
          }
          const { lng, lat } = result.geocodes[0].location;
          setGeoItems(prev => prev.map(i => i.customer.id === c.id ? { ...i, position: [lng, lat] as [number, number] } : i));
          createMarker(map, infoWin, c, lng, lat, false);
        });
      });
    };

    build();
    return () => {
      cancelled = true; markersRef.current.clear();
      mapInst.current?.destroy(); mapInst.current = null;
      infoWinRef.current = null; myMarkerRef.current = null;
      setMapBuilt(false); setGeoItems([]);
    };
  }, [apiKey, secCode, filter, customers]);

  const locateMe = () => {
    if (!window.AMap) { setLocateError('地图未加载，请稍候再试'); return; }
    setLocating(true); setLocateError('');
    // Use AMap.Geolocation: returns GCJ02 coords (matches map), IP fallback in China
    window.AMap.plugin('AMap.Geolocation', () => {
      const geo = new window.AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
        GeoLocationFirst: false,
      });
      geo.getCurrentPosition((status: string, result: any) => {
        setLocating(false);
        if (status === 'complete' && result.position) {
          setMyLocation([result.position.lng, result.position.lat]);
        } else {
          // Fallback to browser geolocation
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              pos => setMyLocation([pos.coords.longitude, pos.coords.latitude]),
              () => setLocateError('定位失败，请检查位置权限设置'),
              { timeout: 8000 }
            );
          } else {
            setLocateError('定位失败：' + (result.message || '请检查位置权限'));
          }
        }
      });
    });
  };

  const flyTo = (item: GeoItem) => {
    if (!item.position || !mapInst.current) return;
    const [lng, lat] = item.position;
    const map = mapInst.current;
    setActiveId(item.customer.id);
    setActiveTab('map');
    const doFly = () => {
      map.setZoomAndCenter(15, [lng, lat], true); // immediately=true: no animation conflict
      if (infoWinRef.current) {
        const c = item.customer;
        infoWinRef.current.setContent(buildInfoContent(c, TYPE_COLORS[c.type] || '#6b7280', TYPE_LABELS[c.type] || c.type, item.manual, item.position!));
        infoWinRef.current.open(map, [lng, lat]);
      }
    };
    if (device === 'mobile') {
      // Mobile: wait for tab-switch to make map visible before resize+fly
      setTimeout(() => { map.resize(); doFly(); }, 120);
    } else {
      doFly();
    }
  };

  const toggleMarkingMode = () => {
    const next = !markingMode;
    setMarkingMode(next); markingModeRef.current = next;
    if (!next) { setMarkingPos(null); setMarkingCustomerId(0); }
  };

  const confirmManualMark = async () => {
    if (!markingPos || !markingCustomerId) return;
    const [lng, lat] = markingPos;
    await fetch(`/api/customers/${markingCustomerId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ map_lat: lat, map_lng: lng }),
    });
    setMarkingPos(null); setMarkingCustomerId(0);
    setMarkingMode(false); markingModeRef.current = false;
    fetchCustomers();
  };

  const clearManualMark = async (customerId: number) => {
    await fetch(`/api/customers/${customerId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ map_lat: null, map_lng: null }),
    });
    fetchCustomers();
  };

  const saveKey = () => {
    const k = keyInput.trim(), s = secInput.trim();
    if (!k) return;
    localStorage.setItem('crm-amap-key', k);
    if (s) localStorage.setItem('crm-amap-security', s);
    setApiKey(k); setSecCode(s); setKeyInput(''); setSecInput('');
  };

  const isMobile = device === 'mobile';
  const mapH = isMobile ? 260 : device === 'tablet' ? 460 : 560;
  const listH = isMobile ? 360 : mapH;
  const typeCounts = customers.reduce((acc, c) => { acc[c.type] = (acc[c.type] || 0) + 1; return acc; }, {} as Record<string, number>);

  const filteredGeoItems = geoItems.filter(item =>
    !listSearch || item.customer.name.includes(listSearch) || (item.customer.address || '').includes(listSearch)
  );

  // Sort by distance from my location, fallback to original order
  const sortedGeoItems = myLocation
    ? [...filteredGeoItems].sort((a, b) => {
        if (!a.position && !b.position) return 0;
        if (!a.position) return 1; if (!b.position) return -1;
        return haversine(myLocation[0], myLocation[1], a.position[0], a.position[1])
          - haversine(myLocation[0], myLocation[1], b.position[0], b.position[1]);
      })
    : filteredGeoItems;

  // ── Setup ──────────────────────────────────────────────────────────────────
  if (!apiKey) {
    return (
      <div className="max-w-md mx-auto py-10 px-4">
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <svg className="w-7 h-7" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>配置高德地图 API</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>免费注册，地址标注需要安全密钥</p>
        </div>
        <div className="rounded-2xl p-4 mb-4 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>申请步骤</p>
          {['打开 lbs.amap.com 注册/登录', '控制台 → 应用管理 → 创建应用', '添加 Key，平台选 Web端（JS API）', '在 Key 详情页复制 API Key 和安全密钥'].map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold"
                style={{ background: 'var(--accent)', color: '#fff' }}>{i + 1}</span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{step}</span>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>API Key <span className="text-red-400">*</span></label>
            <input value={keyInput} onChange={e => setKeyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveKey()}
              placeholder="粘贴高德 JS API Key" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
              安全密钥 <span style={{ color: 'var(--text-muted)' }}>（地理编码必填，Key 详情页可查）</span>
            </label>
            <input value={secInput} onChange={e => setSecInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveKey()}
              placeholder="粘贴安全密钥（securityJsCode）" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <button onClick={saveKey} disabled={!keyInput.trim()} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: 'var(--accent)' }}>保存并加载地图</button>
        </div>
        <p className="text-xs text-center mt-3" style={{ color: 'var(--text-muted)' }}>Key 仅保存在本设备，不上传服务器</p>
      </div>
    );
  }

  // ── Map ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>客户地图</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {customers.length} 个客户
              {progress.total > 0 && progress.done < progress.total ? ` · 标注中 ${progress.done}/${progress.total}` : ''}
            </p>
          </div>

          {/* 我的位置 */}
          <button onClick={locateMe} disabled={locating}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: myLocation ? 'rgba(59,130,246,0.15)' : 'var(--bg-card)',
              border: `1px solid ${myLocation ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`,
              color: myLocation ? '#60a5fa' : 'var(--text-secondary)',
            }}>
            {locating
              ? <div style={{ width: '12px', height: '12px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              : <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            }
            {myLocation ? '已定位' : '我的位置'}
          </button>

          {/* 手动标记 */}
          <button onClick={toggleMarkingMode}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: markingMode ? 'rgba(239,68,68,0.15)' : 'var(--bg-card)',
              border: `1px solid ${markingMode ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
              color: markingMode ? '#f87171' : 'var(--text-secondary)',
            }}>
            <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3m2 4H1m18 0h2M5 16H3m2-4H1" />
            </svg>
            {markingMode ? '取消' : '手动标记'}
          </button>

          <button onClick={fetchCustomers}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
        </div>

        {/* Type filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {[{ key: 'all', label: '全部', color: 'var(--accent)' },
            ...Object.entries(TYPE_LABELS).map(([k, l]) => ({ key: k, label: l, color: TYPE_COLORS[k] }))
          ].map(opt => (
            <button key={opt.key} onClick={() => setFilter(opt.key)}
              className="text-xs px-2.5 py-1 rounded-lg"
              style={{
                background: filter === opt.key ? opt.color + '22' : 'var(--bg-card)',
                border: `1px solid ${filter === opt.key ? opt.color + '55' : 'var(--border)'}`,
                color: filter === opt.key ? opt.color : 'var(--text-secondary)',
              }}>
              {opt.label}{opt.key !== 'all' && typeCounts[opt.key] ? ` ${typeCounts[opt.key]}` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {markingMode && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          手动标记模式：点击地图任意位置，然后选择要绑定的客户
        </div>
      )}
      {locateError && (
        <div className="px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {locateError}
        </div>
      )}

      {/* Mobile tabs */}
      {isMobile && (
        <div style={{ display: 'flex', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          {(['map', 'list'] as const).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'map') setTimeout(() => mapInst.current?.resize?.(), 80); }}
              style={{ flex: 1, padding: '8px 0', fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer',
                background: activeTab === tab ? 'var(--accent)' : 'var(--bg-card)',
                color: activeTab === tab ? '#fff' : 'var(--text-muted)' }}>
              {tab === 'map' ? '地图' : `列表 (${sortedGeoItems.length})`}
            </button>
          ))}
        </div>
      )}

      {/* Map + List */}
      <div style={{ display: 'flex', gap: '12px', flexDirection: isMobile ? 'column' : 'row', alignItems: 'flex-start' }}>

        {/* Map */}
        <div style={{
          position: 'relative', borderRadius: '16px', overflow: 'hidden',
          flex: isMobile ? undefined : '1 1 0%', minWidth: 0,
          width: isMobile ? '100%' : undefined, height: mapH,
          border: '1px solid var(--border)', cursor: markingMode ? 'crosshair' : 'default',
          display: isMobile && activeTab === 'list' ? 'none' : 'block',
        }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderRadius: '12px', background: 'rgba(10,10,14,0.9)', border: '1px solid #3f3f46', color: '#fff', fontSize: '13px' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                地图加载中…
              </div>
            </div>
          )}
          {!loading && loadError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '16px', background: 'var(--bg-base)' }}>
              <p style={{ fontSize: '13px', color: '#f87171', textAlign: 'center' }}>{loadError}</p>
              <button onClick={() => { localStorage.removeItem('crm-amap-key'); localStorage.removeItem('crm-amap-security'); setApiKey(''); setSecCode(''); }}
                style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                重新设置
              </button>
            </div>
          )}
          {!loading && mapBuilt && customers.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ padding: '8px 14px', borderRadius: '12px', background: 'rgba(0,0,0,0.6)', color: '#a1a1aa', fontSize: '12px' }}>
                暂无客户地址，请填写地址或使用手动标记
              </div>
            </div>
          )}
        </div>

        {/* Customer list */}
        <div style={{
          flexShrink: 0, width: isMobile ? '100%' : '256px', height: listH,
          border: '1px solid var(--border)', background: 'var(--bg-card)',
          borderRadius: '16px', overflow: 'hidden',
          display: isMobile && activeTab === 'map' ? 'none' : 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              客户列表
              {myLocation && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#60a5fa', fontWeight: 400 }}>按距离排序</span>}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sortedGeoItems.filter(i => i.position).length}/{sortedGeoItems.length} 已标注</span>
          </div>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text-muted)', pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="搜索客户…"
                style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '30px', paddingRight: '8px', paddingTop: '6px', paddingBottom: '6px', borderRadius: '8px', fontSize: '12px', outline: 'none', background: 'var(--bg-inner)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sortedGeoItems.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '16px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {customers.length === 0 ? '暂无客户地址' : '未找到匹配客户'}
                </p>
              </div>
            )}
            {sortedGeoItems.map(item => {
              const color = TYPE_COLORS[item.customer.type] || '#6b7280';
              const isActive = activeId === item.customer.id;
              const canFly = !!item.position;
              const dist = myLocation && item.position
                ? haversine(myLocation[0], myLocation[1], item.position[0], item.position[1])
                : null;
              const itemNavUrl = item.position
                ? `https://uri.amap.com/navigation?to=${item.position[0]},${item.position[1]},${encodeURIComponent(item.customer.name)}&mode=car&src=xiaoxiangcrm`
                : item.customer.address
                ? `https://uri.amap.com/navigation?to=&toname=${encodeURIComponent(item.customer.name)}&toadd=${encodeURIComponent(item.customer.address)}&mode=car&src=xiaoxiangcrm`
                : null;
              return (
                <div key={item.customer.id} style={{
                  background: isActive ? `${color}18` : 'transparent',
                  borderBottom: '1px solid var(--border)',
                  borderLeft: `2px solid ${isActive ? color : 'transparent'}`,
                }}>
                  {/* Main row: click to fly */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '12px', paddingRight: '8px' }}>
                    <button onClick={() => flyTo(item)} disabled={!canFly}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, paddingTop: '8px', paddingBottom: '3px', background: 'none', border: 'none', cursor: canFly ? 'pointer' : 'default', textAlign: 'left', minWidth: 0 }}>
                      <div style={{ width: '8px', height: '8px', flexShrink: 0, background: canFly ? color : 'var(--border)', borderRadius: item.manual ? '2px' : '50%', transform: item.manual ? 'rotate(45deg)' : 'none' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: canFly ? 'var(--text-primary)' : 'var(--text-muted)', marginBottom: '1px' }}>
                          {item.customer.name}
                          {item.manual && <span style={{ marginLeft: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>手动</span>}
                        </p>
                        <p style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                          {TYPE_LABELS[item.customer.type] || item.customer.type}
                          {dist !== null && <span style={{ marginLeft: '6px', color: '#60a5fa' }}>{formatDist(dist)}</span>}
                        </p>
                      </div>
                      {item.failed ? (
                        <span style={{ fontSize: '11px', flexShrink: 0, color: 'var(--text-muted)' }}>未找到</span>
                      ) : !item.position ? (
                        <div style={{ width: '12px', height: '12px', flexShrink: 0, border: '2px solid #52525b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      ) : null}
                    </button>
                    {item.manual && (
                      <button onClick={() => clearManualMark(item.customer.id)} title="清除手动标记"
                        style={{ flexShrink: 0, width: '20px', height: '20px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '5px', paddingLeft: '28px', paddingRight: '8px', paddingBottom: '7px' }}>
                    <a href={`/customers/${item.customer.id}`}
                       style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '5px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa', textDecoration: 'none' }}>
                      查看详情
                    </a>
                    {itemNavUrl && (
                      <a href={itemNavUrl} target="_blank" rel="noopener noreferrer"
                         style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '5px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399', textDecoration: 'none' }}>
                        去这里
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingLeft: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', border: '2px solid white' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>我的位置</span>
          </div>
          {Object.entries(TYPE_LABELS).map(([k, l]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: TYPE_COLORS[k] }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l}</span>
            </div>
          ))}
        </div>
        <button onClick={() => { localStorage.removeItem('crm-amap-key'); localStorage.removeItem('crm-amap-security'); setApiKey(''); setSecCode(''); }}
          style={{ fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>更换 Key</button>
      </div>

      {/* Manual marking dialog */}
      {markingPos && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.6)' }}>
          <div style={{ width: '100%', maxWidth: '400px', borderRadius: '20px', padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>手动标记位置</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              坐标：{markingPos[1].toFixed(5)}, {markingPos[0].toFixed(5)}
            </p>
            <select value={markingCustomerId} onChange={e => setMarkingCustomerId(Number(e.target.value))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', fontSize: '13px', outline: 'none', marginBottom: '14px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value={0}>— 请选择要标记的客户 —</option>
              {allCustomers.map(c => (
                <option key={c.id} value={c.id}>{c.name}（{TYPE_LABELS[c.type] || c.type}）{c.map_lat ? ' [已有标记]' : ''}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setMarkingPos(null); setMarkingCustomerId(0); }}
                style={{ flex: 1, padding: '10px 0', borderRadius: '12px', fontSize: '13px', background: 'var(--bg-input)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>取消</button>
              <button onClick={confirmManualMark} disabled={!markingCustomerId}
                style={{ flex: 1, padding: '10px 0', borderRadius: '12px', fontSize: '13px', fontWeight: 500, background: 'var(--accent)', border: 'none', color: '#fff', cursor: markingCustomerId ? 'pointer' : 'default', opacity: markingCustomerId ? 1 : 0.4 }}>确认标记</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
