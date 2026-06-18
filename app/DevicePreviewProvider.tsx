'use client';

import { createContext, useContext, useState, useEffect } from 'react';

type Device = 'desktop' | 'tablet' | 'mobile';

const DeviceContext = createContext<Device>('desktop');

export function useDevice() {
  const device = useContext(DeviceContext);
  return { device };
}

// 保留空壳，layout.tsx 里的 <DevicePreviewBar /> 不用改
export function DevicePreviewBar() {
  return null;
}

export function DevicePreviewWrapper({ children }: { children: React.ReactNode }) {
  const [device, setDevice] = useState<Device>('desktop');

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 768) setDevice('mobile');
      else if (w < 1024) setDevice('tablet');
      else setDevice('desktop');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const wrapperClass =
    device === 'mobile'
      ? 'px-3 py-4'
      : device === 'tablet'
      ? 'max-w-3xl mx-auto px-5 py-5'
      : 'max-w-6xl mx-auto px-4 sm:px-6 py-6';

  return (
    <DeviceContext.Provider value={device}>
      <div className={wrapperClass}>
        {children}
      </div>
    </DeviceContext.Provider>
  );
}

export function DevicePreviewProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
