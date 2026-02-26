import { useTranslation } from 'react-i18next';
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Key, 
  Database, 
  Mail, 
  FileText,
  Shield, 
  MessageSquare,
  Users,
  Bell,
  Timer,
  Calendar,
  ShieldAlert,
  Target,
  Bot
} from "lucide-react";
import { SettingCard } from "../common/components";
import type { SettingsPanelId as SettingsPanelType } from "../common/types";

interface SettingsPanelProps {
  selectedSettingsPanel: SettingsPanelType;
  onSelectPanel: (panel: SettingsPanelType) => void;
}

export function SettingsPanel({
  selectedSettingsPanel,
  onSelectPanel,
}: SettingsPanelProps) {
  const { t } = useTranslation();

  const { data: oidcStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/v1/admin/oidc-status'],
  });

  const { data: matrixStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/v1/admin/matrix-status'],
  });

  const { data: emailStatus } = useQuery<{ configured: boolean }>({
    queryKey: ['/api/v1/admin/email-status'],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground">{t('admin.settings.title')}</h2>
        <Badge variant="outline">
          <Settings className="w-3 h-3 mr-1" />
          {t('admin.settings.systemConfig')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SettingCard
          title={t('admin.settings.oidc.title')}
          description={t('admin.settings.oidc.description')}
          icon={<Key className="w-5 h-5" />}
          status={oidcStatus?.enabled ? t('admin.settings.status.enabled') : t('admin.settings.status.disabled')}
          statusType={oidcStatus?.enabled ? 'success' : 'neutral'}
          onClick={() => onSelectPanel('oidc')}
          testId="setting-oidc"
        />

        <SettingCard
          title={t('admin.settings.database.title')}
          description={t('admin.settings.database.description')}
          icon={<Database className="w-5 h-5" />}
          status={t('admin.settings.status.connected')}
          statusType="success"
          onClick={() => onSelectPanel('database')}
          testId="setting-database"
        />

        <SettingCard
          title={t('admin.settings.email.title')}
          description={t('admin.settings.email.description')}
          icon={<Mail className="w-5 h-5" />}
          status={emailStatus?.configured ? t('admin.settings.status.configured') : t('admin.settings.status.notConfigured')}
          statusType={emailStatus?.configured ? 'success' : 'warning'}
          onClick={() => onSelectPanel('email')}
          testId="setting-email"
        />

        <SettingCard
          title={t('admin.settings.emailTemplates.title')}
          description={t('admin.settings.emailTemplates.description')}
          icon={<FileText className="w-5 h-5" />}
          status={t('admin.settings.status.manage')}
          statusType="neutral"
          onClick={() => onSelectPanel('email-templates')}
          testId="setting-email-templates"
        />

        <SettingCard
          title={t('admin.settings.security.title')}
          description={t('admin.settings.security.description')}
          icon={<Shield className="w-5 h-5" />}
          status={t('admin.settings.status.configure')}
          statusType="neutral"
          onClick={() => onSelectPanel('security')}
          testId="setting-security"
        />

        <SettingCard
          title={t('admin.settings.roles.title')}
          description={t('admin.settings.roles.description')}
          icon={<Users className="w-5 h-5" />}
          status={t('admin.settings.status.view')}
          statusType="neutral"
          onClick={() => onSelectPanel('roles')}
          testId="setting-roles"
        />

        <SettingCard
          title={t('admin.settings.notifications.title')}
          description={t('admin.settings.notifications.description')}
          icon={<Bell className="w-5 h-5" />}
          status={t('admin.settings.status.configure')}
          statusType="neutral"
          onClick={() => onSelectPanel('notifications')}
          testId="setting-notifications"
        />

        <SettingCard
          title={t('admin.settings.sessionTimeout.title')}
          description={t('admin.settings.sessionTimeout.description')}
          icon={<Timer className="w-5 h-5" />}
          status={t('admin.settings.status.configure')}
          statusType="neutral"
          onClick={() => onSelectPanel('session-timeout')}
          testId="setting-session-timeout"
        />

        <SettingCard
          title={t('admin.settings.calendar.title')}
          description={t('admin.settings.calendar.description')}
          icon={<Calendar className="w-5 h-5" />}
          status={t('admin.settings.status.configure')}
          statusType="neutral"
          onClick={() => onSelectPanel('calendar')}
          testId="setting-calendar"
        />

        <SettingCard
          title={t('admin.settings.wcag.title')}
          description={t('admin.settings.wcag.description')}
          icon={<Target className="w-5 h-5" />}
          status={t('admin.settings.status.check')}
          statusType="neutral"
          onClick={() => onSelectPanel('wcag')}
          testId="setting-wcag"
        />
      </div>

      <div className="pt-6 border-t border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">{t('admin.settings.integrations.title')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SettingCard
            title={t('admin.settings.matrix.title')}
            description={t('admin.settings.matrix.description')}
            icon={<MessageSquare className="w-5 h-5" />}
            status={matrixStatus?.enabled ? t('admin.settings.status.enabled') : t('admin.settings.status.disabled')}
            statusType={matrixStatus?.enabled ? 'success' : 'neutral'}
            onClick={() => onSelectPanel('matrix')}
            testId="setting-matrix"
          />

          <SettingCard
            title={t('admin.settings.pentest.title')}
            description={t('admin.settings.pentest.description')}
            icon={<ShieldAlert className="w-5 h-5" />}
            status={t('admin.settings.status.tools')}
            statusType="neutral"
            onClick={() => onSelectPanel('pentest')}
            testId="setting-pentest"
          />
        </div>
      </div>

      <div className="pt-6 border-t border-border">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-foreground">KI-Funktionen</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-medium">
            Beta
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SettingCard
            title="KI-Assistent"
            description="GWDG SAIA API konfigurieren, Modell wählen und Kontingente pro Rolle festlegen"
            icon={<Bot className="w-5 h-5" />}
            status="Konfigurieren"
            statusType="neutral"
            onClick={() => onSelectPanel('ai')}
            testId="setting-ai"
          />
        </div>
      </div>
    </div>
  );
}
