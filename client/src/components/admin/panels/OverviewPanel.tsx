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
  onStatCardClick: (target: string) => void;
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
    totalVotes: 0,
    monthlyPolls: 0,
    weeklyPolls: 0,
    todayPolls: 0,
    schedulePolls: 0,
    surveyPolls: 0,
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
