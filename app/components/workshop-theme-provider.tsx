'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type WorkshopThemeContextValue = {
  isLight: boolean;
  toggleTheme: () => void;
};

const WorkshopThemeContext = createContext<WorkshopThemeContextValue | null>(null);
const storageKey = 'royal-mechanics-theme';
const cookieKey = 'royal-mechanics-theme';

function persistTheme(isLight: boolean) {
  const value = isLight ? 'light' : 'dark';
  window.localStorage.setItem(storageKey, value);
  document.cookie = `${cookieKey}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.documentElement.dataset.workshopTheme = value;
}

export function WorkshopThemeProvider({
  initialLight,
  children,
}: {
  initialLight: boolean;
  children: ReactNode;
}) {
  const [isLight, setIsLight] = useState(initialLight);

  useEffect(() => {
    // The server-rendered cookie is authoritative on first paint. Local storage
    // mirrors it for client-only navigations and future preference migrations.
    persistTheme(isLight);
  }, [isLight]);

  const value = useMemo(
    () => ({
      isLight,
      toggleTheme: () => setIsLight((current) => !current),
    }),
    [isLight],
  );

  return (
    <WorkshopThemeContext.Provider value={value}>
      {children}
    </WorkshopThemeContext.Provider>
  );
}

export function useWorkshopTheme() {
  const value = useContext(WorkshopThemeContext);
  if (!value)
    throw new Error('useWorkshopTheme must be used within WorkshopThemeProvider.');
  return value;
}
