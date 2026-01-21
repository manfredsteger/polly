import { useTranslation } from 'react-i18next';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Users, 
  Activity, 
  BarChart3, 
  Settings,
  Vote,
  PanelLeftClose,
  PanelLeft,
  Paintbrush,
  UserX,
  FlaskConical,
} from "lucide-react";
import { NavButton } from "./common/components";
import type { AdminTab, SettingsPanelId } from "./common/types";

interface AdminSidebarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  clearSelections: () => void;
}

export function AdminSidebar({
  activeTab,
  setActiveTab,
  sidebarCollapsed,
  setSidebarCollapsed,
  clearSelections,
}: AdminSidebarProps) {
  const { t } = useTranslation();

  const handleNavClick = (tab: AdminTab) => {
    setActiveTab(tab);
    clearSelections();
  };

  return (
    <div className={`flex-shrink-0 transition-all duration-200 ${sidebarCollapsed ? 'w-14' : 'w-48'}`}>
      <Card className="polly-card sticky top-24">
        <CardContent className="p-2">
          <div className="flex items-center justify-center mb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  data-testid="button-toggle-sidebar"
                >
                  {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{sidebarCollapsed ? t('admin.nav.expand') : t('admin.nav.collapse')}</TooltipContent>
            </Tooltip>
          </div>
          <nav className="space-y-1">
            <NavButton 
              collapsed={sidebarCollapsed} 
              active={activeTab === "overview"} 
              onClick={() => handleNavClick("overview")} 
              icon={<BarChart3 className="w-4 h-4" />} 
              label={t('admin.nav.dashboard')} 
              testId="nav-overview" 
            />
            <NavButton 
              collapsed={sidebarCollapsed} 
              active={activeTab === "monitoring"} 
              onClick={() => handleNavClick("monitoring")} 
              icon={<Activity className="w-4 h-4" />} 
              label={t('admin.nav.monitoring')} 
              testId="nav-monitoring" 
            />
            <NavButton 
              collapsed={sidebarCollapsed} 
              active={activeTab === "polls"} 
              onClick={() => handleNavClick("polls")} 
              icon={<Vote className="w-4 h-4" />} 
              label={t('admin.nav.polls')} 
              testId="nav-polls" 
            />
            <NavButton 
              collapsed={sidebarCollapsed} 
              active={activeTab === "users"} 
              onClick={() => handleNavClick("users")} 
              icon={<Users className="w-4 h-4" />} 
              label={t('admin.nav.users')} 
              testId="nav-users" 
            />
            <NavButton 
              collapsed={sidebarCollapsed} 
              active={activeTab === "customize"} 
              onClick={() => handleNavClick("customize")} 
              icon={<Paintbrush className="w-4 h-4" />} 
              label={t('admin.nav.customize')} 
              testId="nav-customize" 
            />
            <NavButton 
              collapsed={sidebarCollapsed} 
              active={activeTab === "settings"} 
              onClick={() => handleNavClick("settings")} 
              icon={<Settings className="w-4 h-4" />} 
              label={t('admin.nav.settings')} 
              testId="nav-settings" 
            />
            <NavButton 
              collapsed={sidebarCollapsed} 
              active={activeTab === "tests"} 
              onClick={() => handleNavClick("tests")} 
              icon={<FlaskConical className="w-4 h-4" />} 
              label={t('admin.nav.tests')} 
              testId="nav-tests" 
            />
            <NavButton 
              collapsed={sidebarCollapsed} 
              active={activeTab === "deletion-requests"} 
              onClick={() => handleNavClick("deletion-requests")} 
              icon={<UserX className="w-4 h-4" />} 
              label={t('admin.nav.deletionRequests')} 
              testId="nav-deletion-requests" 
            />
          </nav>
        </CardContent>
      </Card>
    </div>
  );
}
