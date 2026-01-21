import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { AdminSidebar } from "./AdminSidebar";
import { OverviewPanel } from "./panels/OverviewPanel";
import { MonitoringPanel } from "./panels/MonitoringPanel";
import { PollsPanel } from "./panels/PollsPanel";
import { UsersPanel } from "./panels/UsersPanel";
import { CustomizePanel } from "./panels/CustomizePanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { TestsPanel } from "./panels/TestsPanel";
import { DeletionRequestsPanel } from "./panels/DeletionRequestsPanel";
import type { AdminTab, SettingsPanelId as SettingsPanelType, ExtendedStats, SystemStatusData, VulnerabilitiesData, SystemPackagesData, ImpactArea } from "./common/types";
import type { User, PollWithOptions, SystemSetting } from "@shared/schema";
import {
  OIDCSettingsPanel,
  DatabaseSettingsPanel,
  EmailSettingsPanel,
  EmailTemplatesPanel,
  SecuritySettingsPanel,
  MatrixSettingsPanel,
  RoleManagementPanel,
  NotificationSettingsPanel,
  SessionTimeoutPanel,
  CalendarSettingsPanel,
  PentestToolsPanel,
  WCAGAccessibilityPanel,
} from "./settings";

interface AdminDashboardProps {
  stats?: {
    totalUsers: number;
    activePolls: number;
    totalVotes: number;
    monthlyPolls: number;
  };
  users?: User[];
  polls?: PollWithOptions[];
  settings?: SystemSetting[];
  userRole: 'admin' | 'manager';
}

const getImpactBadgeColor = (area: ImpactArea) => {
  switch (area) {
    case 'development': return 'polly-badge-dev-only';
    case 'frontend': return 'polly-badge-frontend';
    case 'backend': return 'polly-badge-backend';
    case 'shared': return 'polly-badge-fullstack';
    default: return 'polly-badge-info';
  }
};

const formatTimeUntil = (date: Date | string, t: any) => {
  const target = new Date(date);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return t('common.now');
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}${t('common.hoursShort')} ${minutes}min`;
  return `${minutes}min`;
};

export function AdminDashboard({ stats, users, polls, settings, userRole }: AdminDashboardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedPoll, setSelectedPoll] = useState<PollWithOptions | null>(null);
  const [selectedSettingsPanel, setSelectedSettingsPanel] = useState<SettingsPanelType>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin-sidebar-collapsed');
      return saved ? JSON.parse(saved) : window.innerWidth < 1024;
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('admin-sidebar-collapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const { data: extendedStats, isLoading: statsLoading } = useQuery<ExtendedStats>({
    queryKey: ['/api/v1/admin/extended-stats'],
  });

  const { data: systemStatus, isLoading: systemStatusLoading, error: systemStatusError, refetch: refetchSystemStatus } = useQuery<SystemStatusData>({
    queryKey: ['/api/v1/admin/system-status'],
    staleTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    retry: 1,
    gcTime: 0,
  });

  const { data: vulnerabilities, isLoading: vulnerabilitiesLoading, refetch: refetchVulnerabilities } = useQuery<VulnerabilitiesData>({
    queryKey: ['/api/v1/admin/vulnerabilities'],
    staleTime: 1000 * 60 * 60 * 6,
    refetchOnWindowFocus: false,
  });

  const { data: systemPackages, isLoading: systemPackagesLoading, refetch: refetchSystemPackages } = useQuery<SystemPackagesData>({
    queryKey: ['/api/v1/admin/system-packages'],
    staleTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });

  const { data: deprovisionStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/v1/admin/deprovision-settings'],
    select: (data) => ({ enabled: data?.enabled || false }),
  });

  const [systemStatusRefreshing, setSystemStatusRefreshing] = useState(false);
  const [vulnerabilitiesRefreshing, setVulnerabilitiesRefreshing] = useState(false);
  const [systemPackagesRefreshing, setSystemPackagesRefreshing] = useState(false);

  const handleRefreshSystemStatus = async () => {
    setSystemStatusRefreshing(true);
    try {
      await queryClient.fetchQuery({
        queryKey: ['/api/v1/admin/system-status'],
        queryFn: async () => {
          const res = await fetch('/api/v1/admin/system-status?refresh=true', { credentials: 'include' });
          if (!res.ok) throw new Error('Failed to refresh');
          return res.json();
        },
      });
      await refetchSystemStatus();
      toast({ title: t('admin.toast.systemStatusUpdated'), description: t('admin.toast.systemStatusUpdatedDescription') });
    } catch {
      toast({ title: t('admin.toast.error'), description: t('admin.toast.updateFailed'), variant: "destructive" });
    } finally {
      setSystemStatusRefreshing(false);
    }
  };

  const handleRefreshVulnerabilities = async () => {
    setVulnerabilitiesRefreshing(true);
    try {
      await queryClient.fetchQuery({
        queryKey: ['/api/v1/admin/vulnerabilities'],
        queryFn: async () => {
          const res = await fetch('/api/v1/admin/vulnerabilities?refresh=true', { credentials: 'include' });
          if (!res.ok) throw new Error('Failed to refresh');
          return res.json();
        },
      });
      await refetchVulnerabilities();
      toast({ title: t('admin.toast.securityCheckUpdated'), description: t('admin.toast.securityCheckUpdatedDescription') });
    } catch {
      toast({ title: t('admin.toast.error'), description: t('admin.toast.updateFailed'), variant: "destructive" });
    } finally {
      setVulnerabilitiesRefreshing(false);
    }
  };

  const handleRefreshSystemPackages = async () => {
    setSystemPackagesRefreshing(true);
    try {
      await queryClient.fetchQuery({
        queryKey: ['/api/v1/admin/system-packages'],
        queryFn: async () => {
          const res = await fetch('/api/v1/admin/system-packages?refresh=true', { credentials: 'include' });
          if (!res.ok) throw new Error('Failed to refresh');
          return res.json();
        },
      });
      await refetchSystemPackages();
      toast({ title: t('admin.toast.systemPackagesUpdated'), description: t('admin.toast.systemPackagesUpdatedDescription') });
    } catch {
      toast({ title: t('admin.toast.error'), description: t('admin.toast.updateFailed'), variant: "destructive" });
    } finally {
      setSystemPackagesRefreshing(false);
    }
  };

  const clearSelections = () => {
    setSelectedUser(null);
    setSelectedPoll(null);
    setSelectedSettingsPanel(null);
  };

  const handleStatCardClick = (target: string) => {
    clearSelections();
    setActiveTab(target as AdminTab);
  };

  const isDeprovisionEnabled = deprovisionStatus?.enabled || false;

  return (
    <TooltipProvider>
      <div className="flex gap-3">
        <AdminSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          clearSelections={clearSelections}
        />

        <div className="flex-1 min-w-0">
          {activeTab === "overview" && !selectedUser && !selectedPoll && (
            <OverviewPanel
              extendedStats={extendedStats}
              statsLoading={statsLoading}
              systemStatus={systemStatus}
              systemStatusLoading={systemStatusLoading}
              systemStatusError={systemStatusError as Error | null}
              vulnerabilities={vulnerabilities}
              vulnerabilitiesLoading={vulnerabilitiesLoading}
              systemPackages={systemPackages}
              systemPackagesLoading={systemPackagesLoading}
              onStatCardClick={handleStatCardClick}
              onRefreshSystemStatus={handleRefreshSystemStatus}
              onRefreshVulnerabilities={handleRefreshVulnerabilities}
              onRefreshSystemPackages={handleRefreshSystemPackages}
              refetchSystemStatus={() => refetchSystemStatus()}
              refetchVulnerabilities={() => refetchVulnerabilities()}
              refetchSystemPackages={() => refetchSystemPackages()}
              systemStatusRefreshing={systemStatusRefreshing}
              vulnerabilitiesRefreshing={vulnerabilitiesRefreshing}
              systemPackagesRefreshing={systemPackagesRefreshing}
              formatTimeUntil={(date) => formatTimeUntil(date, t)}
              getImpactBadgeColor={getImpactBadgeColor}
            />
          )}

          {activeTab === "monitoring" && !selectedUser && !selectedPoll && (
            <MonitoringPanel
              extendedStats={extendedStats}
              vulnerabilities={vulnerabilities}
              vulnerabilitiesLoading={vulnerabilitiesLoading}
              systemPackages={systemPackages}
              systemPackagesLoading={systemPackagesLoading}
              onRefreshVulnerabilities={handleRefreshVulnerabilities}
              onRefreshSystemPackages={handleRefreshSystemPackages}
              vulnerabilitiesRefreshing={vulnerabilitiesRefreshing}
              systemPackagesRefreshing={systemPackagesRefreshing}
              formatTimeUntil={(date) => formatTimeUntil(date, t)}
              getImpactBadgeColor={getImpactBadgeColor}
            />
          )}

          {activeTab === "polls" && (
            <PollsPanel
              polls={polls}
              selectedPoll={selectedPoll}
              onPollClick={setSelectedPoll}
              onBackToPolls={() => setSelectedPoll(null)}
            />
          )}

          {activeTab === "users" && (
            <UsersPanel
              users={users}
              polls={polls}
              selectedUser={selectedUser}
              onUserClick={setSelectedUser}
              onBackToUsers={() => setSelectedUser(null)}
              onPollClick={setSelectedPoll}
              isDeprovisionEnabled={isDeprovisionEnabled}
            />
          )}

          {activeTab === "customize" && <CustomizePanel />}

          {activeTab === "settings" && !selectedSettingsPanel && (
            <SettingsPanel
              selectedSettingsPanel={selectedSettingsPanel}
              onSelectPanel={setSelectedSettingsPanel}
            />
          )}

          {activeTab === "settings" && selectedSettingsPanel === 'oidc' && (
            <OIDCSettingsPanel onBack={() => setSelectedSettingsPanel(null)} />
          )}
          {activeTab === "settings" && selectedSettingsPanel === 'database' && (
            <DatabaseSettingsPanel onBack={() => setSelectedSettingsPanel(null)} />
          )}
          {activeTab === "settings" && selectedSettingsPanel === 'email' && (
            <EmailSettingsPanel onBack={() => setSelectedSettingsPanel(null)} />
          )}
          {activeTab === "settings" && selectedSettingsPanel === 'email-templates' && (
            <EmailTemplatesPanel onBack={() => setSelectedSettingsPanel(null)} />
          )}
          {activeTab === "settings" && selectedSettingsPanel === 'security' && (
            <SecuritySettingsPanel onBack={() => setSelectedSettingsPanel(null)} />
          )}
          {activeTab === "settings" && selectedSettingsPanel === 'matrix' && (
            <MatrixSettingsPanel onBack={() => setSelectedSettingsPanel(null)} />
          )}
          {activeTab === "settings" && selectedSettingsPanel === 'roles' && (
            <RoleManagementPanel onBack={() => setSelectedSettingsPanel(null)} />
          )}
          {activeTab === "settings" && selectedSettingsPanel === 'notifications' && (
            <NotificationSettingsPanel onBack={() => setSelectedSettingsPanel(null)} />
          )}
          {activeTab === "settings" && selectedSettingsPanel === 'session-timeout' && (
            <SessionTimeoutPanel onBack={() => setSelectedSettingsPanel(null)} />
          )}
          {activeTab === "settings" && selectedSettingsPanel === 'calendar' && (
            <CalendarSettingsPanel onBack={() => setSelectedSettingsPanel(null)} />
          )}
          {activeTab === "settings" && selectedSettingsPanel === 'pentest' && (
            <PentestToolsPanel onBack={() => setSelectedSettingsPanel(null)} />
          )}
          {activeTab === "settings" && selectedSettingsPanel === 'wcag' && (
            <WCAGAccessibilityPanel onBack={() => setSelectedSettingsPanel(null)} />
          )}

          {activeTab === "tests" && (
            <TestsPanel onBack={() => setActiveTab("overview")} />
          )}

          {activeTab === "deletion-requests" && (
            <DeletionRequestsPanel onBack={() => setActiveTab("overview")} />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
