import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Server, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { getDateLocale } from "@/lib/i18n";
import { ActivityItem } from "../common/components";
import type { ExtendedStats, VulnerabilitiesData, SystemPackagesData, ImpactArea } from "../common/types";

interface MonitoringPanelProps {
  extendedStats: ExtendedStats | undefined;
  vulnerabilities: VulnerabilitiesData | undefined;
  vulnerabilitiesLoading: boolean;
  systemPackages: SystemPackagesData | undefined;
  systemPackagesLoading: boolean;
  onRefreshVulnerabilities: () => Promise<void>;
  onRefreshSystemPackages: () => Promise<void>;
  vulnerabilitiesRefreshing: boolean;
  systemPackagesRefreshing: boolean;
  formatTimeUntil: (date: Date | string) => string;
  getImpactBadgeColor: (area: ImpactArea) => string;
}

export function MonitoringPanel({
  extendedStats,
  vulnerabilities,
  vulnerabilitiesLoading,
  systemPackages,
  systemPackagesLoading,
  onRefreshVulnerabilities,
  onRefreshSystemPackages,
  vulnerabilitiesRefreshing,
  systemPackagesRefreshing,
  formatTimeUntil,
  getImpactBadgeColor,
}: MonitoringPanelProps) {
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
        <h2 className="text-2xl font-semibold text-foreground">{t('admin.monitoring.title')}</h2>
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          <Activity className="w-3 h-3 mr-1" />
          {t('admin.monitoring.liveData')}
        </Badge>
      </div>

      {/* Activity Feed */}
      <Card className="polly-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            {t('admin.monitoring.activityFeed')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {displayStats.recentActivity.length > 0 ? (
              displayStats.recentActivity.map((activity, index) => (
                <ActivityItem key={index} activity={activity} />
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">{t('admin.monitoring.noActivity')}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vulnerabilities Check */}
      <Card className="polly-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Server className="w-5 h-5 mr-2" />
              {t('admin.monitoring.securityAudit')}
            </CardTitle>
            <div className="flex items-center gap-3">
              {vulnerabilities?.lastChecked && (
                <div className="text-xs text-muted-foreground text-right">
                  <div>{t('admin.monitoring.lastCheck')}: {formatDistanceToNow(new Date(vulnerabilities.lastChecked), { addSuffix: true, locale: getDateLocale() })}</div>
                  {vulnerabilities.cacheExpiresAt && (
                    <div>{t('admin.monitoring.nextCheck')}: in {formatTimeUntil(vulnerabilities.cacheExpiresAt)}</div>
                  )}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onRefreshVulnerabilities}
                disabled={vulnerabilitiesRefreshing || vulnerabilitiesLoading}
                data-testid="refresh-vulnerabilities"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${vulnerabilitiesRefreshing ? 'animate-spin' : ''}`} />
                {t('admin.monitoring.checkNow')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {vulnerabilitiesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : vulnerabilities ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {vulnerabilities.summary.critical > 0 && (
                  <Badge variant="destructive">
                    {vulnerabilities.summary.critical} Critical
                  </Badge>
                )}
                {vulnerabilities.summary.high > 0 && (
                  <Badge className="bg-orange-800 hover:bg-orange-900 text-white">
                    {vulnerabilities.summary.high} High
                  </Badge>
                )}
                {vulnerabilities.summary.moderate > 0 && (
                  <Badge className="bg-amber-800 hover:bg-amber-900 text-white">
                    {vulnerabilities.summary.moderate} Moderate
                  </Badge>
                )}
                {vulnerabilities.summary.low > 0 && (
                  <Badge variant="secondary">
                    {vulnerabilities.summary.low} Low
                  </Badge>
                )}
                {vulnerabilities.summary.total === 0 && (
                  <Badge variant="default" className="bg-green-600">
                    {t('admin.monitoring.noVulnerabilities')}
                  </Badge>
                )}
              </div>
              
              {vulnerabilities.vulnerabilities.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {vulnerabilities.vulnerabilities.slice(0, 10).map((vuln, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={vuln.severity === 'critical' ? 'destructive' : 'secondary'}
                          className={vuln.severity === 'high' ? 'bg-orange-500 text-white' : ''}
                        >
                          {vuln.severity}
                        </Badge>
                        <span className="font-medium">{vuln.name}</span>
                      </div>
                      <Badge className={getImpactBadgeColor(vuln.impactArea)}>
                        {vuln.impactLabel}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">{t('admin.monitoring.noData')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Packages */}
      <Card className="polly-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Server className="w-5 h-5 mr-2" />
              {t('admin.monitoring.systemPackages')}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshSystemPackages}
              disabled={systemPackagesRefreshing || systemPackagesLoading}
              data-testid="refresh-system-packages"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${systemPackagesRefreshing ? 'animate-spin' : ''}`} />
              {t('admin.monitoring.checkNow')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {systemPackagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : systemPackages?.packages ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">{t('admin.monitoring.package')}</th>
                    <th className="text-left py-2 font-medium">{t('admin.monitoring.version')}</th>
                    <th className="text-left py-2 font-medium">{t('admin.monitoring.purpose')}</th>
                  </tr>
                </thead>
                <tbody>
                  {systemPackages.packages.map((pkg) => (
                    <tr key={pkg.name} className="border-b last:border-0">
                      <td className="py-2 font-medium">{pkg.name}</td>
                      <td className="py-2 text-muted-foreground">{pkg.version || '-'}</td>
                      <td className="py-2 text-muted-foreground">{pkg.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">{t('admin.monitoring.noPackages')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
