'use client';

import { createContext, useContext, useState, useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
type Device = 'desktop' | 'tablet' | 'mobile';

const DeviceContext = createContext<Device>('desktop');

export function useDevice() {
  const device = useContext(DeviceContext);
  return { device };
}

export function DevicePreviewBar() {
  return null;
}

function getSnapshot(): number {
  if (typeof window === 'undefined') return 1024;
  return window.innerWidth;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

function getDevice(width: number): Device {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export function DevicePreviewWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/login') {
    return <>{children}</>;
  }

  const windowWidth = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => 1024
  );

  const device = getDevice(windowWidth);

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
