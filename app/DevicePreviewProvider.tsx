'use client';

import { createContext, useContext, useState } from 'react';

type Device = 'desktop' | 'tablet' | 'mobile';

const DeviceContext = createContext<{
  device: Device;
  setDevice: (d: Device) => void;
}>({ device: 'desktop', setDevice: () => {} });

export function useDevice() { return useContext(DeviceContext); }

const DEVICES: { key: Device; label: string; icon: string; width: string }[] = [
  {
    key: 'desktop',
    label: '电脑',
    icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    width: 'w-full max-w-6xl',
  },
  {
    key: 'tablet',
    label: '平板',
    icon: 'M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    width: 'w-[768px]',
  },
  {
    key: 'mobile',
    label: '手机',
    icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
    width: 'w-[390px]',
  },
];

export function DevicePreviewBar() {
  const { device, setDevice } = useDevice();
  return (
    <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
      {DEVICES.map(d => (
        <button
          key={d.key}
          onClick={() => setDevice(d.key)}
          title={d.label}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            device === d.key
              ? 'bg-blue-600 text-white'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d.icon} />
          </svg>
          <span className="hidden sm:inline">{d.label}</span>
        </button>
      ))}
    </div>
  );
}

export function DevicePreviewWrapper({ children }: { children: React.ReactNode }) {
  const { device } = useDevice();
  const config = DEVICES.find(d => d.key === device)!;

  if (device === 'desktop') {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </div>
    );
  }

  return (
    <div className="flex justify-center py-6 px-4">
      <div
        className={`${config.width} min-h-[600px] bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl overflow-hidden flex flex-col`}
        style={{ maxWidth: device === 'mobile' ? 390 : 768 }}
      >
        {device === 'mobile' && (
          <div className="h-8 bg-zinc-800 flex items-center justify-center">
            <div className="w-20 h-1.5 bg-zinc-600 rounded-full" />
          </div>
        )}
        <div className={`flex-1 overflow-y-auto px-4 sm:px-6 py-5 ${device === 'mobile' ? 'px-3' : ''}`}>
          {children}
        </div>
        {device === 'mobile' && (
          <div className="h-6 bg-zinc-800 flex items-center justify-center">
            <div className="w-10 h-1 bg-zinc-600 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}

export function DevicePreviewProvider({ children }: { children: React.ReactNode }) {
  const [device, setDevice] = useState<Device>('desktop');
  return (
    <DeviceContext.Provider value={{ device, setDevice }}>
      {children}
    </DeviceContext.Provider>
  );
}
