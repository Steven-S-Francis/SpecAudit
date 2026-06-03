import { useCallback, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('specaudit-theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // localStorage unavailable (SSR, privacy mode)
    }
    // Respect OS-level preference before defaulting to dark
    try {
      if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    } catch {
      // matchMedia unavailable (SSR, older browsers)
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    try {
      localStorage.setItem('specaudit-theme', theme);
    } catch {
      // localStorage unavailable
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, toggle };
}
