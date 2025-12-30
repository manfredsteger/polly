import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { AdminDashboard } from "@/components/AdminDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, AlertTriangle, ShieldAlert } from "lucide-react";
import type { User, PollWithOptions, SystemSetting } from "@shared/schema";

interface ExtendedStats {
  totalUsers: number;
  activePolls: number;
  inactivePolls: number;
  totalPolls: number;
  totalVotes: number;
  monthlyPolls: number;
  weeklyPolls: number;
  todayPolls: number;
  schedulePolls: number;
  surveyPolls: number;
  recentActivity: Array<{
    type: string;
    message: string;
    timestamp: string;
    actor?: string;
  }>;
}

export default function Admin() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading: authLoading, isAuthReady } = useAuth();
  const [, navigate] = useLocation();

  const { data: stats, isLoading: statsLoading } = useQuery<ExtendedStats>({
    queryKey: ['/api/v1/admin/extended-stats'],
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/v1/admin/users'],
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const { data: polls, isLoading: pollsLoading } = useQuery<PollWithOptions[]>({
    queryKey: ['/api/v1/admin/polls'],
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<SystemSetting[]>({
    queryKey: ['/api/v1/admin/settings'],
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const isLoading = authLoading || !isAuthReady || statsLoading || usersLoading || pollsLoading || settingsLoading;

  // Redirect to login if not authenticated (only after auth is fully ready)
  useEffect(() => {
    if (isAuthReady && !isAuthenticated) {
      navigate('/anmelden');
    }
  }, [isAuthReady, isAuthenticated, navigate]);

  // Wait until auth is fully ready before deciding
  if (!isAuthReady || authLoading || !isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <Skeleton className="h-8 w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Check if user has admin role
  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Card className="p-8">
          <CardContent className="flex flex-col items-center space-y-4">
            <AlertTriangle className="w-16 h-16 text-destructive" />
            <h1 className="text-2xl font-bold text-foreground">{t('admin.accessDenied')}</h1>
            <p className="text-muted-foreground">
              {t('admin.noPermission')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('admin.userRole')}: {user?.role || t('admin.unknown')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <Skeleton className="h-8 w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid lg:grid-cols-4 gap-6">
            <Skeleton className="h-96" />
            <div className="lg:col-span-3">
              <Skeleton className="h-96" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Initial Admin Warning Banner */}
      {user.isInitialAdmin && (
        <Alert variant="destructive" className="mb-6 border-2 border-destructive bg-red-50 dark:bg-red-950/50" data-testid="initial-admin-warning">
          <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
          <AlertTitle className="font-bold text-red-800 dark:text-red-200">{t('admin.defaultAdminAccount')}</AlertTitle>
          <AlertDescription className="mt-2 text-red-700 dark:text-red-300">
            <p className="mb-2">
              {t('admin.defaultAdminWarning')}
            </p>
            <p className="font-semibold text-red-800 dark:text-red-200">
              {t('admin.createNewAdminWarning')}
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3">
          <Shield className="w-8 h-8 text-polly-orange" />
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="title-admin">{t('nav.admin')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('admin.systemManagement')}
            </p>
          </div>
        </div>
      </div>

      {/* Admin Dashboard Component */}
      <AdminDashboard 
        stats={stats}
        users={users}
        polls={polls}
        settings={settings}
        userRole={user.role as 'admin' | 'manager'}
      />
    </div>
  );
}
