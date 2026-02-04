import type { User, PollWithOptions, SystemSetting, CustomizationSettings, FooterLink } from "@shared/schema";

export interface ExtendedStats {
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
    pollToken?: string;
  }>;
}

export interface ComponentStatus {
  name: string;
  version: string;
  latestVersion: string | null;
  eolDate: string | null;
  status: 'current' | 'warning' | 'eol' | 'unknown';
  daysUntilEol: number | null;
  cycle: string;
}

export interface SystemStatusData {
  components: ComponentStatus[];
  lastChecked: string;
  cacheExpiresAt: string;
}

export type ImpactArea = 'frontend' | 'backend' | 'development' | 'shared';

export interface Vulnerability {
  name: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  title: string;
  url: string;
  vulnerableVersions: string;
  patchedVersions: string | null;
  cve: string | null;
  via: string[];
  isDirect: boolean;
  impactArea: ImpactArea;
  impactLabel: string;
}

export interface VulnerabilitiesData {
  vulnerabilities: Vulnerability[];
  summary: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
    info: number;
    total: number;
  };
  impactSummary: {
    frontend: number;
    backend: number;
    development: number;
    shared: number;
  };
  lastChecked: string;
  cacheExpiresAt: string;
}

export interface SystemPackage {
  name: string;
  version: string | null;
  channel: string;
  purpose: string;
  hasKnownIssues: boolean;
  notes: string | null;
}

export interface SystemPackagesData {
  packages: SystemPackage[];
  nixChannel: string;
  lastChecked: string;
  cacheExpiresAt: string;
}

export interface AdminDashboardProps {
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

export type SettingsPanelId = 'oidc' | 'database' | 'email' | 'email-templates' | 'security' | 'matrix' | 'roles' | 'notifications' | 'session-timeout' | 'calendar' | 'pentest' | 'tests' | 'wcag' | null;

export type AdminTab = 'overview' | 'monitoring' | 'polls' | 'users' | 'customize' | 'settings' | 'tests' | 'deletion-requests';

export interface EmailTemplate {
  id: number;
  type: string;
  name: string;
  subject: string;
  jsonContent: Record<string, unknown>;
  htmlContent: string | null;
  textContent: string | null;
  variables: Array<{ key: string; description: string }>;
  isDefault: boolean;
  isActive: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface EmailFooter {
  html: string;
  text: string;
}

export interface EmailTheme {
  backdropColor: string;
  canvasColor: string;
  textColor: string;
  headingColor: string;
  linkColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  buttonBorderRadius: number;
  fontFamily: string;
}

export interface NotificationSettings {
  enabled: boolean;
  expiryRemindersEnabled: boolean;
  manualRemindersEnabled: boolean;
  defaultExpiryReminderHours: number;
  guestsCanSendReminders: boolean;
  guestReminderLimitPerPoll: number;
  userReminderLimitPerPoll: number;
  reminderCooldownMinutes: number;
}

export interface SessionTimeoutSettings {
  enabled: boolean;
  adminTimeoutMinutes: number;
  managerTimeoutMinutes: number;
  userTimeoutMinutes: number;
  showWarningMinutes: number;
}

export interface DeletionRequest {
  id: number;
  userId: number;
  requestedAt: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  processedAt: string | null;
  processedBy: number | null;
  user?: User;
}

export const getImpactBadgeColor = (area: ImpactArea) => {
  switch (area) {
    case 'development': return 'polly-badge-dev-only';
    case 'frontend': return 'polly-badge-frontend';
    case 'backend': return 'polly-badge-backend';
    case 'shared': return 'polly-badge-fullstack';
    default: return 'polly-badge-info';
  }
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export { type User, type PollWithOptions, type SystemSetting, type CustomizationSettings, type FooterLink };
