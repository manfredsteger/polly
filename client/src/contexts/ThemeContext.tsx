import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from './AuthContext';
import { useCustomization } from './CustomizationContext';
import type { ThemePreference } from '@shared/schema';

interface ThemeContextType {
  theme: ThemePreference;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: ThemePreference) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function getCookieTheme(): ThemePreference | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'theme_preference' && ['light', 'dark', 'system'].includes(value)) {
      return value as ThemePreference;
    }
  }
  return null;
}

function getLocalStorageTheme(): ThemePreference | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('theme');
  if (stored && ['light', 'dark', 'system'].includes(stored)) {
    return stored as ThemePreference;
  }
  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { customization, isLoading: isCustomizationLoading } = useCustomization();
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');
  const [themeResolved, setThemeResolved] = useState(false);

  const { data: themeData, isLoading: isThemeLoading } = useQuery<{ themePreference: ThemePreference; source: string }>({
    queryKey: ['/api/v1/theme'],
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = isThemeLoading && !themeResolved;

  const updateUserThemeMutation = useMutation({
    mutationFn: async (newTheme: ThemePreference) => {
      const response = await apiRequest('PUT', '/api/v1/user/theme', { themePreference: newTheme });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/theme'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/user/profile'] });
    },
  });

  const updateGuestThemeMutation = useMutation({
    mutationFn: async (newTheme: ThemePreference) => {
      const response = await apiRequest('POST', '/api/v1/theme', { themePreference: newTheme });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/theme'] });
    },
  });

  useEffect(() => {
    if (themeData?.themePreference) {
      setThemeState(themeData.themePreference);
      setThemeResolved(true);
      return;
    }
    
    if (!isThemeLoading) {
      const cookieTheme = getCookieTheme();
      if (cookieTheme) {
        setThemeState(cookieTheme);
        setThemeResolved(true);
        return;
      }
      
      const localStorageTheme = getLocalStorageTheme();
      if (localStorageTheme) {
        setThemeState(localStorageTheme);
        setThemeResolved(true);
        return;
      }
      
      if (customization?.theme?.defaultThemeMode) {
        setThemeState(customization.theme.defaultThemeMode as ThemePreference);
        setThemeResolved(true);
        return;
      }
      
      if (!isCustomizationLoading) {
        setThemeResolved(true);
      }
    }
  }, [themeData, customization, isThemeLoading, isCustomizationLoading]);

  useEffect(() => {
    const newEffectiveTheme = theme === 'system' ? getSystemTheme() : theme;
    setEffectiveTheme(newEffectiveTheme);

    const root = document.documentElement;
    if (newEffectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        const newEffectiveTheme = getSystemTheme();
        setEffectiveTheme(newEffectiveTheme);
        
        const root = document.documentElement;
        if (newEffectiveTheme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = useCallback((newTheme: ThemePreference) => {
    setThemeState(newTheme);
    
    if (user) {
      updateUserThemeMutation.mutate(newTheme);
    } else {
      updateGuestThemeMutation.mutate(newTheme);
    }
  }, [user, updateUserThemeMutation, updateGuestThemeMutation]);

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
