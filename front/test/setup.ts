import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom does not implement window.matchMedia, but ThemeProvider reads it on mount.
// Guard with `typeof window` so tests running in the "node" environment are unaffected.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

afterEach(() => {
  cleanup();
});
