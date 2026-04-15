import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'focusflow-theme';

const getSystemTheme = () =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export function useTheme() {
  const [mode, setMode] = useState(() => localStorage.getItem(STORAGE_KEY) || 'system');

  const effectiveTheme = useMemo(() => (mode === 'system' ? getSystemTheme() : mode), [mode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', effectiveTheme === 'dark');

    if (mode !== 'system') return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      root.classList.toggle('dark', mediaQuery.matches);
    };
    mediaQuery.addEventListener('change', listener);

    return () => mediaQuery.removeEventListener('change', listener);
  }, [mode, effectiveTheme]);

  return { mode, setMode, effectiveTheme };
}
