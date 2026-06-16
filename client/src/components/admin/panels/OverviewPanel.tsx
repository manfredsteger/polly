import { useTranslation } from 'react-i18next';
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
  FileText,
  ListChecks,
  Loader2,
  RefreshCw,
  CheckCircle,
  Calendar as CalendarIcon
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getDateLocale } from "@/lib/i18n";
import { StatCard, ActivityItem } from "../common/components";
import type { ExtendedStats } from "../common/types";

interface OverviewPanelProps {
  extendedStats: ExtendedStats | undefined;
  statsLoading: boolean;
  onStatCardClick: (target: string, filter?: { pollType?: 'schedule' | 'survey' | 'organization' }) => void;
  onRefreshStats: () => Promise<void>;
  statsRefreshing: boolean;
}

export function OverviewPanel({
  extendedStats,
  statsLoading,
  onStatCardClick,
  onRefreshStats,
  statsRefreshing,
}: OverviewPanelProps) {
  const { t, i18n } = useTranslation();
  
  const displayStats = extendedStats || {
    totalUsers: 0,
    activePolls: 0,
    inactivePolls: 0,
    totalPolls: 0,
    totalParticipations: 0,
    monthlyPolls: 0,
    weeklyPolls: 0,
    todayPolls: 0,
    schedulePolls: 0,
    surveyPolls: 0,
    organizationPolls: 0,
    recentActivity: [],
    lastChecked: null as Date | null,
  };

  const formatCacheTime = (date: Date | string | null) => {
    if (!date) return null;
    try {
      return formatDistanceToNow(new Date(date), { 
        addSuffix: true,
        locale: getDateLocale()
      });
    } catch {
      return null;
    }
  };

  const cacheInfo = (extendedStats as any)?.lastChecked 
    ? formatCacheTime((extendedStats as any).lastChecked)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.overview.title')}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefreshStats}
            disabled={statsRefreshing}
            className="h-8"
          >
            {statsRefreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
          {cacheInfo && (
            <span className="text-xs text-muted-foreground">
              {t('admin.cache.updated')} {cacheInfo}
            </span>
          )}
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          {t('admin.overview.systemActive')}
        </Badge>
      </div>
      
      {/* Row 1: Core metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          label={t('admin.overview.participationsLabel')} 
          value={displayStats.totalParticipations} 
          color="purple" 
          onClick={() => onStatCardClick("monitoring")}
          testId="stat-votes"
        />
      </div>

      {/* Row 2: Poll creation cadence */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="p-4 cursor-pointer border-amber-200 bg-gradient-to-r from-amber-500 to-orange-400 hover:shadow-md dark:border-amber-700/45 dark:from-amber-500 dark:to-orange-400 transition-shadow"
          onClick={() => onStatCardClick("polls")}
          data-testid="stat-monthly"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">{t('admin.overview.pollsCreated')}</p>
              <p className="text-xs text-white/60">{t('admin.overview.last30Days')}</p>
              <p className="text-xl font-bold text-white">{displayStats.monthlyPolls}</p>
            </div>
            <TrendingUp className="w-6 h-6 text-amber-200" />
          </div>
        </Card>
        <Card className="p-4 cursor-pointer border-blue-200 bg-gradient-to-r from-sky-500 to-blue-500 hover:shadow-md dark:border-blue-700/45 dark:from-sky-500 dark:to-blue-500 transition-shadow" data-testid="stat-weekly">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">{t('admin.overview.pollsCreated')}</p>
              <p className="text-xs text-white/60">{t('admin.overview.last7Days')}</p>
              <p className="text-xl font-bold text-white">{displayStats.weeklyPolls}</p>
            </div>
            <Clock className="w-6 h-6 text-sky-200" />
          </div>
        </Card>
        <Card className="p-4 cursor-pointer border-emerald-200 bg-gradient-to-r from-emerald-500 to-green-400 hover:shadow-md dark:border-emerald-700/45 dark:from-emerald-500 dark:to-green-400 transition-shadow" data-testid="stat-today">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">{t('admin.overview.pollsCreated')}</p>
              <p className="text-xs text-white/60">{t('admin.overview.last24Hours')}</p>
              <p className="text-xl font-bold text-white">{displayStats.todayPolls}</p>
            </div>
            <Activity className="w-6 h-6 text-emerald-200" />
          </div>
        </Card>
      </div>

      {/* Row 3: Poll types - Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
        className="p-4 cursor-pointer border-emerald-200 bg-gradient-to-r from-emerald-700 to-green-700 hover:shadow-md dark:border-emerald-700/55 dark:from-emerald-900 dark:to-green-900 transition-shadow"
             onClick={() => onStatCardClick("polls", { pollType: "schedule" })}
          data-testid="stat-schedule-polls"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">{t('admin.overview.schedulePolls')}</p>
              <p className="text-2xl font-bold text-white">{displayStats.schedulePolls}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-emerald-200" />
            </div>
          </div>
        </Card>
        <Card
        className="p-4 cursor-pointer border-violet-200 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:shadow-md dark:border-violet-700/55 dark:from-violet-600 dark:to-fuchsia-600 transition-shadow"
              onClick={() => onStatCardClick("polls", { pollType: "survey" })}
          data-testid="stat-survey-polls"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">{t('admin.overview.classicPolls')}</p>
              <p className="text-2xl font-bold text-white">{displayStats.surveyPolls}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center">
              <FileText className="w-6 h-6 text-violet-200" />
            </div>
          </div>
        </Card>
        <Card
           className="p-4 cursor-pointer border-sky-200 bg-gradient-to-r from-sky-600 to-indigo-600 hover:shadow-md dark:border-sky-700/55 dark:from-sky-600 dark:to-indigo-600 transition-shadow"
        onClick={() => onStatCardClick("polls", { pollType: "organization" })}
          data-testid="stat-organization-polls"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">{t('admin.overview.orgLists')}</p>
              <p className="text-2xl font-bold text-white">{displayStats.organizationPolls}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center">
              <ListChecks className="w-6 h-6 text-sky-200" />
            </div>
          </div>
        </Card>
      </div>

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
