'use client';

import { useEffect } from 'react';

export default function PwaBoot() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

    if (process.env.NODE_ENV !== 'production' || isLocalHost) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => undefined);
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch {
        // Non-fatal: app should continue even if service worker registration fails.
      }
    };

    register();
  }, []);

  return null;
}
