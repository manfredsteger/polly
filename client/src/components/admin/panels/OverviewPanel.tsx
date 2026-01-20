import { useTranslation } from 'react-i18next';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Activity, 
  BarChart3, 
  TrendingUp,
  Vote,
  Clock,
  Server,
  FileText,
  AlertCircle,
  Loader2,
  RefreshCw,
  CheckCircle,
  Calendar as CalendarIcon
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getDateLocale } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { StatCard, ActivityItem } from "../common/components";
import type { ExtendedStats, SystemStatusData, VulnerabilitiesData, SystemPackagesData, getImpactBadgeColor } from "../common/types";

interface OverviewPanelProps {
  extendedStats: ExtendedStats | undefined;
  statsLoading: boolean;
  systemStatus: SystemStatusData | undefined;
  systemStatusLoading: boolean;
  systemStatusError: Error | null;
  vulnerabilities: VulnerabilitiesData | undefined;
  vulnerabilitiesLoading: boolean;
  systemPackages: SystemPackagesData | undefined;
  systemPackagesLoading: boolean;
  onStatCardClick: (target: string) => void;
  onRefreshSystemStatus: () => Promise<void>;
  onRefreshVulnerabilities: () => Promise<void>;
  onRefreshSystemPackages: () => Promise<void>;
  refetchSystemStatus: () => void;
  refetchVulnerabilities: () => void;
  refetchSystemPackages: () => void;
  systemStatusRefreshing: boolean;
  vulnerabilitiesRefreshing: boolean;
  systemPackagesRefreshing: boolean;
  formatTimeUntil: (date: Date | string) => string;
  getImpactBadgeColor: (area: 'frontend' | 'backend' | 'development' | 'shared') => string;
}

export function OverviewPanel({
  extendedStats,
  statsLoading,
  systemStatus,
  systemStatusLoading,
  systemStatusError,
  vulnerabilities,
  vulnerabilitiesLoading,
  systemPackages,
  systemPackagesLoading,
  onStatCardClick,
  onRefreshSystemStatus,
  onRefreshVulnerabilities,
  onRefreshSystemPackages,
  refetchSystemStatus,
  refetchVulnerabilities,
  refetchSystemPackages,
  systemStatusRefreshing,
  vulnerabilitiesRefreshing,
  systemPackagesRefreshing,
  formatTimeUntil,
  getImpactBadgeColor,
}: OverviewPanelProps) {
  const { t } = useTranslation();
  
  const displayStats = extendedStats || {
    totalUsers: 0,
    activePolls: 0,
    inactivePolls: 0,
    totalPolls: 0,
    totalVotes: 0,
    monthlyPolls: 0,
    weeklyPolls: 0,
    todayPolls: 0,
    schedulePolls: 0,
    surveyPolls: 0,
    recentActivity: [],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground">{t('admin.overview.title')}</h2>
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          {t('admin.overview.systemActive')}
        </Badge>
      </div>
      
      {/* Main Stats Grid - Clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          icon={<Users />} 
          label={t('admin.overview.usersLabel')} 
          value={displayStats.totalUsers} 
          color="blue" 
          onClick={() => onStatCardClick("users")}
          testId="stat-users"
        />
        <StatCard 
          icon={<Vote />} 
          label={t('admin.overview.activePollsLabel')} 
          value={displayStats.activePolls} 
          color="green" 
          onClick={() => onStatCardClick("polls")}
          testId="stat-active-polls"
        />
        <StatCard 
          icon={<BarChart3 />} 
          label={t('admin.overview.votesLabel')} 
          value={displayStats.totalVotes} 
          color="purple" 
          onClick={() => onStatCardClick("monitoring")}
          testId="stat-votes"
        />
        <StatCard 
          icon={<TrendingUp />} 
          label={t('admin.overview.thisMonth')} 
          value={displayStats.monthlyPolls} 
          color="orange" 
          onClick={() => onStatCardClick("polls")}
          testId="stat-monthly"
        />
      </div>

      {/* Secondary Stats - Clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className="p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onStatCardClick("polls")}
          data-testid="stat-schedule-polls"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.overview.schedulePolls')}</p>
              <p className="text-xl font-bold">{displayStats.schedulePolls}</p>
            </div>
            <CalendarIcon className="w-6 h-6 text-polly-orange" />
          </div>
        </Card>
        <Card 
          className="p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onStatCardClick("polls")}
          data-testid="stat-survey-polls"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.overview.classicPolls')}</p>
              <p className="text-xl font-bold">{displayStats.surveyPolls}</p>
            </div>
            <FileText className="w-6 h-6 text-polly-blue" />
          </div>
        </Card>
        <Card className="p-4" data-testid="stat-weekly">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.overview.thisWeek')}</p>
              <p className="text-xl font-bold">{displayStats.weeklyPolls}</p>
            </div>
            <Clock className="w-6 h-6 text-amber-500" />
          </div>
        </Card>
        <Card className="p-4" data-testid="stat-today">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.overview.today')}</p>
              <p className="text-xl font-bold">{displayStats.todayPolls}</p>
            </div>
            <Activity className="w-6 h-6 text-green-500" />
          </div>
        </Card>
      </div>

      {/* System Components Status */}
      <Card className="polly-card" data-testid="system-components-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Server className="w-5 h-5 mr-2" />
              {t('admin.monitoring.componentVersions')}
            </CardTitle>
            <div className="flex items-center gap-3">
              {systemStatus?.lastChecked && (
                <div className="text-xs text-muted-foreground text-right">
                  <div>{t('admin.monitoring.lastCheck')}: {formatDistanceToNow(new Date(systemStatus.lastChecked), { addSuffix: true, locale: getDateLocale() })}</div>
                  {systemStatus.cacheExpiresAt && (
                    <div>{t('admin.monitoring.nextCheck')}: in {formatTimeUntil(systemStatus.cacheExpiresAt)}</div>
                  )}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onRefreshSystemStatus}
                disabled={systemStatusRefreshing || systemStatusLoading}
                data-testid="refresh-system-status"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${systemStatusRefreshing ? 'animate-spin' : ''}`} />
                {t('admin.monitoring.checkNow')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {systemStatusLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : systemStatusError ? (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-destructive" />
              <p className="text-muted-foreground">{t('admin.monitoring.loadError')}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => refetchSystemStatus()}>
                {t('admin.monitoring.retry')}
              </Button>
            </div>
          ) : systemStatus?.components ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">{t('admin.monitoring.package')}</th>
                    <th className="text-left py-2 font-medium">{t('admin.monitoring.version')}</th>
                    <th className="text-left py-2 font-medium">{t('admin.monitoring.status')}</th>
                    <th className="text-left py-2 font-medium">{t('admin.monitoring.eol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {systemStatus.components.map((component) => (
                    <tr key={component.name} className="border-b last:border-0" data-testid={`component-row-${component.name.toLowerCase().replace(/\s/g, '-')}`}>
                      <td className="py-2 font-medium">{component.name}</td>
                      <td className="py-2 text-muted-foreground">
                        {component.version}
                        {component.latestVersion && component.version !== component.latestVersion && (
                          <span className="text-xs text-amber-600 ml-1">({component.latestVersion} {t('admin.monitoring.available')})</span>
                        )}
                      </td>
                      <td className="py-2">
                        <Badge variant={component.status === 'current' ? 'default' : component.status === 'warning' ? 'secondary' : 'destructive'}>
                          {component.status === 'current' && t('admin.monitoring.supported')}
                          {component.status === 'warning' && t('admin.monitoring.warning')}
                          {component.status === 'eol' && t('admin.monitoring.endOfLife')}
                          {component.status === 'unknown' && t('admin.monitoring.unknown')}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground text-sm">
                        {component.eolDate ? (
                          <span className={component.daysUntilEol !== null && component.daysUntilEol <= 90 ? 'text-amber-600 font-medium' : ''}>
                            {component.eolDate}
                            {component.daysUntilEol !== null && component.daysUntilEol > 0 && (
                              <span className="ml-1">({component.daysUntilEol} {t('admin.monitoring.daysLeft')})</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="polly-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            {t('admin.overview.recentActivity')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {displayStats.recentActivity.length > 0 ? (
              displayStats.recentActivity.slice(0, 5).map((activity, index) => (
                <ActivityItem key={index} activity={activity} />
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">{t('admin.overview.noRecentActivity')}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
