'use client';

export default function NavButton({ name, address }: { name: string; address: string }) {
  const url = `https://uri.amap.com/navigation?to=&toname=${encodeURIComponent(name)}&toadd=${encodeURIComponent(address)}&mode=car&callnative=1&src=xiaoxiangcrm`;
  return (
    <button
      onClick={() => { try { window.open(url, '_system'); } catch { window.open(url, '_blank'); } }}
      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md flex-shrink-0 transition-colors"
      style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399', cursor: 'pointer' }}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
      去这里
    </button>
  );
}
