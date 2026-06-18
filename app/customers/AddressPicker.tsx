'use client';

import { useState, useEffect, useRef } from 'react';

declare global {
  interface Window { AMap: any; }
}

interface Suggestion {
  name: string;
  district: string;
  address: string;
  location: { lng: number; lat: number } | null;
}

interface Props {
  onSelect: (address: string) => void;
  onClose: () => void;
}

function loadScript(key: string, secCode?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.AMap) { resolve(); return; }
    if (secCode) (window as any)._AMapSecurityConfig = { securityJsCode: secCode };
    const s = document.createElement('script');
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.Geocoder,AMap.AutoComplete`;
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

export default function AddressPicker({ onSelect, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const autoRef = useRef<any>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const [ready, setReady] = useState(false);
  const [noKey, setNoKey] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');

  useEffect(() => {
    const key = localStorage.getItem('crm-amap-key') || '';
    if (!key) { setNoKey(true); return; }
    const sec = localStorage.getItem('crm-amap-security') || '';

    loadScript(key, sec).then(() => {
      window.AMap.plugin(['AMap.Geocoder', 'AMap.AutoComplete'], () => {
        if (!mapRef.current) return;

        const map = new window.AMap.Map(mapRef.current, {
          zoom: 12,
          center: [116.397, 39.916],
          mapStyle: 'amap://styles/dark',
        });
        mapInst.current = map;

        const geocoder = new window.AMap.Geocoder({ city: '全国' });
        geocoderRef.current = geocoder;

        const auto = new window.AMap.AutoComplete({ city: '全国' });
        autoRef.current = auto;

        const marker = new window.AMap.Marker({
          draggable: true,
          visible: false,
        });
        map.add(marker);
        markerRef.current = marker;

        const reverseGeocode = (lng: number, lat: number) => {
          geocoder.getAddress([lng, lat], (status: string, result: any) => {
            if (status === 'complete' && result.regeocode) {
              setSelectedAddress(result.regeocode.formattedAddress);
            }
          });
        };

        map.on('click', (e: any) => {
          const { lng, lat } = e.lnglat;
          marker.setPosition([lng, lat]);
          marker.show();
          reverseGeocode(lng, lat);
        });

        marker.on('dragend', (e: any) => {
          const pos = e.lnglat;
          reverseGeocode(pos.lng, pos.lat);
        });

        setReady(true);
      });
    }).catch(() => setNoKey(true));

    return () => {
      mapInst.current?.destroy();
      mapInst.current = null;
    };
  }, []);

  const handleSearch = (text: string) => {
    setSearchText(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) { setSuggestions([]); return; }
    searchTimer.current = setTimeout(() => {
      autoRef.current?.search(text, (status: string, result: any) => {
        if (status === 'complete') {
          setSuggestions(
            (result.tips as any[])
              .filter(t => t.location)
              .slice(0, 6)
              .map(t => ({ name: t.name, district: t.district || '', address: t.address || '', location: t.location }))
          );
        }
      });
    }, 300);
  };

  const selectSuggestion = (s: Suggestion) => {
    if (!s.location || !mapInst.current) return;
    const { lng, lat } = s.location;
    mapInst.current.setCenter([lng, lat]);
    mapInst.current.setZoom(16);
    markerRef.current?.setPosition([lng, lat]);
    markerRef.current?.show();
    const addr = [s.district, s.address, s.name].filter(Boolean).join('');
    setSelectedAddress(addr || s.name);
    setSuggestions([]);
    setSearchText(s.name);
  };

  const confirm = () => {
    if (selectedAddress) onSelect(selectedAddress);
  };

  if (noKey) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
        <div className="rounded-2xl p-6 max-w-sm w-full text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-sm mb-2" style={{ color: 'var(--text-primary)' }}>需要高德地图 API Key</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>请先在"地图"页面设置高德 API Key，然后再使用地图选点功能</p>
          <button onClick={onClose} className="px-6 py-2 rounded-xl text-sm text-white" style={{ background: 'var(--accent)' }}>关闭</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="flex-1 flex flex-col m-3 sm:m-8 sm:mx-auto sm:w-full sm:max-w-2xl rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>地图选点</span>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>

        {/* Search */}
        <div className="relative px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={searchText}
              onChange={e => handleSearch(e.target.value)}
              placeholder="搜索地址或地点名称"
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
          </div>
          {suggestions.length > 0 && (
            <div className="absolute top-full left-3 right-3 z-20 rounded-xl overflow-hidden shadow-2xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => selectSuggestion(s)}
                  className="w-full text-left px-4 py-2.5 transition-colors hover:bg-zinc-700"
                  style={{ borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.district}{s.address}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="relative flex-1 min-h-0">
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                地图加载中…
              </div>
            </div>
          )}
          {ready && !selectedAddress && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-xs pointer-events-none"
              style={{ background: 'rgba(0,0,0,0.6)', color: '#a1a1aa' }}>
              点击地图任意位置选取地址
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          {selectedAddress ? (
            <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl" style={{ background: 'var(--bg-inner)' }}>
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-xs flex-1" style={{ color: 'var(--text-primary)' }}>{selectedAddress}</p>
            </div>
          ) : (
            <p className="text-xs mb-3 text-center" style={{ color: 'var(--text-muted)' }}>搜索或点击地图选择位置</p>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm"
              style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>取消</button>
            <button onClick={confirm} disabled={!selectedAddress}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40"
              style={{ background: 'var(--accent)' }}>确认</button>
          </div>
        </div>
      </div>
    </div>
  );
}
