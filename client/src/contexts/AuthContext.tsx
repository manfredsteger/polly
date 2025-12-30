import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { User } from '@shared/schema';

type SafeUser = Omit<User, 'passwordHash'>;

interface AuthContextType {
  user: SafeUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  isAuthMethodsLoading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<SafeUser>;
  register: (username: string, email: string, name: string, password: string) => Promise<SafeUser>;
  logout: () => Promise<void>;
  authMethods: { local: boolean; keycloak: boolean; registrationEnabled: boolean };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const previousUserIdRef = useRef<number | null | undefined>(undefined);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const { data: authData, isLoading, isFetched } = useQuery<{ user: SafeUser | null }>({
    queryKey: ['/api/v1/auth/me'],
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const { data: methods, isLoading: isAuthMethodsLoading } = useQuery<{ local: boolean; keycloak: boolean; registrationEnabled: boolean }>({
    queryKey: ['/api/v1/auth/methods'],
    staleTime: 1000 * 60 * 5,
  });

  // SECURITY: Detect user changes (including from SSO redirects) and clear cache
  useEffect(() => {
    if (!isFetched) return;
    
    const currentUserId = authData?.user?.id ?? null;
    const previousUserId = previousUserIdRef.current;
    
    // On first load, just set the previous ID
    if (previousUserId === undefined) {
      previousUserIdRef.current = currentUserId;
      setIsAuthReady(true);
      return;
    }
    
    // If user changed (including logout), clear all cached data
    if (previousUserId !== currentUserId) {
      console.log('[AUTH] User changed from', previousUserId, 'to', currentUserId, '- clearing cache');
      
      // Clear ALL cached data immediately - this is critical for security
      queryClient.clear();
      
      previousUserIdRef.current = currentUserId;
    }
    
    setIsAuthReady(true);
  }, [authData, isFetched, queryClient]);

  // Clear all user-specific cached data when auth state changes
  // SECURITY: Must invalidate ALL user and admin queries to prevent data leakage between sessions
  const clearUserCache = () => {
    console.log('[AUTH] Clearing user cache explicitly');
    
    // Remove all cached queries entirely to ensure fresh start
    queryClient.clear();
    
    // Reset auth ready state to force re-verification
    previousUserIdRef.current = undefined;
    setIsAuthReady(false);
  };

  const loginMutation = useMutation({
    mutationFn: async ({ usernameOrEmail, password }: { usernameOrEmail: string; password: string }) => {
      const res = await apiRequest('POST', '/api/v1/auth/login', { usernameOrEmail, password });
      return res.json();
    },
    onSuccess: (data) => {
      // After successful login, update the auth cache with the new user data
      // instead of clearing it (which causes a race condition with navigation)
      queryClient.setQueryData(['/api/v1/auth/me'], { user: data.user });
      previousUserIdRef.current = data.user?.id ?? null;
      setIsAuthReady(true);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ username, email, name, password }: { username: string; email: string; name: string; password: string }) => {
      const res = await apiRequest('POST', '/api/v1/auth/register', { username, email, name, password });
      return res.json();
    },
    onSuccess: (data) => {
      // After successful registration, update the auth cache with the new user data
      queryClient.setQueryData(['/api/v1/auth/me'], { user: data.user });
      previousUserIdRef.current = data.user?.id ?? null;
      setIsAuthReady(true);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/v1/auth/logout', {});
      return res.json();
    },
    onSuccess: () => {
      clearUserCache();
    },
  });

  const login = async (usernameOrEmail: string, password: string): Promise<SafeUser> => {
    const result = await loginMutation.mutateAsync({ usernameOrEmail, password });
    return result.user;
  };

  const register = async (username: string, email: string, name: string, password: string): Promise<SafeUser> => {
    const result = await registerMutation.mutateAsync({ username, email, name, password });
    return result.user;
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const value: AuthContextType = {
    user: authData?.user ?? null,
    isLoading,
    isAuthenticated: !!authData?.user,
    isAuthReady,
    isAuthMethodsLoading,
    login,
    register,
    logout,
    authMethods: methods ?? { local: true, keycloak: false, registrationEnabled: false },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
