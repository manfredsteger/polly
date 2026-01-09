import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PollTypeBadge } from "@/components/ui/PollTypeBadge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Users, 
  Activity, 
  BarChart3, 
  TrendingUp,
  Settings,
  Mail,
  Palette,
  Shield,
  Calendar,
  Vote,
  UserCheck,
  Clock,
  Eye,
  EyeOff,
  Trash2,
  Edit2,
  MoreVertical,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database,
  Server,
  FileText,
  PieChart,
  ChevronRight,
  ArrowLeft,
  ExternalLink,
  Lock,
  Key,
  Sliders,
  Timer,
  Archive,
  ShieldCheck,
  UserPlus,
  UserX,
  Building2,
  Loader2,
  AlertCircle,
  PanelLeftClose,
  PanelLeft,
  Paintbrush,
  Upload,
  Image,
  Link2,
  Plus,
  X,
  ClipboardList,
  RotateCcw,
  Moon,
  Sun,
  Monitor,
  Unplug,
  Wifi,
  WifiOff,
  MessageSquare,
  Bell,
  BellRing,
  RefreshCw,
  Target,
  Play,
  Square,
  Search,
  ShieldAlert,
  CheckCircle2,
  Save,
  FlaskConical,
  Download,
  CalendarClock,
  Layers,
  TestTube,
  Workflow,
  File as FileIcon,
  Globe,
  Database as DatabaseIcon,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  Info,
  PlusCircle,
  Send,
  Check
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow, format } from "date-fns";
import { getDateLocale } from "@/lib/i18n";
import type { User, PollWithOptions, SystemSetting, CustomizationSettings, FooterLink } from "@shared/schema";

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
    pollToken?: string;
  }>;
}

interface ComponentStatus {
  name: string;
  version: string;
  latestVersion: string | null;
  eolDate: string | null;
  status: 'current' | 'warning' | 'eol' | 'unknown';
  daysUntilEol: number | null;
  cycle: string;
}

interface SystemStatusData {
  components: ComponentStatus[];
  lastChecked: string;
  cacheExpiresAt: string;
}

type ImpactArea = 'frontend' | 'backend' | 'development' | 'shared';

interface Vulnerability {
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

interface VulnerabilitiesData {
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

interface SystemPackage {
  name: string;
  version: string | null;
  channel: string;
  purpose: string;
  hasKnownIssues: boolean;
  notes: string | null;
}

interface SystemPackagesData {
  packages: SystemPackage[];
  nixChannel: string;
  lastChecked: string;
  cacheExpiresAt: string;
}

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

type SettingsPanel = 'oidc' | 'database' | 'email' | 'email-templates' | 'security' | 'matrix' | 'roles' | 'notifications' | 'session-timeout' | 'pentest' | 'tests' | 'wcag' | null;

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function AdminDashboard({ stats, users, polls, settings, userRole }: AdminDashboardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedPoll, setSelectedPoll] = useState<PollWithOptions | null>(null);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'user' as 'user' | 'admin' | 'manager',
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    email: '',
  });
  const [selectedSettingsPanel, setSelectedSettingsPanel] = useState<SettingsPanel>(null);
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
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchOnWindowFocus: false,
    retry: 1,
    gcTime: 0, // Don't cache failed queries
  });

  const { data: vulnerabilities, isLoading: vulnerabilitiesLoading, refetch: refetchVulnerabilities } = useQuery<VulnerabilitiesData>({
    queryKey: ['/api/v1/admin/vulnerabilities'],
    staleTime: 1000 * 60 * 60 * 6, // 6 hours
    refetchOnWindowFocus: false,
  });

  const { data: systemPackages, isLoading: systemPackagesLoading, refetch: refetchSystemPackages } = useQuery<SystemPackagesData>({
    queryKey: ['/api/v1/admin/system-packages'],
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnWindowFocus: false,
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      toast({ title: t('admin.toast.error'), description: t('admin.toast.updateFailed'), variant: "destructive" });
    } finally {
      setSystemPackagesRefreshing(false);
    }
  };

  const getImpactBadgeColor = (area: ImpactArea) => {
    switch (area) {
      case 'development': return 'polly-badge-dev-only';
      case 'frontend': return 'polly-badge-frontend';
      case 'backend': return 'polly-badge-backend';
      case 'shared': return 'polly-badge-fullstack';
      default: return 'polly-badge-info';
    }
  };

  const formatTimeUntil = (date: Date | string) => {
    const target = new Date(date);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) return t('common.now');
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}${t('common.hoursShort')} ${minutes}min`;
    return `${minutes}min`;
  };

  // Check if external deprovisioning is enabled (disables manual user deletion)
  const { data: deprovisionStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/v1/admin/deprovision-settings'],
    select: (data) => ({ enabled: data?.enabled || false }),
  });
  const isDeprovisionEnabled = deprovisionStatus?.enabled || false;

  const updatePollMutation = useMutation({
    mutationFn: async ({ pollId, updates }: { pollId: string; updates: any }) => {
      const response = await apiRequest("PATCH", `/api/v1/admin/polls/${pollId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toast.pollUpdated'), description: t('admin.toast.pollUpdatedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/polls'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/extended-stats'] });
    },
    onError: () => {
      toast({ title: t('admin.toast.error'), description: t('admin.toast.pollUpdateError'), variant: "destructive" });
    },
  });

  const deletePollMutation = useMutation({
    mutationFn: async (pollId: string) => {
      const response = await apiRequest("DELETE", `/api/v1/admin/polls/${pollId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toast.pollDeleted'), description: t('admin.toast.pollDeletedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/polls'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/extended-stats'] });
      setSelectedPoll(null);
    },
    onError: () => {
      toast({ title: t('admin.toast.error'), description: t('admin.toast.pollDeleteError'), variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: number; updates: any }) => {
      const response = await apiRequest("PATCH", `/api/v1/admin/users/${userId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toast.userUpdated'), description: t('admin.toast.userUpdatedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/users'] });
    },
    onError: () => {
      toast({ title: t('admin.toast.error'), description: t('admin.toast.userUpdateError'), variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUserForm) => {
      const response = await apiRequest("POST", `/api/v1/admin/users`, userData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('admin.toast.userCreateError'));
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toast.userCreated'), description: t('admin.toast.userCreatedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/users'] });
      setShowAddUserDialog(false);
      setNewUserForm({ name: '', email: '', username: '', password: '', role: 'user' });
    },
    onError: (error: Error) => {
      toast({ title: t('admin.toast.error'), description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/v1/admin/users/${userId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.code === 'MANUAL_DELETE_DISABLED' 
          ? t('admin.toast.manualDeleteDisabled')
          : error.error || t('admin.toast.userDeleteError'));
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toast.userDeleted'), description: t('admin.toast.userDeletedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/extended-stats'] });
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({ title: t('admin.toast.error'), description: error.message || t('admin.toast.userDeleteError'), variant: "destructive" });
    },
  });

  const displayStats = extendedStats || {
    totalUsers: stats?.totalUsers || 0,
    activePolls: stats?.activePolls || 0,
    inactivePolls: 0,
    totalPolls: stats?.activePolls || 0,
    totalVotes: stats?.totalVotes || 0,
    monthlyPolls: stats?.monthlyPolls || 0,
    weeklyPolls: 0,
    todayPolls: 0,
    schedulePolls: 0,
    surveyPolls: 0,
    recentActivity: [],
  };

  const handleStatCardClick = (target: string) => {
    setSelectedUser(null);
    setSelectedPoll(null);
    setActiveTab(target);
  };

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    setSelectedPoll(null);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserForm({
      name: user.name || '',
      email: user.email || '',
    });
  };

  const handlePollClick = (poll: PollWithOptions) => {
    setSelectedPoll(poll);
  };

  const handleBackToUsers = () => {
    setSelectedUser(null);
    setSelectedPoll(null);
  };

  const handleBackToPolls = () => {
    setSelectedPoll(null);
  };

  const getUserPolls = (userId: number) => {
    return polls?.filter(p => p.userId === userId) || [];
  };

  return (
    <TooltipProvider>
      <div className="flex gap-3">
        {/* Sidebar Navigation - Compact icons or expanded with labels */}
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
                <NavButton collapsed={sidebarCollapsed} active={activeTab === "overview"} onClick={() => { setActiveTab("overview"); setSelectedUser(null); setSelectedPoll(null); setSelectedSettingsPanel(null); }} icon={<BarChart3 className="w-4 h-4" />} label={t('admin.nav.dashboard')} testId="nav-overview" />
                <NavButton collapsed={sidebarCollapsed} active={activeTab === "monitoring"} onClick={() => { setActiveTab("monitoring"); setSelectedUser(null); setSelectedPoll(null); setSelectedSettingsPanel(null); }} icon={<Activity className="w-4 h-4" />} label={t('admin.nav.monitoring')} testId="nav-monitoring" />
                <NavButton collapsed={sidebarCollapsed} active={activeTab === "polls"} onClick={() => { setActiveTab("polls"); setSelectedUser(null); setSelectedPoll(null); setSelectedSettingsPanel(null); }} icon={<Vote className="w-4 h-4" />} label={t('admin.nav.polls')} testId="nav-polls" />
                <NavButton collapsed={sidebarCollapsed} active={activeTab === "users"} onClick={() => { setActiveTab("users"); setSelectedUser(null); setSelectedPoll(null); setSelectedSettingsPanel(null); }} icon={<Users className="w-4 h-4" />} label={t('admin.nav.users')} testId="nav-users" />
                <NavButton collapsed={sidebarCollapsed} active={activeTab === "customize"} onClick={() => { setActiveTab("customize"); setSelectedUser(null); setSelectedPoll(null); setSelectedSettingsPanel(null); }} icon={<Paintbrush className="w-4 h-4" />} label={t('admin.nav.customize')} testId="nav-customize" />
                <NavButton collapsed={sidebarCollapsed} active={activeTab === "settings"} onClick={() => { setActiveTab("settings"); setSelectedUser(null); setSelectedPoll(null); setSelectedSettingsPanel(null); }} icon={<Settings className="w-4 h-4" />} label={t('admin.nav.settings')} testId="nav-settings" />
                <NavButton collapsed={sidebarCollapsed} active={activeTab === "tests"} onClick={() => { setActiveTab("tests"); setSelectedUser(null); setSelectedPoll(null); setSelectedSettingsPanel(null); }} icon={<FlaskConical className="w-4 h-4" />} label={t('admin.nav.tests')} testId="nav-tests" />
                <NavButton collapsed={sidebarCollapsed} active={activeTab === "deletion-requests"} onClick={() => { setActiveTab("deletion-requests"); setSelectedUser(null); setSelectedPoll(null); setSelectedSettingsPanel(null); }} icon={<UserX className="w-4 h-4" />} label={t('admin.nav.deletionRequests')} testId="nav-deletion-requests" />
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Takes remaining space */}
        <div className="flex-1 min-w-0">
        {/* Overview Dashboard */}
        {activeTab === "overview" && !selectedUser && !selectedPoll && (
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
                onClick={() => handleStatCardClick("users")}
                testId="stat-users"
              />
              <StatCard 
                icon={<Vote />} 
                label={t('admin.overview.activePollsLabel')} 
                value={displayStats.activePolls} 
                color="green" 
                onClick={() => handleStatCardClick("polls")}
                testId="stat-active-polls"
              />
              <StatCard 
                icon={<BarChart3 />} 
                label={t('admin.overview.votesLabel')} 
                value={displayStats.totalVotes} 
                color="purple" 
                onClick={() => handleStatCardClick("monitoring")}
                testId="stat-votes"
              />
              <StatCard 
                icon={<TrendingUp />} 
                label={t('admin.overview.thisMonth')} 
                value={displayStats.monthlyPolls} 
                color="orange" 
                onClick={() => handleStatCardClick("polls")}
                testId="stat-monthly"
              />
            </div>

            {/* Secondary Stats - Clickable */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card 
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleStatCardClick("polls")}
                data-testid="stat-schedule-polls"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('admin.overview.schedulePolls')}</p>
                    <p className="text-xl font-bold">{displayStats.schedulePolls}</p>
                  </div>
                  <Calendar className="w-6 h-6 text-polly-orange" />
                </div>
              </Card>
              <Card 
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleStatCardClick("polls")}
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
                      onClick={handleRefreshSystemStatus}
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
                                <span className="ml-1 text-xs text-amber-600">
                                  (Latest: {component.latestVersion})
                                </span>
                              )}
                            </td>
                            <td className="py-2">
                              {component.status === 'current' && (
                                <Badge className="polly-badge-success">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  {t('admin.monitoring.current')}
                                </Badge>
                              )}
                              {component.status === 'warning' && (
                                <Badge className="polly-badge-warning">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  {t('admin.monitoring.warning')}
                                </Badge>
                              )}
                              {component.status === 'eol' && (
                                <Badge className="polly-badge-error">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  {t('admin.monitoring.eol')}
                                </Badge>
                              )}
                              {component.status === 'unknown' && (
                                <Badge variant="secondary">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  {t('admin.monitoring.unknown')}
                                </Badge>
                              )}
                            </td>
                            <td className="py-2 text-muted-foreground">
                              {component.eolDate ? (
                                <span className={component.status === 'eol' ? 'text-red-600 dark:text-red-400' : component.status === 'warning' ? 'text-amber-600 dark:text-amber-400' : ''}>
                                  {format(new Date(component.eolDate), 'MMM yyyy', { locale: getDateLocale() })}
                                  {component.daysUntilEol !== null && component.daysUntilEol > 0 && (
                                    <span className="ml-1 text-xs">
                                      ({component.daysUntilEol} {t('admin.monitoring.daysUntilEol')})
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">{t('admin.monitoring.noSystemPackages')}</p>
                )}
              </CardContent>
            </Card>

            {/* Security Vulnerabilities */}
            <Card className="polly-card" data-testid="vulnerabilities-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center">
                    <ShieldAlert className="w-5 h-5 mr-2" />
                    {t('admin.monitoring.securityCheck')}
                  </CardTitle>
                  <div className="flex items-center gap-3 flex-wrap">
                    {vulnerabilities?.summary && vulnerabilities.summary.total > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {vulnerabilities.summary.critical > 0 && (
                          <Badge className="polly-badge-critical" data-testid="badge-critical">
                            {vulnerabilities.summary.critical} {t('admin.monitoring.critical')}
                          </Badge>
                        )}
                        {vulnerabilities.summary.high > 0 && (
                          <Badge className="polly-badge-high" data-testid="badge-high">
                            {vulnerabilities.summary.high} {t('admin.monitoring.high')}
                          </Badge>
                        )}
                        {vulnerabilities.summary.moderate > 0 && (
                          <Badge className="polly-badge-moderate" data-testid="badge-moderate">
                            {vulnerabilities.summary.moderate} {t('admin.monitoring.moderate')}
                          </Badge>
                        )}
                        {vulnerabilities.summary.low > 0 && (
                          <Badge variant="secondary" data-testid="badge-low">
                            {vulnerabilities.summary.low} {t('admin.monitoring.low')}
                          </Badge>
                        )}
                      </div>
                    )}
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
                      onClick={handleRefreshVulnerabilities}
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
                ) : vulnerabilities?.vulnerabilities && vulnerabilities.vulnerabilities.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">{t('admin.monitoring.packageName')}</th>
                          <th className="text-left py-2 font-medium">{t('admin.monitoring.impactArea')}</th>
                          <th className="text-left py-2 font-medium">{t('admin.monitoring.severity')}</th>
                          <th className="text-left py-2 font-medium">{t('polls.description')}</th>
                          <th className="text-left py-2 font-medium">Fix</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vulnerabilities.vulnerabilities.map((vuln, index) => (
                          <tr key={`${vuln.name}-${index}`} className="border-b last:border-0" data-testid={`vuln-row-${vuln.name}`}>
                            <td className="py-2 font-medium">
                              {vuln.name}
                              {vuln.isDirect && (
                                <Badge variant="outline" className="ml-1 text-xs">Direkt</Badge>
                              )}
                            </td>
                            <td className="py-2">
                              <Badge className={getImpactBadgeColor(vuln.impactArea)}>
                                {vuln.impactLabel}
                              </Badge>
                            </td>
                            <td className="py-2">
                              {vuln.severity === 'critical' && (
                                <Badge className="polly-badge-critical">{t('admin.monitoring.critical')}</Badge>
                              )}
                              {vuln.severity === 'high' && (
                                <Badge className="polly-badge-high">{t('admin.monitoring.high')}</Badge>
                              )}
                              {vuln.severity === 'moderate' && (
                                <Badge className="polly-badge-moderate">{t('admin.monitoring.moderate')}</Badge>
                              )}
                              {vuln.severity === 'low' && (
                                <Badge variant="secondary">{t('admin.monitoring.low')}</Badge>
                              )}
                              {vuln.severity === 'info' && (
                                <Badge variant="outline">{t('admin.monitoring.info')}</Badge>
                              )}
                            </td>
                            <td className="py-2 max-w-xs">
                              <div className="truncate" title={vuln.title}>
                                {vuln.url ? (
                                  <a href={vuln.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                                    {vuln.title}
                                    {vuln.cve && <span className="ml-1 text-xs text-muted-foreground">({vuln.cve})</span>}
                                  </a>
                                ) : (
                                  <span>{vuln.title}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2">
                              {vuln.patchedVersions ? (
                                <span className="text-green-600 dark:text-green-400 text-xs font-mono">
                                  {vuln.patchedVersions}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">{t('admin.monitoring.noVulnerabilities')}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {vulnerabilities.impactSummary && (
                      <div className="mt-4 pt-4 border-t flex flex-wrap gap-2 text-xs">
                        <span className="text-muted-foreground">{t('admin.monitoring.impactArea')}:</span>
                        {vulnerabilities.impactSummary.development > 0 && (
                          <Badge className="bg-gray-500 text-white border-0">{vulnerabilities.impactSummary.development}x Development</Badge>
                        )}
                        {vulnerabilities.impactSummary.backend > 0 && (
                          <Badge className="bg-orange-500 text-white border-0">{vulnerabilities.impactSummary.backend}x Backend</Badge>
                        )}
                        {vulnerabilities.impactSummary.frontend > 0 && (
                          <Badge className="bg-red-500 text-white border-0">{vulnerabilities.impactSummary.frontend}x Frontend</Badge>
                        )}
                        {vulnerabilities.impactSummary.shared > 0 && (
                          <Badge className="bg-indigo-500 text-white border-0">{vulnerabilities.impactSummary.shared}x Shared</Badge>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    <span>{t('admin.monitoring.noVulnerabilities')}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Packages (Nix) */}
            <Card className="polly-card" data-testid="system-packages-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center">
                    <Layers className="w-5 h-5 mr-2" />
                    {t('admin.monitoring.systemPackages')}
                  </CardTitle>
                  <div className="flex items-center gap-3 flex-wrap">
                    {systemPackages && (
                      <Badge variant="secondary">
                        {systemPackages.packages.length} Packages
                      </Badge>
                    )}
                    {systemPackages?.lastChecked && (
                      <div className="text-xs text-muted-foreground text-right">
                        <div>Channel: {systemPackages.nixChannel}</div>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshSystemPackages}
                      disabled={systemPackagesRefreshing || systemPackagesLoading}
                      data-testid="refresh-system-packages"
                    >
                      <RefreshCw className={`w-4 h-4 mr-1 ${systemPackagesRefreshing ? 'animate-spin' : ''}`} />
                      {t('common.refresh')}
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  {t('admin.monitoring.systemPackagesDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {systemPackagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : systemPackages?.packages && systemPackages.packages.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">{t('admin.monitoring.package')}</th>
                          <th className="text-left py-2 font-medium">{t('admin.monitoring.version')}</th>
                          <th className="text-left py-2 font-medium">{t('admin.monitoring.usage')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {systemPackages.packages.map((pkg, index) => (
                          <tr key={`${pkg.name}-${index}`} className="border-b last:border-0" data-testid={`pkg-row-${pkg.name}`}>
                            <td className="py-2 font-medium font-mono text-xs">{pkg.name}</td>
                            <td className="py-2 text-muted-foreground text-xs font-mono">
                              {pkg.version || '-'}
                            </td>
                            <td className="py-2 text-muted-foreground text-xs">
                              {pkg.purpose}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <span>{t('admin.monitoring.noSystemPackages')}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="polly-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  {t('admin.overview.recentActivity')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {displayStats.recentActivity.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{t('admin.overview.noRecentActivity')}</p>
                ) : (
                  <div className="space-y-3">
                    {displayStats.recentActivity.map((activity, index) => (
                      <ActivityItem key={index} activity={activity} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Monitoring */}
        {activeTab === "monitoring" && !selectedUser && !selectedPoll && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">{t('admin.monitoring.title')}</h2>
            
            {/* System Health */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 border-l-4 border-l-green-500" data-testid="status-api-server">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="font-medium">{t('admin.monitoring.apiServer')}</p>
                    <p className="text-sm text-muted-foreground">{t('admin.monitoring.activeReachable')}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border-l-4 border-l-green-500" data-testid="status-database">
                <div className="flex items-center space-x-3">
                  <Database className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="font-medium">{t('admin.monitoring.database')}</p>
                    <p className="text-sm text-muted-foreground">{t('admin.monitoring.postgresConnected')}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border-l-4 border-l-green-500" data-testid="status-auth">
                <div className="flex items-center space-x-3">
                  <Shield className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="font-medium">{t('admin.monitoring.authentication')}</p>
                    <p className="text-sm text-muted-foreground">{t('admin.monitoring.sessionActive')}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Poll Statistics */}
            <Card className="polly-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="w-5 h-5 mr-2" />
                  {t('admin.monitoring.pollStatistics')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center cursor-pointer hover:bg-muted/50 p-3 rounded-lg" onClick={() => handleStatCardClick("polls")} data-testid="chart-active-polls">
                    <div className="text-4xl font-bold text-green-600">{displayStats.activePolls}</div>
                    <p className="text-sm text-muted-foreground mt-1">{t('admin.monitoring.active')}</p>
                  </div>
                  <div className="text-center cursor-pointer hover:bg-muted/50 p-3 rounded-lg" onClick={() => handleStatCardClick("polls")} data-testid="chart-inactive-polls">
                    <div className="text-4xl font-bold text-gray-400">{displayStats.inactivePolls}</div>
                    <p className="text-sm text-muted-foreground mt-1">{t('admin.monitoring.inactive')}</p>
                  </div>
                  <div className="text-center cursor-pointer hover:bg-muted/50 p-3 rounded-lg" onClick={() => handleStatCardClick("polls")} data-testid="chart-schedule-polls">
                    <div className="text-4xl font-bold text-polly-orange">{displayStats.schedulePolls}</div>
                    <p className="text-sm text-muted-foreground mt-1">{t('admin.overview.schedulePolls')}</p>
                  </div>
                  <div className="text-center cursor-pointer hover:bg-muted/50 p-3 rounded-lg" onClick={() => handleStatCardClick("polls")} data-testid="chart-survey-polls">
                    <div className="text-4xl font-bold text-polly-blue">{displayStats.surveyPolls}</div>
                    <p className="text-sm text-muted-foreground mt-1">{t('admin.nav.polls')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card className="polly-card">
              <CardHeader>
                <CardTitle>{t('admin.monitoring.activityTimeline')}</CardTitle>
                <CardDescription>{t('admin.monitoring.activityTimelineDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative pl-6 space-y-4">
                  {displayStats.recentActivity.length === 0 ? (
                    <p className="text-muted-foreground">{t('admin.monitoring.noActivities')}</p>
                  ) : (
                    displayStats.recentActivity.map((activity, index) => (
                      <div key={index} className="relative">
                        <div className="absolute -left-6 top-1 w-3 h-3 bg-polly-orange rounded-full" />
                        <div className="ml-2">
                          {activity.pollToken ? (
                            <a 
                              href={`/poll/${activity.pollToken}`}
                              className="text-sm font-medium hover:text-polly-orange hover:underline cursor-pointer transition-colors"
                              data-testid={`activity-link-${index}`}
                            >
                              {activity.message}
                              <ExternalLink className="inline-block w-3 h-3 ml-1 opacity-50" />
                            </a>
                          ) : (
                            <p className="text-sm font-medium">{activity.message}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {activity.actor && <span className="font-medium">{activity.actor} • </span>}
                            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: getDateLocale() })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Polls Management */}
        {activeTab === "polls" && !selectedPoll && (
          <div className="space-y-6">
            {/* Breadcrumb */}
            {selectedUser && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Button variant="ghost" size="sm" onClick={handleBackToUsers}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  {t('admin.polls.backToUsers')}
                </Button>
                <ChevronRight className="w-4 h-4" />
                <span className="font-medium text-foreground">{t('admin.polls.pollsOfUser', { name: selectedUser.name })}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-foreground">
                {selectedUser ? t('admin.polls.pollsOf', { name: selectedUser.name }) : t('admin.polls.title')}
              </h2>
              <Badge variant="outline">
                {t('admin.polls.pollsCount', { count: selectedUser ? getUserPolls(selectedUser.id).length : polls?.length || 0 })}
              </Badge>
            </div>
            
            <Card className="polly-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.polls.tableTitle')}</TableHead>
                      <TableHead>{t('admin.polls.tableType')}</TableHead>
                      <TableHead>{t('admin.polls.tableCreator')}</TableHead>
                      <TableHead>{t('admin.polls.tableParticipants')}</TableHead>
                      <TableHead>{t('admin.polls.tableStatus')}</TableHead>
                      <TableHead>{t('admin.polls.tableCreated')}</TableHead>
                      <TableHead className="text-right">{t('admin.polls.tableActions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const pollsToShow = selectedUser ? getUserPolls(selectedUser.id) : polls;
                      if (!pollsToShow || pollsToShow.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-12">
                              <Vote className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                              <p className="text-muted-foreground">{t('admin.polls.noPolls')}</p>
                            </TableCell>
                          </TableRow>
                        );
                      }
                      return pollsToShow.map((poll) => (
                        <TableRow 
                          key={poll.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handlePollClick(poll)}
                          data-testid={`poll-row-${poll.id}`}
                        >
                          <TableCell className="font-medium">{poll.title}</TableCell>
                          <TableCell>
                            <PollTypeBadge type={poll.type as 'schedule' | 'survey' | 'organization'} variant="solid" />
                          </TableCell>
                          <TableCell>
                            {poll.user ? (
                              <span 
                                className="text-primary hover:underline cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (poll.user) handleUserClick(poll.user);
                                }}
                              >
                                {poll.user.name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{t('admin.polls.anonymous')}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Set(poll.votes.map(v => v.userId ? `user_${v.userId}` : `anon_${v.voterName}`)).size}
                          </TableCell>
                          <TableCell>
                            <Badge variant={poll.isActive ? 'default' : 'secondary'}>
                              {poll.isActive ? t('admin.polls.active') : t('admin.polls.inactive')}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(poll.createdAt), 'dd.MM.yyyy', { locale: getDateLocale() })}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" data-testid={`menu-poll-${poll.id}`}>
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => window.open(`/poll/${poll.publicToken}`, '_blank')}>
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    {t('admin.polls.view')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handlePollClick(poll)}>
                                    <Edit2 className="w-4 h-4 mr-2" />
                                    {t('admin.polls.details')}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => updatePollMutation.mutate({ pollId: poll.id, updates: { isActive: !poll.isActive } })}
                                    disabled={updatePollMutation.isPending}
                                  >
                                    {poll.isActive ? (
                                      <>
                                        <XCircle className="w-4 h-4 mr-2" />
                                        {t('admin.polls.deactivate')}
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        {t('admin.polls.activate')}
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem 
                                        className="text-destructive focus:text-destructive"
                                        onSelect={(e) => e.preventDefault()}
                                        data-testid={`delete-poll-${poll.id}`}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        {t('admin.polls.delete')}
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>{t('admin.polls.deletePollTitle')}</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          {t('admin.polls.deletePollDescription', { title: poll.title })}
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                        <AlertDialogAction 
                                          onClick={() => deletePollMutation.mutate(poll.id)} 
                                          className="bg-destructive text-destructive-foreground"
                                        >
                                          {t('common.delete')}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Poll Detail View */}
        {selectedPoll && (
          <PollDetailView 
            poll={selectedPoll}
            onBack={handleBackToPolls}
            onDelete={() => deletePollMutation.mutate(selectedPoll.id)}
            onToggleActive={(active) => updatePollMutation.mutate({ pollId: selectedPoll.id, updates: { isActive: active } })}
            onToggleResultsPublic={(resultsPublic) => updatePollMutation.mutate({ pollId: selectedPoll.id, updates: { resultsPublic } })}
            isDeleting={deletePollMutation.isPending}
            isUpdating={updatePollMutation.isPending}
          />
        )}

        {/* Users Management */}
        {activeTab === "users" && !selectedUser && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-foreground">{t('admin.users.title')}</h2>
              <div className="flex items-center gap-3">
                <Button 
                  onClick={() => setShowAddUserDialog(true)}
                  className="polly-button-primary"
                  data-testid="button-add-user"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {t('admin.users.addUser')}
                </Button>
                <Badge variant="outline">{t('admin.users.usersCount', { count: users?.length || 0 })}</Badge>
              </div>
            </div>
            
            {/* Add User Dialog */}
            <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    {t('admin.users.createUserTitle')}
                  </DialogTitle>
                  <DialogDescription>
                    {t('admin.users.createUserDescription')}
                  </DialogDescription>
                </DialogHeader>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    createUserMutation.mutate(newUserForm);
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="newUserName">{t('admin.users.nameLabel')}</Label>
                    <Input
                      id="newUserName"
                      placeholder={t('admin.users.namePlaceholder')}
                      value={newUserForm.name}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, name: e.target.value }))}
                      data-testid="input-new-user-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newUserEmail">{t('admin.users.emailLabel')}</Label>
                    <Input
                      id="newUserEmail"
                      type="email"
                      placeholder={t('admin.users.emailPlaceholder')}
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                      data-testid="input-new-user-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newUserUsername">{t('admin.users.usernameLabel')}</Label>
                    <Input
                      id="newUserUsername"
                      placeholder={t('admin.users.usernamePlaceholder')}
                      value={newUserForm.username}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, username: e.target.value }))}
                      data-testid="input-new-user-username"
                    />
                    <p className="text-xs text-muted-foreground">{t('admin.users.usernameHint')}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newUserPassword">{t('admin.users.passwordLabel')}</Label>
                    <Input
                      id="newUserPassword"
                      type="password"
                      placeholder={t('admin.users.passwordPlaceholder')}
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                      data-testid="input-new-user-password"
                    />
                    {newUserForm.password.length > 0 && (
                      <div className="space-y-1 mt-2 p-2 bg-muted/50 rounded text-xs">
                        <div className={newUserForm.password.length >= 8 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {newUserForm.password.length >= 8 ? '✓' : '○'} {t('admin.users.passwordRequirements.minLength')}
                        </div>
                        <div className={/[A-Z]/.test(newUserForm.password) ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {/[A-Z]/.test(newUserForm.password) ? '✓' : '○'} {t('admin.users.passwordRequirements.uppercase')}
                        </div>
                        <div className={/[a-z]/.test(newUserForm.password) ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {/[a-z]/.test(newUserForm.password) ? '✓' : '○'} {t('admin.users.passwordRequirements.lowercase')}
                        </div>
                        <div className={/[0-9]/.test(newUserForm.password) ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {/[0-9]/.test(newUserForm.password) ? '✓' : '○'} {t('admin.users.passwordRequirements.number')}
                        </div>
                        <div className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newUserForm.password) ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newUserForm.password) ? '✓' : '○'} {t('admin.users.passwordRequirements.special')}
                        </div>
                      </div>
                    )}
                    {newUserForm.password.length === 0 && (
                      <p className="text-xs text-muted-foreground">{t('admin.users.passwordHint')}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newUserRole">{t('admin.users.roleLabel')}</Label>
                    <Select
                      value={newUserForm.role}
                      onValueChange={(value: 'user' | 'admin' | 'manager') => setNewUserForm(prev => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger data-testid="select-new-user-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">{t('admin.roleUser')}</SelectItem>
                        <SelectItem value="manager">{t('admin.roleManager')}</SelectItem>
                        <SelectItem value="admin">{t('admin.roleAdmin')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowAddUserDialog(false)}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button 
                      type="submit" 
                      className="polly-button-primary"
                      disabled={
                        createUserMutation.isPending || 
                        !newUserForm.name || 
                        !newUserForm.email || 
                        !newUserForm.username || 
                        !newUserForm.password ||
                        newUserForm.password.length < 8 ||
                        !/[A-Z]/.test(newUserForm.password) ||
                        !/[a-z]/.test(newUserForm.password) ||
                        !/[0-9]/.test(newUserForm.password) ||
                        !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newUserForm.password) ||
                        newUserForm.username.length < 3 ||
                        !/^[a-zA-Z0-9_]+$/.test(newUserForm.username)
                      }
                      data-testid="button-create-user"
                    >
                      {createUserMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t('admin.users.creating')}
                        </>
                      ) : (
                        t('admin.users.createUserButton')
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            
            {/* Edit User Dialog */}
            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Edit2 className="w-5 h-5" />
                    {t('admin.users.editUserTitle')}
                  </DialogTitle>
                  <DialogDescription>
                    {t('admin.users.editUserDescription')}
                  </DialogDescription>
                </DialogHeader>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editingUser) {
                      updateUserMutation.mutate(
                        { userId: editingUser.id, updates: editUserForm },
                        { onSuccess: () => setEditingUser(null) }
                      );
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="editUserName">{t('admin.users.fullName')}</Label>
                    <Input
                      id="editUserName"
                      placeholder={t('admin.users.namePlaceholder')}
                      value={editUserForm.name}
                      onChange={(e) => setEditUserForm(prev => ({ ...prev, name: e.target.value }))}
                      data-testid="input-edit-user-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editUserEmail">{t('admin.users.emailAddress')}</Label>
                    <Input
                      id="editUserEmail"
                      type="email"
                      placeholder={t('admin.users.emailPlaceholder')}
                      value={editUserForm.email}
                      onChange={(e) => setEditUserForm(prev => ({ ...prev, email: e.target.value }))}
                      data-testid="input-edit-user-email"
                    />
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>{t('auth.username')}:</strong> @{editingUser?.username}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('admin.users.usernameCannotChange')}
                    </p>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setEditingUser(null)}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button 
                      type="submit" 
                      className="polly-button-primary"
                      disabled={updateUserMutation.isPending || !editUserForm.name || !editUserForm.email}
                      data-testid="button-save-user"
                    >
                      {updateUserMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t('admin.users.saving')}
                        </>
                      ) : (
                        t('common.save')
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            
            <Card className="polly-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('auth.name')}</TableHead>
                      <TableHead>{t('auth.email')}</TableHead>
                      <TableHead>{t('auth.username')}</TableHead>
                      <TableHead>{t('admin.role')}</TableHead>
                      <TableHead>{t('admin.nav.polls')}</TableHead>
                      <TableHead>{t('admin.polls.tableCreated')}</TableHead>
                      <TableHead className="text-right">{t('admin.users.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!users || users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">{t('admin.polls.noPolls')}</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow 
                          key={user.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleUserClick(user)}
                          data-testid={`user-row-${user.id}`}
                        >
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-polly-orange rounded-full flex items-center justify-center text-white text-sm font-medium">
                                {user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                              </div>
                              <span className="font-medium">{user.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell className="text-muted-foreground">@{user.username}</TableCell>
                          <TableCell>
                            <RoleBadge role={user.role} />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{getUserPolls(user.id).length}</Badge>
                          </TableCell>
                          <TableCell>{format(new Date(user.createdAt), 'dd.MM.yyyy', { locale: getDateLocale() })}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-1" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" data-testid={`menu-user-${user.id}`}>
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {user.provider === 'local' && (
                                    <>
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditUser(user); }}>
                                        <Edit2 className="w-4 h-4 mr-2" />
                                        {t('admin.users.edit')}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  <DropdownMenuLabel>{t('admin.users.changeRole')}</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => updateUserMutation.mutate({ userId: user.id, updates: { role: 'user' } })} disabled={user.role === 'user'}>
                                    <Users className="w-4 h-4 mr-2" />
                                    {t('admin.roleUser')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateUserMutation.mutate({ userId: user.id, updates: { role: 'manager' } })} disabled={user.role === 'manager'}>
                                    <UserCheck className="w-4 h-4 mr-2" />
                                    {t('admin.roleManager')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateUserMutation.mutate({ userId: user.id, updates: { role: 'admin' } })} disabled={user.role === 'admin'}>
                                    <Shield className="w-4 h-4 mr-2" />
                                    {t('admin.roleAdmin')}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {isDeprovisionEnabled ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <DropdownMenuItem disabled className="text-muted-foreground cursor-not-allowed">
                                            <Unplug className="w-4 h-4 mr-2" />
                                            {t('admin.users.deleteExternal')}
                                          </DropdownMenuItem>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{t('admin.users.deleteExternalDescription')}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                          <Trash2 className="w-4 h-4 mr-2" />
                                          {t('common.delete')}
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>{t('admin.users.deleteUserTitle')}</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            {t('admin.users.deleteUserDescription', { name: user.name })}
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteUserMutation.mutate(user.id)} className="bg-destructive text-destructive-foreground">
                                            {t('common.delete')}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* User Detail View */}
        {activeTab === "users" && selectedUser && !selectedPoll && (
          <UserDetailView 
            user={selectedUser}
            polls={getUserPolls(selectedUser.id)}
            onBack={handleBackToUsers}
            onPollClick={handlePollClick}
            onUpdateRole={(role) => updateUserMutation.mutate({ userId: selectedUser.id, updates: { role } })}
            onUpdateUser={(updates) => updateUserMutation.mutate({ userId: selectedUser.id, updates })}
            onDelete={() => deleteUserMutation.mutate(selectedUser.id)}
            isDeleting={deleteUserMutation.isPending}
            isUpdating={updateUserMutation.isPending}
            isDeprovisionEnabled={isDeprovisionEnabled}
          />
        )}

        {/* Settings - Overview */}
        {activeTab === "settings" && !selectedUser && !selectedPoll && !selectedSettingsPanel && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">{t('admin.settings.title')}</h2>
            <p className="text-muted-foreground">{t('admin.settings.description')}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SettingCard
                title={t('admin.settings.authentication.title')}
                description={t('admin.settings.authentication.description')}
                icon={<Key className="w-6 h-6" />}
                status={t('admin.settings.status.available')}
                statusType="success"
                onClick={() => setSelectedSettingsPanel('oidc')}
                testId="settings-oidc"
              />
              
              <SettingCard
                title={t('admin.settings.database.title')}
                description={t('admin.settings.database.description')}
                icon={<Database className="w-6 h-6" />}
                status={t('admin.settings.status.connected')}
                statusType="success"
                onClick={() => setSelectedSettingsPanel('database')}
                testId="settings-database"
              />
              
              <SettingCard
                title={t('admin.settings.email.title')}
                description={t('admin.settings.email.description')}
                icon={<Mail className="w-6 h-6" />}
                status={t('admin.monitoring.active')}
                statusType="success"
                onClick={() => setSelectedSettingsPanel('email')}
                testId="settings-email"
              />
              
              <SettingCard
                title={t('admin.settings.emailTemplates.title')}
                description={t('admin.settings.emailTemplates.description')}
                icon={<FileText className="w-6 h-6" />}
                status={t('admin.settings.status.templates', { count: 8 })}
                statusType="neutral"
                onClick={() => setSelectedSettingsPanel('email-templates')}
                testId="settings-email-templates"
              />
              
              <SettingCard
                title={t('admin.settings.security.title')}
                description={t('admin.settings.security.description')}
                icon={<ShieldCheck className="w-6 h-6" />}
                status={t('admin.settings.status.enabled')}
                statusType="success"
                onClick={() => setSelectedSettingsPanel('security')}
                testId="settings-security"
              />
              
              <SettingCard
                title={t('admin.settings.notifications.title')}
                description={t('admin.settings.notifications.description')}
                icon={<Bell className="w-6 h-6" />}
                status={t('admin.settings.status.configurable')}
                statusType="neutral"
                onClick={() => setSelectedSettingsPanel('notifications')}
                testId="settings-notifications"
              />
              
              <SettingCard
                title={t('admin.settings.roles.title')}
                description={t('admin.settings.roles.description')}
                icon={<Shield className="w-6 h-6" />}
                status={t('admin.settings.status.roles', { count: 3 })}
                statusType="neutral"
                onClick={() => setSelectedSettingsPanel('roles')}
                testId="settings-roles"
              />
              
              <SettingCard
                title={t('admin.settings.sessionTimeout.title')}
                description={t('admin.settings.sessionTimeout.description')}
                icon={<Timer className="w-6 h-6" />}
                status={t('admin.settings.status.configurable')}
                statusType="neutral"
                onClick={() => setSelectedSettingsPanel('session-timeout')}
                testId="settings-session-timeout"
              />
              
              <SettingCard
                title={t('admin.settings.wcag.title')}
                description={t('admin.settings.wcag.description')}
                icon={<Eye className="w-6 h-6" />}
                status={t('admin.settings.status.configurable')}
                statusType="neutral"
                onClick={() => setSelectedSettingsPanel('wcag')}
                testId="settings-wcag"
              />
            </div>
            
            {/* Integrationen Section */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Unplug className="w-5 h-5" />
                {t('admin.settings.integrations.title')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SettingCard
                  title={t('admin.settings.integrations.matrix.title')}
                  description={t('admin.settings.integrations.matrix.description')}
                  icon={<MessageSquare className="w-6 h-6" />}
                  status={t('admin.settings.status.optional')}
                  statusType="neutral"
                  onClick={() => setSelectedSettingsPanel('matrix')}
                  testId="settings-matrix"
                />
                
                <SettingCard
                  title={t('admin.settings.integrations.pentest.title')}
                  description={t('admin.settings.integrations.pentest.description')}
                  icon={<Shield className="w-6 h-6" />}
                  status="Pro"
                  statusType="neutral"
                  onClick={() => setSelectedSettingsPanel('pentest')}
                  testId="settings-pentest"
                />
              </div>
            </div>
          </div>
        )}

        {/* OIDC Settings Panel */}
        {activeTab === "settings" && selectedSettingsPanel === 'oidc' && (
          <OIDCSettingsPanel onBack={() => setSelectedSettingsPanel(null)} />
        )}

        {/* Database Settings Panel */}
        {activeTab === "settings" && selectedSettingsPanel === 'database' && (
          <DatabaseSettingsPanel onBack={() => setSelectedSettingsPanel(null)} />
        )}

        {/* Email Settings Panel */}
        {activeTab === "settings" && selectedSettingsPanel === 'email' && (
          <EmailSettingsPanel onBack={() => setSelectedSettingsPanel(null)} />
        )}

        {/* Email Templates Panel */}
        {activeTab === "settings" && selectedSettingsPanel === 'email-templates' && (
          <EmailTemplatesPanel onBack={() => setSelectedSettingsPanel(null)} />
        )}

        {/* Security/GDPR Settings Panel */}
        {activeTab === "settings" && selectedSettingsPanel === 'security' && (
          <SecuritySettingsPanel onBack={() => setSelectedSettingsPanel(null)} />
        )}

        {/* Matrix Settings Panel */}
        {activeTab === "settings" && selectedSettingsPanel === 'matrix' && (
          <MatrixSettingsPanel onBack={() => setSelectedSettingsPanel(null)} />
        )}

        {/* Role Management Panel */}
        {activeTab === "settings" && selectedSettingsPanel === 'roles' && (
          <RoleManagementPanel onBack={() => setSelectedSettingsPanel(null)} />
        )}

        {/* Notification Settings Panel */}
        {activeTab === "settings" && selectedSettingsPanel === 'notifications' && (
          <NotificationSettingsPanel onBack={() => setSelectedSettingsPanel(null)} />
        )}

        {/* Session Timeout Settings Panel */}
        {activeTab === "settings" && selectedSettingsPanel === 'session-timeout' && (
          <SessionTimeoutPanel onBack={() => setSelectedSettingsPanel(null)} />
        )}

        {/* Pentest-Tools Panel */}
        {activeTab === "settings" && selectedSettingsPanel === 'pentest' && (
          <PentestToolsPanel onBack={() => setSelectedSettingsPanel(null)} />
        )}

        {/* WCAG Accessibility Panel */}
        {activeTab === "settings" && selectedSettingsPanel === 'wcag' && (
          <WCAGAccessibilityPanel onBack={() => setSelectedSettingsPanel(null)} />
        )}

        {/* Automated Tests Tab - Top Level */}
        {activeTab === "tests" && (
          <AutomatedTestsPanel onBack={() => setActiveTab("overview")} />
        )}

        {/* Customization Panel */}
        {activeTab === "customize" && (
          <CustomizationPanel />
        )}

        {/* GDPR Deletion Requests Panel */}
        {activeTab === "deletion-requests" && (
          <DeletionRequestsPanel onBack={() => setActiveTab("overview")} />
        )}
      </div>
      </div>
    </TooltipProvider>
  );
}

// Helper Components
function NavButton({ active, onClick, icon, label, testId, collapsed }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; testId: string; collapsed: boolean }) {
  const button = (
    <Button
      variant={active ? "default" : "ghost"}
      className={`w-full ${collapsed ? 'justify-center px-2' : 'justify-start px-3'}`}
      size={collapsed ? "icon" : "default"}
      onClick={onClick}
      data-testid={testId}
    >
      {icon}
      {!collapsed && <span className="ml-2 truncate">{label}</span>}
    </Button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

function StatCard({ icon, label, value, color, onClick, testId }: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
  color: 'blue' | 'green' | 'purple' | 'orange';
  onClick?: () => void;
  testId?: string;
}) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
  };
  
  const iconColorClasses = {
    blue: 'text-blue-200',
    green: 'text-green-200',
    purple: 'text-purple-200',
    orange: 'text-orange-200',
  };

  return (
    <Card 
      className={`bg-gradient-to-r ${colorClasses[color]} text-white cursor-pointer hover:shadow-lg transition-shadow`}
      onClick={onClick}
      data-testid={testId}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={`w-8 h-8 ${iconColorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RoleBadge({ role }: { role: string }) {
  const { t } = useTranslation();
  switch (role) {
    case 'admin': return <Badge className="bg-red-500 text-white">{t('admin.roleAdmin')}</Badge>;
    case 'manager': return <Badge className="bg-blue-500 text-white">{t('admin.roleManager')}</Badge>;
    default: return <Badge variant="secondary">{t('admin.roleUser')}</Badge>;
  }
}

function ActivityItem({ activity }: { activity: { type: string; message: string; timestamp: string; actor?: string } }) {
  const getIcon = () => {
    switch (activity.type) {
      case 'poll_created': return <Vote className="w-4 h-4 text-white" />;
      case 'vote': return <CheckCircle className="w-4 h-4 text-white" />;
      case 'user_registered': return <UserCheck className="w-4 h-4 text-white" />;
      default: return <Activity className="w-4 h-4 text-white" />;
    }
  };

  const getColor = () => {
    switch (activity.type) {
      case 'poll_created': return 'bg-polly-orange';
      case 'vote': return 'bg-green-500';
      case 'user_registered': return 'bg-polly-blue';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
      <div className="flex items-center space-x-3">
        <div className={`w-8 h-8 ${getColor()} rounded-full flex items-center justify-center`}>
          {getIcon()}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{activity.message}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: getDateLocale() })}
          </p>
        </div>
      </div>
      {activity.actor && <span className="text-xs text-muted-foreground">{activity.actor}</span>}
    </div>
  );
}

function UserDetailView({ user, polls, onBack, onPollClick, onUpdateRole, onUpdateUser, onDelete, isDeleting, isUpdating, isDeprovisionEnabled = false }: {
  user: User;
  polls: PollWithOptions[];
  onBack: () => void;
  onPollClick: (poll: PollWithOptions) => void;
  onUpdateRole: (role: string) => void;
  onUpdateUser: (updates: { name?: string; email?: string }) => void;
  onDelete: () => void;
  isDeleting: boolean;
  isUpdating: boolean;
  isDeprovisionEnabled?: boolean;
}) {
  const { t } = useTranslation();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email);
  
  const isSSO = !!user.keycloakId;
  const schedulePolls = polls.filter(p => p.type === 'schedule');
  const surveyPolls = polls.filter(p => p.type === 'survey');
  const activePolls = polls.filter(p => p.isActive);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-users">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('admin.polls.backToUsers')}
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">{user.name}</span>
      </div>

      {/* User Header */}
      <Card className="polly-card">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-polly-orange rounded-full flex items-center justify-center text-white text-xl font-bold">
                {user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{user.name}</h2>
                <p className="text-muted-foreground">{user.email}</p>
                <p className="text-sm text-muted-foreground">@{user.username}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <RoleBadge role={user.role} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" data-testid="menu-user-actions">
                    <MoreVertical className="w-4 h-4 mr-2" />
                    {t('admin.users.actions')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t('admin.users.manageUser')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isSSO ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuItem disabled className="text-muted-foreground cursor-not-allowed">
                            <Key className="w-4 h-4 mr-2" />
                            {t('admin.users.editSSO')}
                          </DropdownMenuItem>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('admin.users.ssoManagedDescription')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <DropdownMenuItem onClick={() => setEditDialogOpen(true)} disabled={isUpdating}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      {t('admin.users.edit')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t('admin.users.changeRole')}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onUpdateRole('user')} disabled={user.role === 'user' || isUpdating}>
                    <Users className="w-4 h-4 mr-2" />
                    {t('admin.roleUser')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onUpdateRole('manager')} disabled={user.role === 'manager' || isUpdating}>
                    <UserCheck className="w-4 h-4 mr-2" />
                    {t('admin.roleManager')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onUpdateRole('admin')} disabled={user.role === 'admin' || isUpdating}>
                    <Shield className="w-4 h-4 mr-2" />
                    {t('admin.roleAdmin')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {isDeprovisionEnabled ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuItem disabled className="text-muted-foreground cursor-not-allowed">
                            <Unplug className="w-4 h-4 mr-2" />
                            {t('admin.users.deleteExternal')}
                          </DropdownMenuItem>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('admin.users.deleteExternalDescription')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t('admin.users.deleteUser')}
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('admin.users.deleteUserTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('admin.users.deleteUserDescriptionWithData', { name: user.name })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                          <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                            {isDeleting ? t('admin.users.deleting') : t('common.delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{polls.length}</p>
            <p className="text-sm text-muted-foreground">{t('admin.overview.totalPolls')}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{activePolls.length}</p>
            <p className="text-sm text-muted-foreground">{t('admin.overview.activePolls')}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-polly-orange">{schedulePolls.length}</p>
            <p className="text-sm text-muted-foreground">{t('admin.overview.schedulePolls')}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-polly-blue">{surveyPolls.length}</p>
            <p className="text-sm text-muted-foreground">{t('admin.nav.polls')}</p>
          </div>
        </Card>
      </div>

      {/* User's Polls */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle>{t('admin.polls.pollsOf', { name: user.name })}</CardTitle>
          <CardDescription>{t('admin.polls.allCreatedPolls')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.polls.tableTitle')}</TableHead>
                <TableHead>{t('admin.polls.tableType')}</TableHead>
                <TableHead>{t('admin.polls.tableParticipants')}</TableHead>
                <TableHead>{t('admin.polls.tableStatus')}</TableHead>
                <TableHead>{t('admin.polls.tableCreated')}</TableHead>
                <TableHead className="text-right">{t('admin.polls.tableActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {polls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Vote className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{t('admin.users.noUserPolls')}</p>
                  </TableCell>
                </TableRow>
              ) : (
                polls.map((poll) => (
                  <TableRow 
                    key={poll.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onPollClick(poll)}
                    data-testid={`user-poll-row-${poll.id}`}
                  >
                    <TableCell className="font-medium">{poll.title}</TableCell>
                    <TableCell>
                      <PollTypeBadge type={poll.type as 'schedule' | 'survey' | 'organization'} variant="solid" />
                    </TableCell>
                    <TableCell>
                      {new Set(poll.votes.map(v => v.userId ? `user_${v.userId}` : `anon_${v.voterName}`)).size}
                    </TableCell>
                    <TableCell>
                      <Badge className={poll.isActive ? 'polly-badge-active' : 'polly-badge-inactive'}>
                        {poll.isActive ? t('admin.polls.active') : t('admin.polls.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(poll.createdAt), 'dd.MM.yyyy', { locale: getDateLocale() })}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/poll/${poll.publicToken}`, '_blank');
                        }}
                        data-testid={`view-user-poll-${poll.id}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.editUserTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.users.editUserDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t('auth.name')}</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t('admin.users.namePlaceholder')}
                data-testid="input-edit-user-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">{t('auth.email')}</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder={t('admin.users.emailPlaceholder')}
                data-testid="input-edit-user-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">{t('auth.username')}</Label>
              <Input
                id="edit-username"
                value={user.username}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">{t('admin.users.usernameCannotChange')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                const updates: { name?: string; email?: string } = {};
                if (editName !== user.name) updates.name = editName;
                if (editEmail !== user.email) updates.email = editEmail;
                if (Object.keys(updates).length > 0) {
                  onUpdateUser(updates);
                }
                setEditDialogOpen(false);
              }}
              disabled={isUpdating || (editName === user.name && editEmail === user.email)}
              data-testid="button-save-user"
            >
              {isUpdating ? t('admin.users.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PollDetailView({ poll, onBack, onDelete, onToggleActive, onToggleResultsPublic, isDeleting, isUpdating }: {
  poll: PollWithOptions;
  onBack: () => void;
  onDelete: () => void;
  onToggleActive: (active: boolean) => void;
  onToggleResultsPublic: (resultsPublic: boolean) => void;
  isDeleting: boolean;
  isUpdating: boolean;
}) {
  const { t } = useTranslation();
  const uniqueVoters = new Set(poll.votes.map(v => v.userId ? `user_${v.userId}` : `anon_${v.voterName}`)).size;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-polls">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('common.back')}
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">{poll.title}</span>
      </div>

      {/* Poll Header */}
      <Card className="polly-card">
        <CardContent className="p-6 space-y-6">
          {/* Title and Badges */}
          <div className="space-y-3">
            <div className="flex items-center flex-wrap gap-2">
              <PollTypeBadge type={poll.type as 'schedule' | 'survey' | 'organization'} variant="solid" />
              <Badge className={poll.isActive ? 'polly-badge-active' : 'polly-badge-inactive'}>
                {poll.isActive ? t('admin.polls.active') : t('admin.polls.inactive')}
              </Badge>
            </div>
            <h2 className="text-2xl font-bold text-foreground">{poll.title}</h2>
            {poll.description && (
              <p className="text-muted-foreground">{poll.description}</p>
            )}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>{t('admin.polls.tableCreated')}: {format(new Date(poll.createdAt), 'dd. MMMM yyyy, HH:mm', { locale: getDateLocale() })}</span>
              {poll.user && <span>{t('admin.polls.by')}: {poll.user.name}</span>}
            </div>
          </div>

          {/* Controls - separate row */}
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border">
            {/* Toggles */}
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
              <Label className="text-sm text-muted-foreground whitespace-nowrap flex items-center gap-1">
                {poll.resultsPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {t('admin.polls.resultsPublic')}
              </Label>
              <Switch
                checked={poll.resultsPublic !== false}
                onCheckedChange={onToggleResultsPublic}
                disabled={isUpdating}
                data-testid="switch-results-public"
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">
                {t('admin.polls.active')}
              </Label>
              <Switch
                checked={poll.isActive}
                onCheckedChange={onToggleActive}
                disabled={isUpdating}
                data-testid="switch-poll-active"
              />
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => window.open(`/poll/${poll.publicToken}`, '_blank')}
                data-testid="button-view-poll"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {t('admin.polls.view')}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" data-testid="button-delete-poll">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('common.delete')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('admin.polls.deletePollTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('admin.polls.deletePollDescription', { title: poll.title })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                      {isDeleting ? t('admin.users.deleting') : t('common.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{uniqueVoters}</p>
            <p className="text-sm text-muted-foreground">{t('admin.polls.tableParticipants')}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{poll.votes.length}</p>
            <p className="text-sm text-muted-foreground">{poll.type === 'organization' ? t('admin.polls.entries') : t('admin.polls.votes')}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{poll.options.length}</p>
            <p className="text-sm text-muted-foreground">{poll.type === 'organization' ? t('admin.polls.slots') : t('admin.polls.options')}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">
              {poll.expiresAt ? format(new Date(poll.expiresAt), 'dd.MM.yy', { locale: getDateLocale() }) : '∞'}
            </p>
            <p className="text-sm text-muted-foreground">{t('admin.polls.expiryDate')}</p>
          </div>
        </Card>
      </div>

      {/* Options / Slots */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle>{poll.type === 'organization' ? t('admin.polls.slots') : t('admin.polls.options')}</CardTitle>
          <CardDescription>
            {poll.type === 'organization' 
              ? t('admin.polls.slotsDescription') 
              : t('admin.polls.optionsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {poll.options.map((option, index) => {
              const optionVotes = poll.votes.filter(v => v.optionId === option.id);
              const yesCount = optionVotes.filter(v => v.response === 'yes').length;
              const maybeCount = optionVotes.filter(v => v.response === 'maybe').length;
              const noCount = optionVotes.filter(v => v.response === 'no').length;
              
              // For organization polls: count signups (votes with 'yes' response)
              const signupCount = optionVotes.filter(v => v.response === 'yes').length;
              const maxCapacity = option.maxCapacity || 0;
              const isFull = maxCapacity > 0 && signupCount >= maxCapacity;
              
              return (
                <div key={option.id} className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">
                      {poll.type === 'schedule' && option.startTime 
                        ? format(new Date(option.startTime), 'EEEE, dd. MMMM yyyy', { locale: getDateLocale() })
                        : option.text || `Option ${index + 1}`
                      }
                    </span>
                    {poll.type === 'organization' ? (
                      <Badge variant={isFull ? "secondary" : "outline"} className={isFull ? "bg-green-100 text-green-800" : ""}>
                        {signupCount} / {maxCapacity || '∞'} {isFull ? t('admin.pollDetails.full') : t('admin.pollDetails.spots')}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">{optionVotes.length} {t('admin.pollDetails.votes')}</span>
                    )}
                  </div>
                  {poll.type === 'organization' ? (
                    // Organization poll: show progress bar and signup list
                    <div className="space-y-2">
                      {maxCapacity > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${isFull ? 'bg-green-500' : 'bg-green-400'}`}
                            style={{ width: `${Math.min((signupCount / maxCapacity) * 100, 100)}%` }}
                          />
                        </div>
                      )}
                      {signupCount > 0 && (
                        <div className="text-sm text-muted-foreground">
                          {optionVotes.filter(v => v.response === 'yes').map(v => v.voterName).join(', ')}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Regular poll: show Ja/Vielleicht/Nein counts
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="flex items-center text-green-600">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        {yesCount} {t('admin.pollDetails.yes')}
                      </span>
                      <span className="flex items-center text-amber-600">
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        {maybeCount} {t('admin.pollDetails.maybe')}
                      </span>
                      <span className="flex items-center text-red-600">
                        <XCircle className="w-4 h-4 mr-1" />
                        {noCount} {t('admin.pollDetails.no')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Votes / Signups Table */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle>{poll.type === 'organization' ? t('admin.pollDetails.allSignups') : t('admin.pollDetails.allVotes')}</CardTitle>
          <CardDescription>
            {poll.type === 'organization' 
              ? t('admin.pollDetails.signupsDescription')
              : t('admin.pollDetails.votesDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.pollDetails.participant')}</TableHead>
                <TableHead>{poll.type === 'organization' ? t('admin.pollDetails.slot') : t('admin.pollDetails.option')}</TableHead>
                {poll.type === 'organization' ? (
                  <TableHead>{t('admin.pollDetails.comment')}</TableHead>
                ) : (
                  <TableHead>{t('admin.pollDetails.response')}</TableHead>
                )}
                <TableHead>{t('admin.pollDetails.date')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {poll.votes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <Vote className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {poll.type === 'organization' 
                        ? t('admin.pollDetails.noSignupsYet')
                        : t('admin.pollDetails.noVotesYet')}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                poll.votes.map((vote) => {
                  const option = poll.options.find(o => o.id === vote.optionId);
                  return (
                    <TableRow key={vote.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs">
                            {(vote.voterName || 'A')[0].toUpperCase()}
                          </div>
                          <span>{vote.voterName || t('admin.pollDetails.anonymous')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {poll.type === 'schedule' && option?.startTime 
                          ? format(new Date(option.startTime), 'dd.MM.yyyy', { locale: getDateLocale() })
                          : option?.text || t('admin.pollDetails.unknown')
                        }
                      </TableCell>
                      <TableCell>
                        {poll.type === 'organization' ? (
                          <span className="text-sm text-muted-foreground">
                            {vote.comment || '-'}
                          </span>
                        ) : (
                          <Badge variant={
                            vote.response === 'yes' ? 'default' : 
                            vote.response === 'maybe' ? 'secondary' : 'destructive'
                          }>
                            {vote.response === 'yes' ? t('admin.pollDetails.yes') : vote.response === 'maybe' ? t('admin.pollDetails.maybe') : t('admin.pollDetails.no')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {vote.createdAt ? format(new Date(vote.createdAt), 'dd.MM.yyyy HH:mm', { locale: getDateLocale() }) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingCard({ title, description, icon, status, statusType, onClick, testId }: {
  title: string;
  description: string;
  icon: React.ReactNode;
  status: string;
  statusType: 'success' | 'warning' | 'error' | 'neutral';
  onClick?: () => void;
  testId?: string;
}) {
  const statusColors = {
    success: 'text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    warning: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    error: 'text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    neutral: 'text-muted-foreground bg-muted/50 border-muted',
  };

  return (
    <Card 
      className={`polly-card ${onClick ? 'cursor-pointer hover:shadow-md hover:border-polly-orange transition-all' : ''}`}
      onClick={onClick}
      data-testid={testId}
    >
      <CardContent className="p-4">
        <div className="flex items-start space-x-4">
          <div className="text-polly-orange">{icon}</div>
          <div className="flex-1">
            <h3 className="font-medium text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mb-2">{description}</p>
            <div className="flex items-center justify-between">
              <Badge className={statusColors[statusType]}>{status}</Badge>
              {onClick && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OIDCSettingsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch current auth methods to get registration setting
  const { data: authMethods } = useQuery<{ local: boolean; keycloak: boolean; registrationEnabled: boolean }>({
    queryKey: ['/api/v1/auth/methods'],
  });
  
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean>(true);
  
  // Update local state when data loads
  useEffect(() => {
    if (authMethods) {
      setRegistrationEnabled(authMethods.registrationEnabled);
    }
  }, [authMethods]);
  
  // Mutation to save registration setting
  const saveRegistrationMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest('POST', '/api/v1/admin/settings', {
        key: 'registration_enabled',
        value: enabled,
        description: t('admin.oidc.registrationSettingDescription')
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/auth/methods'] });
      toast({ 
        title: registrationEnabled ? t('admin.oidc.registrationActivated') : t('admin.oidc.registrationDeactivated'),
        description: registrationEnabled 
          ? t('admin.oidc.registrationActivatedDescription')
          : t('admin.oidc.registrationDeactivatedDescription')
      });
    },
    onError: () => {
      toast({ 
        title: t('errors.generic'), 
        description: t('admin.oidc.saveError'),
        variant: "destructive"
      });
      // Revert on error
      setRegistrationEnabled(!registrationEnabled);
    }
  });
  
  const handleRegistrationToggle = (enabled: boolean) => {
    setRegistrationEnabled(enabled);
    saveRegistrationMutation.mutate(enabled);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('admin.oidc.backToSettings')}
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">{t('admin.oidc.authentication')}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.oidc.authentication')}</h2>
          <p className="text-muted-foreground">{t('admin.oidc.authDescription')}</p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          {t('admin.oidc.available')}
        </Badge>
      </div>

      {/* Registration Settings */}
      <Card className={`polly-card ${registrationEnabled ? 'border-green-200' : 'border-red-200'}`}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <UserPlus className="w-5 h-5 mr-2" />
              {t('admin.oidc.userRegistration')}
            </div>
            {saveRegistrationMutation.isPending && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
          <CardDescription>{t('admin.oidc.registrationDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`flex items-center justify-between p-4 border rounded-lg ${registrationEnabled ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'}`}>
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-lg ${registrationEnabled ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                {registrationEnabled ? (
                  <UserPlus className="w-6 h-6 text-green-600 dark:text-green-400" />
                ) : (
                  <UserX className="w-6 h-6 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">{t('admin.oidc.allowLocalRegistration')}</p>
                <p className="text-sm text-muted-foreground">
                  {registrationEnabled 
                    ? t('admin.oidc.registrationEnabled')
                    : t('admin.oidc.registrationDisabled')}
                </p>
              </div>
            </div>
            <Switch 
              id="allow-registration" 
              checked={registrationEnabled}
              onCheckedChange={handleRegistrationToggle}
              disabled={saveRegistrationMutation.isPending}
              data-testid="switch-allow-registration" 
            />
          </div>
          
          {!registrationEnabled && (
            <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">{t('admin.oidc.registrationDisabledTitle')}</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {t('admin.oidc.registrationDisabledInfo')}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <div className="flex items-start space-x-3">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">{t('admin.oidc.identityProviderIntegration')}</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {t('admin.oidc.identityProviderInfo')}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keycloak Settings */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Key className="w-5 h-5 mr-2" />
            {t('admin.oidc.keycloakSettings')}
          </CardTitle>
          <CardDescription>{t('admin.oidc.keycloakDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="keycloak-issuer">{t('admin.oidc.issuerUrl')}</Label>
              <Input 
                id="keycloak-issuer" 
                placeholder="https://keycloak.example.com/realms/kita" 
                data-testid="input-keycloak-issuer"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('admin.oidc.issuerUrlHint')}</p>
            </div>
            <div>
              <Label htmlFor="keycloak-client">{t('admin.oidc.clientId')}</Label>
              <Input 
                id="keycloak-client" 
                placeholder="polly-poll-client" 
                data-testid="input-keycloak-client"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="keycloak-secret">{t('admin.oidc.clientSecret')}</Label>
              <Input 
                id="keycloak-secret" 
                type="password" 
                placeholder="••••••••••••••••" 
                data-testid="input-keycloak-secret"
              />
            </div>
            <div>
              <Label htmlFor="keycloak-callback">{t('admin.oidc.callbackUrl')}</Label>
              <Input 
                id="keycloak-callback" 
                value={typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : ''}
                readOnly
                className="bg-muted"
                data-testid="input-keycloak-callback"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('admin.oidc.callbackUrlHint')}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Switch id="keycloak-enabled" data-testid="switch-keycloak-enabled" />
            <Label htmlFor="keycloak-enabled">{t('admin.oidc.enableOidc')}</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" data-testid="button-test-oidc">
              {t('admin.oidc.testConnection')}
            </Button>
            <Button 
              className="polly-button-primary" 
              data-testid="button-save-oidc"
              onClick={() => toast({ title: t('admin.oidc.saved'), description: t('admin.oidc.oidcSaved') })}
            >
              {t('admin.oidc.saveSettings')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="polly-card">
        <CardHeader>
          <CardTitle>{t('admin.oidc.configurationNotes')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>{t('admin.oidc.configNote1')}</li>
            <li>{t('admin.oidc.configNote2')}</li>
            <li>{t('admin.oidc.configNote3')}</li>
            <li>{t('admin.oidc.configNote4')}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function DatabaseSettingsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('admin.database.backToSettings')}
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">{t('admin.database.postgresDatabase')}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.database.databaseConfig')}</h2>
          <p className="text-muted-foreground">{t('admin.database.databaseProvider')}</p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          {t('admin.database.connected')}
        </Badge>
      </div>

      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="w-5 h-5 mr-2" />
            {t('admin.database.connectionStatus')}
          </CardTitle>
          <CardDescription>{t('admin.database.connectionStatusDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">{t('admin.database.host')}</p>
              <p className="font-mono text-sm">Neon PostgreSQL</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">{t('admin.database.status')}</p>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm">{t('admin.database.activeStatus')}</span>
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">{t('admin.database.orm')}</p>
              <p className="font-mono text-sm">Drizzle ORM</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">{t('admin.database.ssl')}</p>
              <p className="text-sm flex items-center">
                <Lock className="w-3 h-3 mr-1 text-green-600" />
                {t('admin.database.encrypted')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertBanner variant="warning" data-testid="alert-database-info">
        <div>
          <p className="font-medium">{t('admin.database.note')}</p>
          <p className="text-sm opacity-90">
            {t('admin.database.databaseNote')}
          </p>
        </div>
      </AlertBanner>
    </div>
  );
}

function EmailSettingsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('admin.emailSettings.backToSettings')}
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">{t('admin.emailSettings.emailSending')}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.emailSettings.emailConfig')}</h2>
          <p className="text-muted-foreground">{t('admin.emailSettings.smtpDescription')}</p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          {t('admin.emailSettings.active')}
        </Badge>
      </div>

      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="w-5 h-5 mr-2" />
            {t('admin.emailSettings.smtpSettings')}
          </CardTitle>
          <CardDescription>{t('admin.emailSettings.smtpSettingsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="smtp-host">{t('admin.emailSettings.smtpHost')}</Label>
              <Input id="smtp-host" placeholder="smtp.example.com" data-testid="input-smtp-host" />
            </div>
            <div>
              <Label htmlFor="smtp-port">{t('admin.emailSettings.port')}</Label>
              <Input id="smtp-port" placeholder="587" data-testid="input-smtp-port" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="smtp-user">{t('admin.emailSettings.username')}</Label>
              <Input id="smtp-user" placeholder="user@example.com" data-testid="input-smtp-user" />
            </div>
            <div>
              <Label htmlFor="smtp-pass">{t('admin.emailSettings.password')}</Label>
              <Input id="smtp-pass" type="password" placeholder="••••••••" data-testid="input-smtp-pass" />
            </div>
          </div>
          
          <div>
            <Label htmlFor="from-email">{t('admin.emailSettings.senderEmail')}</Label>
            <Input id="from-email" placeholder="noreply@polly-poll.bayern.de" data-testid="input-from-email" />
          </div>

          <div>
            <Label htmlFor="from-name">{t('admin.emailSettings.senderName')}</Label>
            <Input id="from-name" placeholder="Polly System" data-testid="input-from-name" />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Switch id="smtp-tls" defaultChecked data-testid="switch-smtp-tls" />
            <Label htmlFor="smtp-tls">{t('admin.emailSettings.useTls')}</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" data-testid="button-test-email">
              {t('admin.emailSettings.testEmail')}
            </Button>
            <Button 
              className="polly-button-primary" 
              data-testid="button-save-email"
              onClick={() => toast({ title: t('admin.emailSettings.saved'), description: t('admin.emailSettings.emailSaved') })}
            >
              {t('admin.emailSettings.saveSettings')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface EmailTemplate {
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

interface EmailFooter {
  html: string;
  text: string;
}

interface EmailTheme {
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

function EmailTemplatesPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [testEmail, setTestEmail] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  
  // Editable fields
  const [editSubject, setEditSubject] = useState('');
  const [editTextContent, setEditTextContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  
  // Footer editing
  const [showFooterEditor, setShowFooterEditor] = useState(false);
  const [editFooterHtml, setEditFooterHtml] = useState('');
  const [editFooterText, setEditFooterText] = useState('');
  
  // Theme import
  const [showThemeImport, setShowThemeImport] = useState(false);
  const [themeJsonInput, setThemeJsonInput] = useState('');
  const [themePreview, setThemePreview] = useState<Partial<EmailTheme> | null>(null);

  const { data: templates, isLoading, refetch } = useQuery<EmailTemplate[]>({
    queryKey: ['/api/v1/admin/email-templates'],
  });
  
  // Fetch email footer
  const { data: emailFooter } = useQuery<EmailFooter>({
    queryKey: ['/api/v1/admin/email-footer'],
  });
  
  // Fetch email theme
  const { data: emailTheme } = useQuery<EmailTheme>({
    queryKey: ['/api/v1/admin/email-theme'],
  });
  
  // Reset preview and editable fields when switching templates
  useEffect(() => {
    if (selectedTemplate) {
      setPreviewHtml('');
      setShowPreview(false);
      setEditSubject(selectedTemplate.subject);
      setEditTextContent(selectedTemplate.textContent || '');
      setHasChanges(false);
    }
  }, [selectedTemplate?.type]);
  
  // Initialize footer editor
  useEffect(() => {
    if (emailFooter) {
      setEditFooterHtml(emailFooter.html);
      setEditFooterText(emailFooter.text);
    }
  }, [emailFooter]);
  
  // Track changes
  useEffect(() => {
    if (selectedTemplate) {
      const subjectChanged = editSubject !== selectedTemplate.subject;
      const textChanged = editTextContent !== (selectedTemplate.textContent || '');
      setHasChanges(subjectChanged || textChanged);
    }
  }, [editSubject, editTextContent, selectedTemplate]);

  const previewMutation = useMutation({
    mutationFn: async (type: string) => {
      const response = await apiRequest('POST', `/api/v1/admin/email-templates/${type}/preview`);
      return response.json();
    },
    onSuccess: (data) => {
      setPreviewHtml(data.html);
      setShowPreview(true);
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.emailTemplates.toasts.previewError'), variant: 'destructive' });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async ({ type, recipientEmail }: { type: string; recipientEmail: string }) => {
      const response = await apiRequest('POST', `/api/v1/admin/email-templates/${type}/test`, { recipientEmail });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.emailTemplates.toasts.testSent'), description: t('admin.emailTemplates.toasts.testSentDescription') });
      setTestEmail('');
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.emailTemplates.toasts.testError'), variant: 'destructive' });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (type: string) => {
      const response = await apiRequest('POST', `/api/v1/admin/email-templates/${type}/reset`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.emailTemplates.toasts.resetSuccess'), description: t('admin.emailTemplates.toasts.resetDescription') });
      refetch();
      setSelectedTemplate(null);
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.emailTemplates.toasts.resetError'), variant: 'destructive' });
    },
  });

  // Save template changes
  const saveMutation = useMutation({
    mutationFn: async ({ type, subject, textContent }: { type: string; subject: string; textContent: string }) => {
      const response = await apiRequest('PUT', `/api/v1/admin/email-templates/${type}`, {
        subject,
        textContent,
        jsonContent: selectedTemplate?.jsonContent
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.emailTemplates.toasts.saved'), description: t('admin.emailTemplates.toasts.savedDescription') });
      refetch();
      setHasChanges(false);
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.emailTemplates.toasts.saveError'), variant: 'destructive' });
    },
  });

  // Save footer
  const saveFooterMutation = useMutation({
    mutationFn: async ({ html, text }: { html: string; text: string }) => {
      const response = await apiRequest('PUT', '/api/v1/admin/email-footer', { html, text });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.emailTemplates.toasts.saved'), description: t('admin.emailTemplates.toasts.footerSaved') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/email-footer'] });
      setShowFooterEditor(false);
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.emailTemplates.toasts.footerError'), variant: 'destructive' });
    },
  });

  // Preview theme from JSON
  const previewThemeMutation = useMutation({
    mutationFn: async (jsonContent: unknown) => {
      const response = await apiRequest('POST', '/api/v1/admin/email-theme/import', { jsonContent });
      return response.json();
    },
    onSuccess: (data) => {
      setThemePreview(data.preview);
      toast({ title: t('admin.emailTemplates.toasts.themePreviewCreated'), description: t('admin.emailTemplates.toasts.themePreviewDescription') });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.emailTemplates.toasts.jsonError'), variant: 'destructive' });
      setThemePreview(null);
    },
  });

  // Confirm and save theme import
  const confirmThemeImportMutation = useMutation({
    mutationFn: async (jsonContent: unknown) => {
      const response = await apiRequest('POST', '/api/v1/admin/email-theme/import/confirm', { jsonContent });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Importiert', description: 'Theme wurde erfolgreich gespeichert' });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/email-theme'] });
      setShowThemeImport(false);
      setThemeJsonInput('');
      setThemePreview(null);
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.emailTemplates.toasts.themeImportError'), variant: 'destructive' });
    },
  });

  // Reset theme to default
  const resetThemeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/email-theme/reset');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.emailTemplates.toasts.themeReset'), description: t('admin.emailTemplates.toasts.themeResetDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/email-theme'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.emailTemplates.toasts.themeResetError'), variant: 'destructive' });
    },
  });

  // Handle theme JSON input and preview
  const handleThemeJsonPreview = () => {
    try {
      const parsed = JSON.parse(themeJsonInput);
      previewThemeMutation.mutate(parsed);
    } catch {
      toast({ title: t('admin.emailTemplates.toasts.invalidJson'), description: t('admin.emailTemplates.toasts.invalidJsonDescription'), variant: 'destructive' });
    }
  };

  const templateTypeLabels: Record<string, { name: string; icon: React.ReactNode; description: string }> = {
    poll_created: { name: t('admin.emailTemplates.templateTypes.poll_created'), icon: <PlusCircle className="w-4 h-4" />, description: t('admin.emailTemplates.templateTypes.poll_created_desc') },
    invitation: { name: t('admin.emailTemplates.templateTypes.invitation'), icon: <UserPlus className="w-4 h-4" />, description: t('admin.emailTemplates.templateTypes.invitation_desc') },
    vote_confirmation: { name: t('admin.emailTemplates.templateTypes.vote_confirmation'), icon: <CheckCircle className="w-4 h-4" />, description: t('admin.emailTemplates.templateTypes.vote_confirmation_desc') },
    reminder: { name: t('admin.emailTemplates.templateTypes.reminder'), icon: <Bell className="w-4 h-4" />, description: t('admin.emailTemplates.templateTypes.reminder_desc') },
    password_reset: { name: t('admin.emailTemplates.templateTypes.password_reset'), icon: <Key className="w-4 h-4" />, description: t('admin.emailTemplates.templateTypes.password_reset_desc') },
    email_change: { name: t('admin.emailTemplates.templateTypes.email_change'), icon: <Mail className="w-4 h-4" />, description: t('admin.emailTemplates.templateTypes.email_change_desc') },
    password_changed: { name: t('admin.emailTemplates.templateTypes.password_changed'), icon: <Shield className="w-4 h-4" />, description: t('admin.emailTemplates.templateTypes.password_changed_desc') },
    test_report: { name: t('admin.emailTemplates.templateTypes.test_report'), icon: <FileText className="w-4 h-4" />, description: t('admin.emailTemplates.templateTypes.test_report_desc') },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('admin.emailTemplates.backToSettings')}
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">{t('admin.emailTemplates.title')}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.emailTemplates.title')}</h2>
          <p className="text-muted-foreground">{t('admin.emailTemplates.description')}</p>
        </div>
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          <FileText className="w-3 h-3 mr-1" />
          {t('admin.emailTemplates.templatesCount', { count: templates?.length || 0 })}
        </Badge>
      </div>

      {!selectedTemplate ? (
        <>
          {/* Email Theme Settings */}
          <Card className="polly-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Palette className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t('admin.emailTemplates.emailTheme')}</CardTitle>
                    <CardDescription>{t('admin.emailTemplates.themeDescription')}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resetThemeMutation.mutate()}
                    disabled={resetThemeMutation.isPending}
                    data-testid="button-reset-theme"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    {t('admin.emailTemplates.resetTheme')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowThemeImport(true)}
                    data-testid="button-import-theme"
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    {t('admin.emailTemplates.importTheme')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {emailTheme && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('admin.emailTemplates.backdrop')}</Label>
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: emailTheme.backdropColor }}
                      />
                      <span className="text-xs font-mono">{emailTheme.backdropColor}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('admin.emailTemplates.canvas')}</Label>
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: emailTheme.canvasColor }}
                      />
                      <span className="text-xs font-mono">{emailTheme.canvasColor}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('admin.emailTemplates.textColor')}</Label>
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: emailTheme.textColor }}
                      />
                      <span className="text-xs font-mono">{emailTheme.textColor}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('admin.emailTemplates.buttonColor')}</Label>
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: emailTheme.buttonBackgroundColor }}
                      />
                      <span className="text-xs font-mono">{emailTheme.buttonBackgroundColor}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Theme Import Dialog */}
          <Dialog open={showThemeImport} onOpenChange={setShowThemeImport}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('admin.emailTemplates.importThemeTitle')}</DialogTitle>
                <DialogDescription>
                  {t('admin.emailTemplates.importThemeDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>{t('admin.emailTemplates.designImportOnly')}</strong> {t('admin.emailTemplates.designImportNote')}
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label>{t('admin.emailTemplates.emailbuilderJson')}</Label>
                  <Textarea
                    value={themeJsonInput}
                    onChange={(e) => setThemeJsonInput(e.target.value)}
                    placeholder='{"root": {"type": "EmailLayout", "data": {...}}, ...}'
                    className="mt-1 font-mono text-xs min-h-[150px]"
                    data-testid="textarea-theme-json"
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={handleThemeJsonPreview}
                  disabled={!themeJsonInput.trim() || previewThemeMutation.isPending}
                  data-testid="button-preview-theme"
                >
                  {previewThemeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4 mr-1" />
                  )}
                  {t('admin.emailTemplates.preview')}
                </Button>

                {themePreview && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">{t('admin.emailTemplates.extractedColors')}</Label>
                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
                      {Object.entries(themePreview).map(([key, value]) => (
                        <div key={key} className="flex items-center space-x-2">
                          {typeof value === 'string' && value.startsWith('#') && (
                            <div 
                              className="w-5 h-5 rounded border"
                              style={{ backgroundColor: value }}
                            />
                          )}
                          <span className="text-xs">
                            <span className="text-muted-foreground">{key}:</span>{' '}
                            <span className="font-mono">{String(value)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowThemeImport(false);
                  setThemeJsonInput('');
                  setThemePreview(null);
                }}>
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(themeJsonInput);
                      confirmThemeImportMutation.mutate(parsed);
                    } catch {
                      toast({ title: t('admin.emailTemplates.toasts.invalidJson'), description: t('admin.emailTemplates.toasts.invalidJsonDescription'), variant: 'destructive' });
                    }
                  }}
                  disabled={!themePreview || confirmThemeImportMutation.isPending}
                  data-testid="button-confirm-import-theme"
                >
                  {confirmThemeImportMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-1" />
                  )}
                  {t('admin.emailTemplates.applyTheme')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates?.map((template) => {
            const typeInfo = templateTypeLabels[template.type] || { name: template.name, icon: <Mail className="w-4 h-4" />, description: '' };
            return (
              <Card 
                key={template.type} 
                className="polly-card cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedTemplate(template)}
                data-testid={`template-card-${template.type}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        {typeInfo.icon}
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{typeInfo.name}</h3>
                        <p className="text-sm text-muted-foreground">{typeInfo.description}</p>
                      </div>
                    </div>
                    <Badge variant={template.isDefault ? "secondary" : "default"} className="text-xs">
                      {template.isDefault ? t('admin.emailTemplates.default') : t('admin.emailTemplates.customized')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)} data-testid="button-back-templates">
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t('admin.emailTemplates.backToOverview')}
          </Button>

          <Card className="polly-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    {templateTypeLabels[selectedTemplate.type]?.icon || <Mail className="w-5 h-5" />}
                  </div>
                  <div>
                    <CardTitle>{templateTypeLabels[selectedTemplate.type]?.name || selectedTemplate.name}</CardTitle>
                    <CardDescription>{templateTypeLabels[selectedTemplate.type]?.description}</CardDescription>
                  </div>
                </div>
                <Badge variant={selectedTemplate.isDefault ? "secondary" : "default"}>
                  {selectedTemplate.isDefault ? t('admin.emailTemplates.defaultTemplate') : t('admin.emailTemplates.customized')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-sm font-medium">{t('admin.emailTemplates.subject')}</Label>
                <Input
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="mt-1 font-mono text-sm"
                  data-testid="input-template-subject"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('admin.emailTemplates.useVariables')}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium">{t('admin.emailTemplates.emailContent')}</Label>
                <Textarea
                  value={editTextContent}
                  onChange={(e) => setEditTextContent(e.target.value)}
                  className="mt-1 font-mono text-sm min-h-[200px]"
                  placeholder={t('admin.emailTemplates.contentPlaceholder')}
                  data-testid="textarea-template-content"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('admin.emailTemplates.textVersionNote')}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium">{t('admin.emailTemplates.availableVariables')}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedTemplate.variables?.map((variable: { key: string; description: string }) => (
                    <Tooltip key={variable.key}>
                      <TooltipTrigger asChild>
                        <span>
                          <Badge 
                            variant="outline" 
                            className="cursor-pointer font-mono text-xs hover:bg-primary/10"
                            onClick={() => {
                              const varText = `{{${variable.key}}}`;
                              setEditTextContent(prev => prev + varText);
                            }}
                          >
                            {"{{" + variable.key + "}}"}
                          </Badge>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{variable.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t('admin.emailTemplates.clickToInsert')}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => saveMutation.mutate({ 
                    type: selectedTemplate.type, 
                    subject: editSubject, 
                    textContent: editTextContent 
                  })}
                  disabled={!hasChanges || saveMutation.isPending}
                  className="polly-button-primary"
                  data-testid="button-save-template"
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {t('common.save')}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => previewMutation.mutate(selectedTemplate.type)}
                  disabled={previewMutation.isPending}
                  data-testid="button-preview-template"
                >
                  {previewMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                  {t('admin.emailTemplates.preview')}
                </Button>
                
                {!selectedTemplate.isDefault && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" data-testid="button-reset-template">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        {t('admin.emailTemplates.resetToDefault')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('admin.emailTemplates.resetTemplateTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('admin.emailTemplates.resetTemplateDescription')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => resetMutation.mutate(selectedTemplate.type)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t('admin.emailTemplates.reset')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              <Separator />

              <div>
                <Label className="text-sm font-medium">{t('admin.emailTemplates.sendTestEmail')}</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="email"
                    placeholder="test@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    data-testid="input-test-email"
                  />
                  <Button
                    onClick={() => testEmailMutation.mutate({ type: selectedTemplate.type, recipientEmail: testEmail })}
                    disabled={!testEmail || testEmailMutation.isPending}
                    data-testid="button-send-test-email"
                  >
                    {testEmailMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('admin.emailTemplates.sendTestEmailNote')}
                </p>
              </div>
            </CardContent>
          </Card>

          {showPreview && previewHtml && (
            <Card className="polly-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Eye className="w-5 h-5 mr-2" />
                    {t('admin.emailTemplates.preview')}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden bg-white">
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-96 border-0"
                    title={t('admin.emailTemplates.emailPreview')}
                    data-testid="iframe-email-preview"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Central Footer Editor */}
      <Card className="polly-card">
        <CardHeader className="cursor-pointer" onClick={() => setShowFooterEditor(!showFooterEditor)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('admin.emailTemplates.centralFooter')}</CardTitle>
                <CardDescription>
                  {t('admin.emailTemplates.footerDescription')}
                </CardDescription>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${showFooterEditor ? 'rotate-180' : ''}`} />
          </div>
        </CardHeader>
        {showFooterEditor && (
          <CardContent className="space-y-4 pt-0">
            <div>
              <Label className="text-sm font-medium">{t('admin.emailTemplates.footerText')}</Label>
              <Textarea
                value={editFooterHtml}
                onChange={(e) => setEditFooterHtml(e.target.value)}
                className="mt-1 font-mono text-sm min-h-[100px]"
                placeholder={t('admin.emailTemplates.footerPlaceholder')}
                data-testid="textarea-footer-html"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('admin.emailTemplates.footerVariableNote')}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => saveFooterMutation.mutate({ html: editFooterHtml, text: editFooterHtml })}
                disabled={saveFooterMutation.isPending}
                className="polly-button-primary"
                data-testid="button-save-footer"
              >
                {saveFooterMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {t('admin.emailTemplates.saveFooter')}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Info card about email branding */}
      <Card className="polly-card border-blue-200 bg-blue-50/30 dark:bg-blue-950/30 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-200">{t('admin.emailTemplates.emailBranding')}</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {t('admin.emailTemplates.brandingNote')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface DeprovisionSettings {
  enabled: boolean;
  username: string;
  hasPassword: boolean;
  lastUpdated: string | null;
}

interface ClamAVConfig {
  enabled: boolean;
  host: string;
  port: number;
  timeout: number;
  maxFileSize: number;
}

interface ClamAVTestResult {
  success: boolean;
  message: string;
  responseTime?: number;
}

interface ClamavScanLog {
  id: number;
  filename: string;
  fileSize: number;
  mimeType: string | null;
  scanStatus: 'clean' | 'infected' | 'error';
  virusName: string | null;
  errorMessage: string | null;
  actionTaken: 'allowed' | 'blocked';
  uploaderUserId: number | null;
  uploaderEmail: string | null;
  requestIp: string | null;
  scanDurationMs: number | null;
  adminNotifiedAt: string | null;
  scannedAt: string;
}

interface ClamavScanLogsResponse {
  logs: ClamavScanLog[];
  total: number;
}

interface ClamavScanStats {
  totalScans: number;
  cleanScans: number;
  infectedScans: number;
  errorScans: number;
  avgScanDurationMs: number | null;
}

interface SecuritySettingsResponse {
  settings: {
    loginRateLimit: {
      enabled: boolean;
      maxAttempts: number;
      windowSeconds: number;
      cooldownSeconds: number;
    };
  };
  stats: {
    totalTracked: number;
    lockedAccounts: number;
  };
  ssoNote: string;
}

function SecuritySettingsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userTypeTab, setUserTypeTab] = useState<'guest' | 'kitahub'>('guest');
  
  // Rate limiter settings state
  const [rateLimitEnabled, setRateLimitEnabled] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [windowMinutes, setWindowMinutes] = useState(15);
  const [cooldownMinutes, setCooldownMinutes] = useState(15);
  
  // Fetch security settings (rate limiter)
  const { data: securityData, isLoading: isLoadingSecurity } = useQuery<SecuritySettingsResponse>({
    queryKey: ['/api/v1/admin/security'],
  });
  
  // Update local state when security settings are loaded
  useEffect(() => {
    if (securityData?.settings?.loginRateLimit) {
      const rl = securityData.settings.loginRateLimit;
      setRateLimitEnabled(rl.enabled);
      setMaxAttempts(rl.maxAttempts);
      setWindowMinutes(Math.round(rl.windowSeconds / 60));
      setCooldownMinutes(Math.round(rl.cooldownSeconds / 60));
    }
  }, [securityData]);
  
  // Save rate limiter settings mutation
  const saveRateLimitMutation = useMutation({
    mutationFn: async (data: { loginRateLimit: { enabled: boolean; maxAttempts: number; windowSeconds: number; cooldownSeconds: number } }) => {
      const response = await apiRequest('PUT', '/api/v1/admin/security', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.securitySettings.saved'), description: t('admin.securitySettings.rateLimitSaved') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/security'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.toasts.settingsSaveError'), variant: "destructive" });
    }
  });
  
  // Clear rate limits mutation
  const clearRateLimitsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/security/clear-rate-limits');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.securitySettings.locksCleared'), description: t('admin.securitySettings.locksClearedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/security'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.securitySettings.locksClearError'), variant: "destructive" });
    }
  });
  
  const handleSaveRateLimit = () => {
    saveRateLimitMutation.mutate({
      loginRateLimit: {
        enabled: rateLimitEnabled,
        maxAttempts,
        windowSeconds: windowMinutes * 60,
        cooldownSeconds: cooldownMinutes * 60,
      }
    });
  };

  // ClamAV Antivirus settings state
  const [clamavEnabled, setClamavEnabled] = useState(false);
  const [clamavHost, setClamavHost] = useState('localhost');
  const [clamavPort, setClamavPort] = useState(3310);
  const [clamavTimeout, setClamavTimeout] = useState(30);
  const [clamavMaxFileSize, setClamavMaxFileSize] = useState(25);
  const [clamavTestResult, setClamavTestResult] = useState<ClamAVTestResult | null>(null);
  
  // Scan logs state
  const [showScanLogs, setShowScanLogs] = useState(false);
  const [scanLogFilter, setScanLogFilter] = useState<string>('all');
  const [scanLogOffset, setScanLogOffset] = useState(0);

  // Fetch ClamAV settings
  const { data: clamavConfig, isLoading: isLoadingClamav } = useQuery<ClamAVConfig>({
    queryKey: ['/api/v1/admin/clamav'],
  });
  
  // Fetch ClamAV scan logs
  const { data: scanLogs, isLoading: isLoadingScanLogs, refetch: refetchScanLogs } = useQuery<ClamavScanLogsResponse>({
    queryKey: ['/api/v1/admin/clamav/scan-logs', { status: scanLogFilter === 'all' ? undefined : scanLogFilter, offset: scanLogOffset, limit: 20 }],
    enabled: showScanLogs,
  });
  
  // Fetch ClamAV scan stats
  const { data: scanStats } = useQuery<ClamavScanStats>({
    queryKey: ['/api/v1/admin/clamav/stats'],
    enabled: showScanLogs,
  });

  // Update local state when ClamAV settings are loaded
  useEffect(() => {
    if (clamavConfig) {
      setClamavEnabled(clamavConfig.enabled);
      setClamavHost(clamavConfig.host);
      setClamavPort(clamavConfig.port);
      setClamavTimeout(Math.round(clamavConfig.timeout / 1000));
      setClamavMaxFileSize(Math.round(clamavConfig.maxFileSize / 1024 / 1024));
    }
  }, [clamavConfig]);

  // Save ClamAV settings mutation
  const saveClamavMutation = useMutation({
    mutationFn: async (data: Partial<ClamAVConfig>) => {
      const response = await apiRequest('PUT', '/api/v1/admin/clamav', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.securitySettings.saved'), description: t('admin.securitySettings.clamavSaved') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/clamav'] });
      setClamavTestResult(null);
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.securitySettings.clamavError'), variant: "destructive" });
    }
  });

  // Test ClamAV connection mutation
  const testClamavMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/clamav/test');
      return response.json() as Promise<ClamAVTestResult>;
    },
    onSuccess: (result) => {
      setClamavTestResult(result);
      if (result.success) {
        toast({ title: t('admin.securitySettings.connectionSuccess'), description: t('admin.securitySettings.responseTime', { time: result.responseTime }) });
      } else {
        toast({ title: t('admin.securitySettings.connectionFailed'), description: result.message, variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: t('admin.securitySettings.connectionFailed'), description: t('admin.securitySettings.connectionTestError'), variant: "destructive" });
    }
  });

  const handleSaveClamav = () => {
    saveClamavMutation.mutate({
      enabled: clamavEnabled,
      host: clamavHost,
      port: clamavPort,
      timeout: clamavTimeout * 1000,
      maxFileSize: clamavMaxFileSize * 1024 * 1024,
    });
  };
  
  // Deprovision settings state
  const [deprovisionEnabled, setDeprovisionEnabled] = useState(false);
  const [deprovisionUsername, setDeprovisionUsername] = useState('');
  const [deprovisionPassword, setDeprovisionPassword] = useState('');
  const [showDeprovisionPassword, setShowDeprovisionPassword] = useState(false);
  
  // Fetch deprovision settings
  const { data: deprovisionSettings, isLoading: isLoadingDeprovision } = useQuery<DeprovisionSettings>({
    queryKey: ['/api/v1/admin/deprovision-settings'],
  });
  
  // Update local state when settings are loaded
  useEffect(() => {
    if (deprovisionSettings) {
      setDeprovisionEnabled(deprovisionSettings.enabled);
      setDeprovisionUsername(deprovisionSettings.username);
    }
  }, [deprovisionSettings]);
  
  // Save deprovision settings mutation
  const saveDeprovisionMutation = useMutation({
    mutationFn: async (data: { enabled: boolean; username: string; password?: string }) => {
      const response = await apiRequest('PUT', '/api/v1/admin/deprovision-settings', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.securitySettings.saved'), description: t('admin.securitySettings.deprovisionSaved') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/deprovision-settings'] });
      setDeprovisionPassword(''); // Clear password after save
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.toasts.settingsSaveError'), variant: "destructive" });
    }
  });
  
  const handleSaveDeprovision = () => {
    saveDeprovisionMutation.mutate({
      enabled: deprovisionEnabled,
      username: deprovisionUsername,
      password: deprovisionPassword || undefined,
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('admin.oidc.backToSettings')}
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">{t('admin.security.breadcrumb')}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.security.title')}</h2>
          <p className="text-muted-foreground">{t('admin.security.description')}</p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600">
          <ShieldCheck className="w-3 h-3 mr-1" />
          {t('admin.security.gdprCompliant')}
        </Badge>
      </div>

      {/* Encryption Info */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lock className="w-5 h-5 mr-2" />
            {t('admin.security.encryption')}
          </CardTitle>
          <CardDescription>{t('admin.security.encryptionDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Lock className="w-4 h-4 text-green-600" />
                <span className="font-medium">{t('admin.security.transportEncryption')}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t('admin.security.tlsDescription')}</p>
              <Badge className="mt-2 bg-green-100 text-green-700">{t('admin.security.active')}</Badge>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Database className="w-4 h-4 text-green-600" />
                <span className="font-medium">{t('admin.security.databaseEncryption')}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t('admin.security.aesDescription')}</p>
              <Badge className="mt-2 bg-green-100 text-green-700">{t('admin.security.active')}</Badge>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Key className="w-4 h-4 text-green-600" />
                <span className="font-medium">{t('admin.security.passwordHashing')}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t('admin.security.bcryptDescription')}</p>
              <Badge className="mt-2 bg-green-100 text-green-700">{t('admin.security.active')}</Badge>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="w-4 h-4 text-green-600" />
                <span className="font-medium">{t('admin.security.sessionSecurity')}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t('admin.security.sessionDescription')}</p>
              <Badge className="mt-2 bg-green-100 text-green-700">{t('admin.security.active')}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Login Rate Limiter */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <ShieldCheck className="w-5 h-5 mr-2" />
            {t('admin.security.rateLimit')}
          </CardTitle>
          <CardDescription>{t('admin.security.rateLimitDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingSecurity ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* SSO Note */}
              {securityData?.ssoNote && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/30 dark:border-blue-800">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                    <p className="text-sm text-blue-800 dark:text-blue-300">{securityData.ssoNote}</p>
                  </div>
                </div>
              )}

              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t('admin.security.enableRateLimit')}</p>
                  <p className="text-sm text-muted-foreground">{t('admin.security.limitAttempts')}</p>
                </div>
                <Switch 
                  id="rate-limit-enabled" 
                  checked={rateLimitEnabled}
                  onCheckedChange={setRateLimitEnabled}
                  data-testid="switch-rate-limit-enabled" 
                />
              </div>

              {/* Settings Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-attempts">{t('admin.security.maxAttempts')}</Label>
                  <Select 
                    value={maxAttempts.toString()} 
                    onValueChange={(v) => setMaxAttempts(parseInt(v))}
                    disabled={!rateLimitEnabled}
                  >
                    <SelectTrigger id="max-attempts" data-testid="select-max-attempts">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">{t('admin.security.attempts', { count: 3 })}</SelectItem>
                      <SelectItem value="5">{t('admin.security.attempts', { count: 5 })}</SelectItem>
                      <SelectItem value="10">{t('admin.security.attempts', { count: 10 })}</SelectItem>
                      <SelectItem value="15">{t('admin.security.attempts', { count: 15 })}</SelectItem>
                      <SelectItem value="20">{t('admin.security.attempts', { count: 20 })}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('admin.security.beforeLockout')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="window-minutes">{t('admin.security.timeWindow')}</Label>
                  <Select 
                    value={windowMinutes.toString()} 
                    onValueChange={(v) => setWindowMinutes(parseInt(v))}
                    disabled={!rateLimitEnabled}
                  >
                    <SelectTrigger id="window-minutes" data-testid="select-window-minutes">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">{t('admin.security.minutes', { count: 5 })}</SelectItem>
                      <SelectItem value="10">{t('admin.security.minutes', { count: 10 })}</SelectItem>
                      <SelectItem value="15">{t('admin.security.minutes', { count: 15 })}</SelectItem>
                      <SelectItem value="30">{t('admin.security.minutes', { count: 30 })}</SelectItem>
                      <SelectItem value="60">{t('admin.security.minutes', { count: 60 })}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('admin.security.counterWindow')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cooldown-minutes">{t('admin.security.lockoutTime')}</Label>
                  <Select 
                    value={cooldownMinutes.toString()} 
                    onValueChange={(v) => setCooldownMinutes(parseInt(v))}
                    disabled={!rateLimitEnabled}
                  >
                    <SelectTrigger id="cooldown-minutes" data-testid="select-cooldown-minutes">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">{t('admin.security.minutes', { count: 5 })}</SelectItem>
                      <SelectItem value="10">{t('admin.security.minutes', { count: 10 })}</SelectItem>
                      <SelectItem value="15">{t('admin.security.minutes', { count: 15 })}</SelectItem>
                      <SelectItem value="30">{t('admin.security.minutes', { count: 30 })}</SelectItem>
                      <SelectItem value="60">{t('admin.security.minutes', { count: 60 })}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('admin.security.waitTimeAfterLockout')}</p>
                </div>
              </div>

              {/* Stats */}
              {securityData?.stats && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">{t('admin.security.currentlyTracked')}</p>
                    <p className="text-xl font-semibold">{securityData.stats.totalTracked}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">{t('admin.security.lockedAccounts')}</p>
                    <p className="text-xl font-semibold text-red-600">{securityData.stats.lockedAccounts}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between pt-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      disabled={!securityData?.stats?.lockedAccounts}
                      data-testid="button-clear-rate-limits"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      {t('admin.security.clearAllLocks')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('admin.security.clearLocksTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('admin.security.clearLocksDescription')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => clearRateLimitsMutation.mutate()}
                        className="polly-button-primary"
                      >
                        {t('admin.security.clearLocks')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button 
                  onClick={handleSaveRateLimit}
                  disabled={saveRateLimitMutation.isPending}
                  className="polly-button-primary"
                  data-testid="button-save-rate-limit"
                >
                  {saveRateLimitMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('common.saving')}
                    </>
                  ) : (
                    t('admin.security.saveRateLimit')
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ClamAV Antivirus Scanner */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            {t('admin.security.virusScanner')}
          </CardTitle>
          <CardDescription>{t('admin.security.virusScannerDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingClamav ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Info Box */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/30 dark:border-blue-800">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    {t('admin.security.virusScanInfo')}
                  </p>
                </div>
              </div>

              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t('admin.security.enableVirusScanner')}</p>
                  <p className="text-sm text-muted-foreground">{t('admin.security.scanAllUploads')}</p>
                </div>
                <Switch 
                  checked={clamavEnabled}
                  onCheckedChange={setClamavEnabled}
                  data-testid="switch-clamav-enabled"
                />
              </div>

              {/* Connection Settings */}
              <div className={`grid grid-cols-2 gap-4 ${!clamavEnabled ? 'opacity-50' : ''}`}>
                <div className="space-y-2">
                  <Label htmlFor="clamav-host">ClamAV Host</Label>
                  <Input 
                    id="clamav-host"
                    value={clamavHost}
                    onChange={(e) => setClamavHost(e.target.value)}
                    disabled={!clamavEnabled}
                    placeholder="localhost"
                    data-testid="input-clamav-host"
                  />
                  <p className="text-xs text-muted-foreground">{t('admin.security.clamdServerAddress')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clamav-port">{t('admin.security.port')}</Label>
                  <Input 
                    id="clamav-port"
                    type="number"
                    value={clamavPort}
                    onChange={(e) => setClamavPort(parseInt(e.target.value) || 3310)}
                    disabled={!clamavEnabled}
                    placeholder="3310"
                    data-testid="input-clamav-port"
                  />
                  <p className="text-xs text-muted-foreground">{t('admin.security.defaultPort')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clamav-timeout">{t('admin.security.timeout')}</Label>
                  <Select 
                    value={clamavTimeout.toString()} 
                    onValueChange={(v) => setClamavTimeout(parseInt(v))}
                    disabled={!clamavEnabled}
                  >
                    <SelectTrigger id="clamav-timeout" data-testid="select-clamav-timeout">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">{t('admin.security.seconds', { count: 10 })}</SelectItem>
                      <SelectItem value="30">{t('admin.security.seconds', { count: 30 })}</SelectItem>
                      <SelectItem value="60">{t('admin.security.seconds', { count: 60 })}</SelectItem>
                      <SelectItem value="120">{t('admin.security.seconds', { count: 120 })}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('admin.security.maxScanWait')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clamav-maxsize">{t('admin.security.maxFileSize')}</Label>
                  <Select 
                    value={clamavMaxFileSize.toString()} 
                    onValueChange={(v) => setClamavMaxFileSize(parseInt(v))}
                    disabled={!clamavEnabled}
                  >
                    <SelectTrigger id="clamav-maxsize" data-testid="select-clamav-maxsize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 MB</SelectItem>
                      <SelectItem value="10">10 MB</SelectItem>
                      <SelectItem value="25">25 MB</SelectItem>
                      <SelectItem value="50">50 MB</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('admin.security.largerFilesRejected')}</p>
                </div>
              </div>

              {/* Test Result */}
              {clamavTestResult && (
                <div className={`p-3 rounded-lg ${clamavTestResult.success ? 'bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800' : 'bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800'}`}>
                  <div className="flex items-center space-x-2">
                    {clamavTestResult.success ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`text-sm ${clamavTestResult.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                      {clamavTestResult.message}
                      {clamavTestResult.responseTime && ` (${clamavTestResult.responseTime}ms)`}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between pt-2">
                <Button 
                  variant="outline"
                  onClick={() => testClamavMutation.mutate()}
                  disabled={!clamavEnabled || testClamavMutation.isPending}
                  data-testid="button-test-clamav"
                >
                  {testClamavMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('admin.security.testing')}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {t('admin.security.testConnection')}
                    </>
                  )}
                </Button>

                <Button 
                  onClick={handleSaveClamav}
                  disabled={saveClamavMutation.isPending}
                  className="polly-button-primary"
                  data-testid="button-save-clamav"
                >
                  {saveClamavMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('common.saving')}
                    </>
                  ) : (
                    t('admin.security.saveClamav')
                  )}
                </Button>
              </div>

              {/* Scan Logs Button */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t('admin.security.scanLogs')}</p>
                    <p className="text-sm text-muted-foreground">{t('admin.security.scanLogsDescription')}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowScanLogs(!showScanLogs)}
                    data-testid="button-view-scan-logs"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {t('admin.security.viewScanLogs')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ClamAV Scan Logs Panel */}
      {showScanLogs && (
        <Card className="polly-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  {t('admin.security.scanLogsTitle')}
                </CardTitle>
                <CardDescription>{t('admin.security.scanLogsDescription')}</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Select value={scanLogFilter} onValueChange={setScanLogFilter}>
                  <SelectTrigger className="w-36" data-testid="select-scan-log-filter">
                    <SelectValue placeholder={t('admin.security.filterByStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.security.allStatuses')}</SelectItem>
                    <SelectItem value="clean">{t('admin.security.clean')}</SelectItem>
                    <SelectItem value="infected">{t('admin.security.infected')}</SelectItem>
                    <SelectItem value="error">{t('admin.security.error')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchScanLogs()}
                  data-testid="button-refresh-scan-logs"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Stats Summary */}
            {scanStats && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{scanStats.totalScans}</div>
                  <div className="text-xs text-muted-foreground">{t('admin.security.totalScans')}</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{scanStats.cleanScans}</div>
                  <div className="text-xs text-muted-foreground">{t('admin.security.cleanFiles')}</div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{scanStats.infectedScans}</div>
                  <div className="text-xs text-muted-foreground">{t('admin.security.infectedFiles')}</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{scanStats.errorScans}</div>
                  <div className="text-xs text-muted-foreground">{t('admin.security.errorScans')}</div>
                </div>
              </div>
            )}

            {/* Scan Logs Table */}
            {isLoadingScanLogs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>{t('admin.security.loadingScans')}</span>
              </div>
            ) : scanLogs && scanLogs.logs.length > 0 ? (
              <div className="space-y-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">{t('admin.security.filename')}</th>
                        <th className="text-left py-2 px-2">{t('admin.security.status')}</th>
                        <th className="text-left py-2 px-2">{t('admin.security.virusName')}</th>
                        <th className="text-left py-2 px-2">{t('admin.security.uploader')}</th>
                        <th className="text-left py-2 px-2">{t('admin.security.scannedAt')}</th>
                        <th className="text-right py-2 px-2">{t('admin.security.scanDuration')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanLogs.logs.map((log) => (
                        <tr key={log.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2">
                            <div className="flex items-center">
                              <FileIcon className="w-4 h-4 mr-2 text-muted-foreground" />
                              <span className="truncate max-w-[200px]" title={log.filename}>{log.filename}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{formatBytes(log.fileSize)}</span>
                          </td>
                          <td className="py-2 px-2">
                            <Badge 
                              variant={log.scanStatus === 'clean' ? 'outline' : log.scanStatus === 'infected' ? 'destructive' : 'secondary'}
                              className={log.scanStatus === 'clean' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400' : ''}
                            >
                              {log.scanStatus === 'clean' && <CheckCircle className="w-3 h-3 mr-1" />}
                              {log.scanStatus === 'infected' && <AlertTriangle className="w-3 h-3 mr-1" />}
                              {log.scanStatus === 'error' && <XCircle className="w-3 h-3 mr-1" />}
                              {t(`admin.security.${log.scanStatus}`)}
                            </Badge>
                          </td>
                          <td className="py-2 px-2">
                            {log.virusName ? (
                              <span className="text-red-600 font-medium">{log.virusName}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2">
                            {log.uploaderEmail || t('admin.security.anonymous')}
                          </td>
                          <td className="py-2 px-2">
                            {new Date(log.scannedAt).toLocaleString()}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {log.scanDurationMs ? `${log.scanDurationMs}ms` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                {scanLogs.total > 20 && (
                  <div className="flex items-center justify-between pt-4">
                    <span className="text-sm text-muted-foreground">
                      {t('common.showingOfTotal', { shown: scanLogs.logs.length, total: scanLogs.total })}
                    </span>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setScanLogOffset(Math.max(0, scanLogOffset - 20))}
                        disabled={scanLogOffset === 0}
                      >
                        {t('common.previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setScanLogOffset(scanLogOffset + 20)}
                        disabled={scanLogOffset + 20 >= scanLogs.total}
                      >
                        {t('common.next')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('admin.security.noScansYet')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Data Retention - Split by User Type */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Timer className="w-5 h-5 mr-2" />
            {t('admin.dataRetention.title')}
          </CardTitle>
          <CardDescription>{t('admin.security.dataRetentionDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Type Tabs */}
          <div className="flex space-x-1 bg-muted p-1 rounded-lg">
            <button
              onClick={() => setUserTypeTab('guest')}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                userTypeTab === 'guest' 
                  ? 'bg-white shadow-sm text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="tab-guest-users"
            >
              <UserX className="w-4 h-4" />
              <span>{t('admin.security.guestUsers')}</span>
              <Badge variant="secondary" className="ml-1 text-xs">{t('admin.security.anonymous')}</Badge>
            </button>
            <button
              onClick={() => setUserTypeTab('kitahub')}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                userTypeTab === 'kitahub' 
                  ? 'bg-white shadow-sm text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="tab-kitahub-users"
            >
              <Building2 className="w-4 h-4" />
              <span>{t('admin.security.ssoUsers')}</span>
              <Badge variant="secondary" className="ml-1 text-xs bg-polly-orange/10 text-polly-orange">{t('admin.security.authenticated')}</Badge>
            </button>
          </div>

          {/* Guest Users Settings */}
          {userTypeTab === 'guest' && (
            <div className="space-y-4" data-testid="guest-retention-settings">
              <AlertBanner variant="info">
                <p className="text-sm">
                  <strong>{t('admin.security.guestUsers')}</strong> {t('admin.security.guestUsersNote')}
                </p>
              </AlertBanner>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t('admin.dataRetention.deleteInactiveGuestPolls')}</p>
                  <p className="text-sm text-muted-foreground">{t('admin.dataRetention.anonymousPollsWithoutActivity')}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select defaultValue="30">
                    <SelectTrigger className="w-32" data-testid="select-guest-inactive-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="14">14 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="30">30 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="60">60 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="90">90 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="never">{t('admin.security.never')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch id="guest-auto-delete" defaultChecked data-testid="switch-guest-auto-delete" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t('admin.security.expiredGuestPolls')}</p>
                  <p className="text-sm text-muted-foreground">{t('admin.security.expiredPollsDescription')}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select defaultValue="7">
                    <SelectTrigger className="w-32" data-testid="select-guest-expired-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 {t('admin.security.day')}</SelectItem>
                      <SelectItem value="7">7 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="14">14 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="30">30 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="never">{t('admin.security.never')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch id="guest-archive-expired" defaultChecked data-testid="switch-guest-archive-expired" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t('admin.security.anonymizeGuestVotes')}</p>
                  <p className="text-sm text-muted-foreground">{t('admin.security.removeEmailsFromVotes')}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select defaultValue="30">
                    <SelectTrigger className="w-32" data-testid="select-guest-anonymize-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="14">14 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="30">30 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="immediate">{t('admin.security.immediateAfterPoll')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch id="guest-anonymize" defaultChecked data-testid="switch-guest-anonymize" />
                </div>
              </div>
            </div>
          )}

          {/* SSO Users Settings */}
          {userTypeTab === 'kitahub' && (
            <div className="space-y-4" data-testid="kitahub-retention-settings">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>{t('admin.security.ssoUsers')}</strong> {t('admin.dataRetention.ssoUsersNote')}
                </p>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t('admin.dataRetention.deleteInactiveUserPolls')}</p>
                  <p className="text-sm text-muted-foreground">{t('admin.dataRetention.pollsFromAuthenticatedUsers')}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select defaultValue="180">
                    <SelectTrigger className="w-32" data-testid="select-kitahub-inactive-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="90">90 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="180">180 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="365">1 {t('common.year')}</SelectItem>
                      <SelectItem value="730">2 {t('common.years')}</SelectItem>
                      <SelectItem value="never">{t('admin.security.never')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch id="kitahub-auto-delete" data-testid="switch-kitahub-auto-delete" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t('admin.security.archiveExpiredPolls')}</p>
                  <p className="text-sm text-muted-foreground">{t('admin.dataRetention.archiveNote')}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select defaultValue="60">
                    <SelectTrigger className="w-32" data-testid="select-kitahub-expired-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="60">60 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="90">90 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="180">180 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="never">{t('admin.security.never')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch id="kitahub-archive-expired" defaultChecked data-testid="switch-kitahub-archive-expired" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t('admin.dataRetention.cleanupDeletedUsers')}</p>
                  <p className="text-sm text-muted-foreground">{t('admin.dataRetention.afterKeycloakDeletion')}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select defaultValue="30">
                    <SelectTrigger className="w-32" data-testid="select-kitahub-cleanup-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">{t('common.immediately')}</SelectItem>
                      <SelectItem value="7">7 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="30">30 {t('admin.security.days')}</SelectItem>
                      <SelectItem value="90">90 {t('admin.security.days')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch id="kitahub-cleanup" defaultChecked data-testid="switch-kitahub-cleanup" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t('admin.dataRetention.pollsOnUserDeletion')}</p>
                  <p className="text-sm text-muted-foreground">{t('admin.dataRetention.whatHappensToPolls')}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select defaultValue="anonymize">
                    <SelectTrigger className="w-40" data-testid="select-kitahub-user-delete-action">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delete">{t('admin.dataRetention.delete')}</SelectItem>
                      <SelectItem value="anonymize">{t('admin.dataRetention.anonymize')}</SelectItem>
                      <SelectItem value="transfer">{t('admin.dataRetention.transferToAdmin')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* External Deprovisioning (Kafka/Keycloak) */}
      <Card className="polly-card" data-testid="deprovision-settings-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Unplug className="w-5 h-5 mr-2" />
              {t('admin.deprovision.title')}
            </div>
            {deprovisionEnabled ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Wifi className="w-3 h-3 mr-1" />
                {t('admin.deprovision.active')}
              </Badge>
            ) : (
              <Badge variant="secondary">
                <WifiOff className="w-3 h-3 mr-1" />
                {t('admin.deprovision.inactive')}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {t('admin.deprovision.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingDeprovision ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Info Box */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/30 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>{t('common.note')}:</strong> {t('admin.deprovision.note')}
                </p>
              </div>

              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t('admin.deprovision.enableLabel')}</p>
                  <p className="text-sm text-muted-foreground">
                    Endpoint: <code className="text-xs bg-muted px-1 py-0.5 rounded">DELETE /api/v1/deprovision/user</code>
                  </p>
                </div>
                <Switch 
                  checked={deprovisionEnabled}
                  onCheckedChange={setDeprovisionEnabled}
                  data-testid="switch-deprovision-enabled"
                />
              </div>

              {/* Basic Auth Configuration */}
              <div className={`space-y-4 p-4 border rounded-lg ${!deprovisionEnabled ? 'opacity-50' : ''}`}>
                <div className="flex items-center space-x-2 mb-3">
                  <Key className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{t('admin.deprovision.basicAuthConfig')}</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="deprovision-username">{t('admin.deprovision.username')}</Label>
                    <Input 
                      id="deprovision-username"
                      value={deprovisionUsername}
                      onChange={(e) => setDeprovisionUsername(e.target.value)}
                      placeholder="kafka-service"
                      disabled={!deprovisionEnabled}
                      data-testid="input-deprovision-username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="deprovision-password">
                      {t('admin.deprovision.password')} {deprovisionSettings?.hasPassword && !deprovisionPassword && (
                        <span className="text-xs text-muted-foreground">({t('admin.deprovision.alreadySet')})</span>
                      )}
                    </Label>
                    <div className="relative">
                      <Input 
                        id="deprovision-password"
                        type={showDeprovisionPassword ? 'text' : 'password'}
                        value={deprovisionPassword}
                        onChange={(e) => setDeprovisionPassword(e.target.value)}
                        placeholder={deprovisionSettings?.hasPassword ? '••••••••' : t('admin.deprovision.newPassword')}
                        disabled={!deprovisionEnabled}
                        data-testid="input-deprovision-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowDeprovisionPassword(!showDeprovisionPassword)}
                        disabled={!deprovisionEnabled}
                      >
                        {showDeprovisionPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {deprovisionSettings?.lastUpdated && (
                  <p className="text-xs text-muted-foreground">
                    Zuletzt aktualisiert: {format(new Date(deprovisionSettings.lastUpdated), 'dd.MM.yyyy HH:mm')}
                  </p>
                )}
              </div>

              {/* Warning when enabled */}
              {deprovisionEnabled && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/30 dark:border-amber-800">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      <strong>{t('common.important')}:</strong> {t('admin.deprovision.disabledNote')} {t('admin.deprovision.externalService')}.
                    </p>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <Button 
                  onClick={handleSaveDeprovision}
                  disabled={saveDeprovisionMutation.isPending || !deprovisionUsername}
                  className="polly-button-primary"
                  data-testid="button-save-deprovision"
                >
                  {saveDeprovisionMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('common.saving')}
                    </>
                  ) : (
                    t('admin.security.saveDeprovision')
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* GDPR Compliance */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Archive className="w-5 h-5 mr-2" />
            {t('admin.security.gdprFunctions')}
          </CardTitle>
          <CardDescription>{t('admin.security.gdprCompliance')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-sm">{t('admin.security.rightToAccess')}</p>
                <p className="text-xs text-muted-foreground">{t('admin.security.dataExportAvailable')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-sm">{t('admin.security.rightToErasure')}</p>
                <p className="text-xs text-muted-foreground">{t('admin.security.accountDeletionPossible')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-sm">{t('admin.security.dataMinimization')}</p>
                <p className="text-xs text-muted-foreground">{t('admin.security.onlyNecessaryData')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-sm">{t('admin.security.storageLimitation')}</p>
                <p className="text-xs text-muted-foreground">{t('admin.security.autoDeleteConfigurable')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          className="polly-button-primary" 
          data-testid="button-save-security"
          onClick={() => toast({ title: t('common.saved'), description: t('admin.security.settingsSaved') })}
        >
          {t('admin.security.saveSettings')}
        </Button>
      </div>
    </div>
  );
}

function RoleManagementPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/v1/admin/users'],
  });

  const userCounts = {
    user: users?.filter(u => u.role === 'user').length || 0,
    manager: users?.filter(u => u.role === 'manager').length || 0,
    admin: users?.filter(u => u.role === 'admin').length || 0,
  };

  const roles = [
    {
      id: 'user',
      name: t('admin.roles.user'),
      description: t('admin.roles.userDescription'),
      color: 'bg-gray-500',
      badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      count: userCounts.user,
      permissions: [
        { name: t('admin.roles.permissions.createOwnPolls'), allowed: true },
        { name: t('admin.roles.permissions.participateInPolls'), allowed: true },
        { name: t('admin.roles.permissions.manageOwnPolls'), allowed: true },
        { name: t('admin.roles.permissions.editOwnVotes'), allowed: true },
        { name: t('admin.roles.permissions.adminPanelAccess'), allowed: false },
        { name: t('admin.roles.permissions.manageOtherUsers'), allowed: false },
        { name: t('admin.roles.permissions.changeSystemSettings'), allowed: false },
      ],
    },
    {
      id: 'manager',
      name: t('admin.roles.manager'),
      description: t('admin.roles.managerDescription'),
      color: 'bg-blue-500',
      badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      count: userCounts.manager,
      permissions: [
        { name: t('admin.roles.permissions.createOwnPolls'), allowed: true },
        { name: t('admin.roles.permissions.participateInPolls'), allowed: true },
        { name: t('admin.roles.permissions.manageOwnPolls'), allowed: true },
        { name: t('admin.roles.permissions.editOwnVotes'), allowed: true },
        { name: t('admin.roles.permissions.viewTeamPolls'), allowed: true },
        { name: t('admin.roles.permissions.userOverview'), allowed: true },
        { name: t('admin.roles.permissions.changeSystemSettings'), allowed: false },
      ],
    },
    {
      id: 'admin',
      name: t('admin.roles.admin'),
      description: t('admin.roles.adminDescription'),
      color: 'bg-red-500',
      badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      count: userCounts.admin,
      permissions: [
        { name: t('admin.roles.permissions.createOwnPolls'), allowed: true },
        { name: t('admin.roles.permissions.participateInPolls'), allowed: true },
        { name: t('admin.roles.permissions.manageAllPolls'), allowed: true },
        { name: t('admin.roles.permissions.viewAllVotes'), allowed: true },
        { name: t('admin.roles.permissions.adminPanelAccess'), allowed: true },
        { name: t('admin.roles.permissions.manageUsers'), allowed: true },
        { name: t('admin.roles.permissions.changeSystemSettings'), allowed: true },
        { name: t('admin.roles.permissions.assignRoles'), allowed: true },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('admin.roles.backToSettings')}
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">{t('admin.roles.breadcrumb')}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.roles.title')}</h2>
          <p className="text-muted-foreground">{t('admin.roles.description')}</p>
        </div>
        <Badge variant="outline">
          <Users className="w-3 h-3 mr-1" />
          {t('admin.roles.totalUsers', { count: users?.length || 0 })}
        </Badge>
      </div>

      <div className="grid gap-6">
        {roles.map((role) => (
          <Card key={role.id} className="polly-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${role.color}`} />
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {role.name}
                      <Badge className={role.badgeClass}>{t('admin.roles.users', { count: role.count })}</Badge>
                    </CardTitle>
                    <CardDescription>{role.description}</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {role.permissions.map((perm, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-center space-x-2 p-2 rounded-lg text-sm ${
                      perm.allowed 
                        ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' 
                        : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                    }`}
                  >
                    {perm.allowed ? (
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="truncate">{perm.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="polly-card border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-700 dark:text-blue-400">
            <AlertCircle className="w-5 h-5 mr-2" />
            {t('admin.roles.managementNote')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            {t('admin.roles.assignHint')}
          </p>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="font-medium text-foreground">{t('admin.roles.ssoUsers')}:</p>
            <p>
              {t('admin.roles.ssoNote')}
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><code className="bg-muted px-1 rounded">admin</code> {t('common.or')} <code className="bg-muted px-1 rounded">polly-poll-admin</code></li>
              <li><code className="bg-muted px-1 rounded">manager</code> {t('common.or')} <code className="bg-muted px-1 rounded">polly-poll-manager</code></li>
              <li><code className="bg-muted px-1 rounded">user</code> {t('common.or')} <code className="bg-muted px-1 rounded">polly-poll-user</code></li>
            </ul>
            <p className="text-xs">
              {t('admin.roles.configNote')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Notification Settings Panel
interface NotificationSettings {
  enabled: boolean;
  expiryRemindersEnabled: boolean;
  manualRemindersEnabled: boolean;
  defaultExpiryReminderHours: number;
  guestsCanSendReminders: boolean;
  guestReminderLimitPerPoll: number;
  userReminderLimitPerPoll: number;
  reminderCooldownMinutes: number;
}

function NotificationSettingsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    expiryRemindersEnabled: true,
    manualRemindersEnabled: true,
    defaultExpiryReminderHours: 24,
    guestsCanSendReminders: false,
    guestReminderLimitPerPoll: 1,
    userReminderLimitPerPoll: 3,
    reminderCooldownMinutes: 60,
  });

  const { data: notificationData, isLoading } = useQuery<NotificationSettings>({
    queryKey: ['/api/v1/admin/notifications'],
  });

  useEffect(() => {
    if (notificationData) {
      setSettings(notificationData);
    }
  }, [notificationData]);

  const saveMutation = useMutation({
    mutationFn: async (newSettings: NotificationSettings) => {
      const response = await apiRequest('PUT', '/api/v1/admin/notifications', newSettings);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toasts.saved'), description: t('admin.notifications.saved') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/notifications'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.toasts.settingsSaveError'), variant: "destructive" });
    }
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('admin.roles.backToSettings')}
        </Button>
        <span className="font-medium text-foreground">{t('admin.notifications.breadcrumb')}</span>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.notifications.title')}</h2>
          <p className="text-muted-foreground">{t('admin.notifications.description')}</p>
        </div>

        {/* Master Switch */}
        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              {t('admin.notifications.title')}
            </CardTitle>
            <CardDescription>
              {t('admin.notifications.globalToggle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.roles.notificationsEnabled')}</Label>
                <p className="text-sm text-muted-foreground">{t('admin.notifications.toggleAllReminders')}</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
                data-testid="switch-notifications-enabled"
              />
            </div>
          </CardContent>
        </Card>

        {/* Reminder Types */}
        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="w-5 h-5" />
              {t('admin.notifications.reminderTypes')}
            </CardTitle>
            <CardDescription>
              {t('admin.notifications.whichRemindersAllowed')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.notifications.autoExpiryReminders')}</Label>
                <p className="text-sm text-muted-foreground">{t('admin.notifications.autoRemindBeforeExpiry')}</p>
              </div>
              <Switch
                checked={settings.expiryRemindersEnabled}
                onCheckedChange={(v) => setSettings({ ...settings, expiryRemindersEnabled: v })}
                disabled={!settings.enabled}
                data-testid="switch-expiry-reminders"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.notifications.manualRemindersLabel')}</Label>
                <p className="text-sm text-muted-foreground">{t('admin.notifications.manualReminders')}</p>
              </div>
              <Switch
                checked={settings.manualRemindersEnabled}
                onCheckedChange={(v) => setSettings({ ...settings, manualRemindersEnabled: v })}
                disabled={!settings.enabled}
                data-testid="switch-manual-reminders"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('admin.notifications.defaultReminderTime')}</Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={settings.defaultExpiryReminderHours}
                onChange={(e) => setSettings({ ...settings, defaultExpiryReminderHours: parseInt(e.target.value) || 24 })}
                disabled={!settings.enabled || !settings.expiryRemindersEnabled}
                className="w-32"
                data-testid="input-expiry-hours"
              />
              <p className="text-sm text-muted-foreground">{t('admin.notifications.defaultInterval')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Guest Restrictions */}
        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {t('admin.notifications.guestRestrictions')}
            </CardTitle>
            <CardDescription>
              {t('admin.notifications.spamProtection')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AlertBanner variant="warning">
              <p className="text-sm">
                {t('admin.notifications.spamWarning')}
              </p>
            </AlertBanner>

            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.notifications.guestsCanSend')}</Label>
                <p className="text-sm text-muted-foreground">{t('admin.notifications.guestsDescription')}</p>
              </div>
              <Switch
                checked={settings.guestsCanSendReminders}
                onCheckedChange={(v) => setSettings({ ...settings, guestsCanSendReminders: v })}
                disabled={!settings.enabled || !settings.manualRemindersEnabled}
                data-testid="switch-guests-can-remind"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('admin.notifications.maxRemindersPerPoll')}</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={settings.guestReminderLimitPerPoll}
                  onChange={(e) => setSettings({ ...settings, guestReminderLimitPerPoll: parseInt(e.target.value) || 0 })}
                  disabled={!settings.enabled || !settings.guestsCanSendReminders}
                  className="w-32"
                  data-testid="input-guest-limit"
                />
                <p className="text-sm text-muted-foreground">{t('admin.notifications.zeroDisabled')}</p>
              </div>

              <div className="space-y-2">
                <Label>{t('admin.notifications.userRemindersLabel')}</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={settings.userReminderLimitPerPoll}
                  onChange={(e) => setSettings({ ...settings, userReminderLimitPerPoll: parseInt(e.target.value) || 3 })}
                  disabled={!settings.enabled || !settings.manualRemindersEnabled}
                  className="w-32"
                  data-testid="input-user-limit"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('admin.notifications.cooldownTime')}</Label>
              <Input
                type="number"
                min={10}
                max={1440}
                value={settings.reminderCooldownMinutes}
                onChange={(e) => setSettings({ ...settings, reminderCooldownMinutes: parseInt(e.target.value) || 60 })}
                disabled={!settings.enabled || !settings.manualRemindersEnabled}
                className="w-32"
                data-testid="input-cooldown"
              />
              <p className="text-sm text-muted-foreground">{t('admin.notifications.cooldownDescription')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Integration Hint */}
        <Card className="polly-card border-dashed">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{t('admin.notifications.matrixIntegration')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('admin.notifications.matrixIntegrationHint')}{' '}
                  <Button variant="link" className="p-0 h-auto" onClick={onBack}>
                    {t('admin.notifications.matrixIntegrationLink')}
                  </Button>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-save-notifications"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('common.saving')}
              </>
            ) : (
              t('common.saveSettings')
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Session Timeout Settings Panel
interface SessionTimeoutSettings {
  enabled: boolean;
  adminTimeoutMinutes: number;
  managerTimeoutMinutes: number;
  userTimeoutMinutes: number;
  showWarningMinutes: number;
}

function SessionTimeoutPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [settings, setSettings] = useState<SessionTimeoutSettings>({
    enabled: false,
    adminTimeoutMinutes: 480,
    managerTimeoutMinutes: 240,
    userTimeoutMinutes: 60,
    showWarningMinutes: 5,
  });

  const { data: timeoutData, isLoading } = useQuery<SessionTimeoutSettings>({
    queryKey: ['/api/v1/admin/session-timeout'],
  });

  useEffect(() => {
    if (timeoutData) {
      setSettings(timeoutData);
    }
  }, [timeoutData]);

  const saveMutation = useMutation({
    mutationFn: async (newSettings: SessionTimeoutSettings) => {
      const response = await apiRequest('PUT', '/api/v1/admin/session-timeout', newSettings);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toasts.saved'), description: t('admin.sessionTimeout.saved') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/session-timeout'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.toasts.settingsSaveError'), variant: "destructive" });
    }
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}${t('common.hoursShort')} ${mins}${t('common.minutesShort')}` : t('common.hoursWithValue', { count: hours });
    }
    return t('common.minutesWithValue', { count: minutes });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('admin.roles.backToSettings')}
        </Button>
        <span className="font-medium text-foreground">{t('admin.sessionTimeout.breadcrumb')}</span>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.sessionTimeout.title')}</h2>
          <p className="text-muted-foreground">{t('admin.sessionTimeout.description')}</p>
        </div>

        {/* Master Switch */}
        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5" />
              {t('admin.sessionTimeout.breadcrumb')}
            </CardTitle>
            <CardDescription>
              {t('admin.sessionTimeout.usersAutoLoggedOut')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.sessionTimeout.timeoutEnabled')}</Label>
                <p className="text-sm text-muted-foreground">{t('admin.sessionTimeout.enableAutoLogout')}</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
                data-testid="switch-session-timeout-enabled"
              />
            </div>
            
            {!settings.enabled && (
              <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
                {t('admin.sessionTimeout.timeoutDisabledNote')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role-based Timeouts */}
        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {t('admin.sessionTimeout.roleBasedTimeouts')}
            </CardTitle>
            <CardDescription>
              {t('admin.sessionTimeout.roleBasedDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-100 text-red-800">Admin</Badge>
                  <span className="text-sm text-muted-foreground">{t('admin.sessionTimeout.longestSessionForAdmins')}</span>
                </div>
                <span className="text-sm font-medium">{formatDuration(settings.adminTimeoutMinutes)}</span>
              </div>
              <Input
                type="range"
                min={30}
                max={720}
                step={30}
                value={settings.adminTimeoutMinutes}
                onChange={(e) => setSettings({ ...settings, adminTimeoutMinutes: parseInt(e.target.value) })}
                disabled={!settings.enabled}
                className="w-full"
                data-testid="slider-admin-timeout"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>30 Min</span>
                <span>12 {t('admin.sessionTimeout.hours')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-800">Manager</Badge>
                  <span className="text-sm text-muted-foreground">{t('admin.sessionTimeout.mediumSessionForManagers')}</span>
                </div>
                <span className="text-sm font-medium">{formatDuration(settings.managerTimeoutMinutes)}</span>
              </div>
              <Input
                type="range"
                min={15}
                max={480}
                step={15}
                value={settings.managerTimeoutMinutes}
                onChange={(e) => setSettings({ ...settings, managerTimeoutMinutes: parseInt(e.target.value) })}
                disabled={!settings.enabled}
                className="w-full"
                data-testid="slider-manager-timeout"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>15 Min</span>
                <span>8 {t('admin.sessionTimeout.hours')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-gray-100 text-gray-800">User</Badge>
                  <span className="text-sm text-muted-foreground">{t('admin.sessionTimeout.shortestSessionForUsers')}</span>
                </div>
                <span className="text-sm font-medium">{formatDuration(settings.userTimeoutMinutes)}</span>
              </div>
              <Input
                type="range"
                min={5}
                max={240}
                step={5}
                value={settings.userTimeoutMinutes}
                onChange={(e) => setSettings({ ...settings, userTimeoutMinutes: parseInt(e.target.value) })}
                disabled={!settings.enabled}
                className="w-full"
                data-testid="slider-user-timeout"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5 Min</span>
                <span>4 {t('admin.sessionTimeout.hours')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warning Settings */}
        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t('admin.sessionTimeout.warningSettings')}
            </CardTitle>
            <CardDescription>
              {t('admin.roles.warnBeforeLogout')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('admin.roles.showWarningMinutes')}</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={settings.showWarningMinutes}
                onChange={(e) => setSettings({ ...settings, showWarningMinutes: parseInt(e.target.value) || 5 })}
                disabled={!settings.enabled}
                className="w-32"
                data-testid="input-warning-minutes"
              />
              <p className="text-sm text-muted-foreground">
                {t('admin.sessionTimeout.warningNote', { minutes: settings.showWarningMinutes })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="polly-card border-dashed">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{t('admin.roles.implementationNote')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('admin.sessionTimeout.sessionInfo')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-save-session-timeout"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('common.saving')}
              </>
            ) : (
              t('common.saveSettings')
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface MatrixSettings {
  enabled: boolean;
  homeserverUrl: string;
  botUserId: string;
  botAccessToken: string;
  searchEnabled: boolean;
}

function MatrixSettingsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [matrixEnabled, setMatrixEnabled] = useState(false);
  const [homeserverUrl, setHomeserverUrl] = useState('');
  const [botUserId, setBotUserId] = useState('');
  const [botAccessToken, setBotAccessToken] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const { data: customization, isLoading } = useQuery<{ matrix?: MatrixSettings }>({
    queryKey: ['/api/v1/admin/customization'],
  });

  useEffect(() => {
    if (customization?.matrix) {
      setMatrixEnabled(customization.matrix.enabled);
      setHomeserverUrl(customization.matrix.homeserverUrl);
      setBotUserId(customization.matrix.botUserId);
      setSearchEnabled(customization.matrix.searchEnabled);
    }
  }, [customization]);

  const saveMutation = useMutation({
    mutationFn: async (settings: MatrixSettings) => {
      const response = await apiRequest('PUT', '/api/v1/admin/customization', {
        matrix: settings,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toasts.saved'), description: t('admin.matrix.saved') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/customization'] });
      setBotAccessToken('');
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.toasts.settingsSaveError'), variant: "destructive" });
    }
  });

  const handleSave = () => {
    saveMutation.mutate({
      enabled: matrixEnabled,
      homeserverUrl,
      botUserId,
      botAccessToken: botAccessToken || '',
      searchEnabled,
    });
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
      const response = await apiRequest('POST', '/api/v1/matrix/test');
      const result = await response.json();
      if (result.success) {
        setTestStatus('success');
        setTestMessage(t('admin.matrix.connectedAs', { userId: result.userId }));
      } else {
        setTestStatus('error');
        setTestMessage(result.error || t('admin.matrix.connectionFailed'));
      }
    } catch (error: any) {
      setTestStatus('error');
      setTestMessage(t('admin.matrix.connectionTestFailed'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('admin.matrix.backToSettings')}
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">Matrix Chat</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.matrix.title')}</h2>
          <p className="text-muted-foreground">{t('admin.matrix.description')}</p>
        </div>
        <Badge variant="outline" className={matrixEnabled ? "text-green-600 border-green-600" : "text-muted-foreground border-muted"}>
          {matrixEnabled ? (
            <>
              <CheckCircle className="w-3 h-3 mr-1" />
              {t('admin.matrix.enabled')}
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3 mr-1" />
              {t('admin.matrix.disabled')}
            </>
          )}
        </Badge>
      </div>

      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              {t('admin.matrix.connection')}
            </div>
            {saveMutation.isPending && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
          <CardDescription>{t('admin.matrix.connectionDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={`flex items-center justify-between p-4 border rounded-lg ${matrixEnabled ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-muted/50 border-muted'}`}>
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-lg ${matrixEnabled ? 'bg-green-100 dark:bg-green-900/50' : 'bg-muted'}`}>
                <MessageSquare className={`w-6 h-6 ${matrixEnabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="font-medium text-foreground">{t('admin.matrix.enableIntegration')}</p>
                <p className="text-sm text-muted-foreground">
                  {matrixEnabled 
                    ? t('admin.matrix.ssoUsersCanReceive') 
                    : t('admin.matrix.onlyEmailActive')}
                </p>
              </div>
            </div>
            <Switch 
              id="matrix-enabled" 
              checked={matrixEnabled}
              onCheckedChange={setMatrixEnabled}
              data-testid="switch-matrix-enabled" 
            />
          </div>

          {matrixEnabled && (
            <>
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <div className="flex items-start space-x-3">
                  <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800 dark:text-blue-200">{t('admin.matrix.homeserverUrl')}</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {t('admin.matrix.homeserverNote')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="matrix-homeserver">{t('admin.matrix.homeserverUrl')}</Label>
                  <Input 
                    id="matrix-homeserver" 
                    placeholder="https://matrix.example.com"
                    value={homeserverUrl}
                    onChange={(e) => setHomeserverUrl(e.target.value)}
                    data-testid="input-matrix-homeserver"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('admin.matrix.homeserverUrlLabel')}</p>
                </div>
                <div>
                  <Label htmlFor="matrix-bot-user">{t('admin.matrix.botUserId')}</Label>
                  <Input 
                    id="matrix-bot-user" 
                    placeholder="@pollbot:matrix.example.com"
                    value={botUserId}
                    onChange={(e) => setBotUserId(e.target.value)}
                    data-testid="input-matrix-bot-user"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('admin.matrix.botUserIdLabel')}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="matrix-token">{t('admin.matrix.botAccessToken')}</Label>
                <div className="relative">
                  <Input 
                    id="matrix-token" 
                    type={showToken ? "text" : "password"}
                    placeholder={customization?.matrix?.botAccessToken ? "••••••••••••••••" : "syt_xxx..."}
                    value={botAccessToken}
                    onChange={(e) => setBotAccessToken(e.target.value)}
                    data-testid="input-matrix-token"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('admin.matrix.leaveEmptyToKeep')}
                </p>
              </div>

              <div className="flex items-center space-x-2 p-4 border rounded-lg">
                <Switch 
                  id="matrix-search" 
                  checked={searchEnabled}
                  onCheckedChange={setSearchEnabled}
                  data-testid="switch-matrix-search"
                />
                <div className="flex-1">
                  <Label htmlFor="matrix-search" className="font-medium">{t('admin.matrix.userDirectorySearch')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('admin.matrix.searchDescription')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={handleTestConnection}
                    disabled={testStatus === 'testing' || !homeserverUrl || !botUserId}
                    data-testid="button-test-matrix"
                  >
                    {testStatus === 'testing' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('admin.matrix.testing')}
                      </>
                    ) : (
                      <>
                        <Wifi className="w-4 h-4 mr-2" />
                        {t('admin.matrix.testConnection')}
                      </>
                    )}
                  </Button>
                  {testStatus === 'success' && (
                    <span className="text-sm text-green-600 dark:text-green-400 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {testMessage}
                    </span>
                  )}
                  {testStatus === 'error' && (
                    <span className="text-sm text-red-600 dark:text-red-400 flex items-center">
                      <XCircle className="w-4 h-4 mr-1" />
                      {testMessage}
                    </span>
                  )}
                </div>
                <Button 
                  onClick={handleSave}
                  disabled={saveMutation.isPending || !homeserverUrl || !botUserId}
                  className="polly-button-primary"
                  data-testid="button-save-matrix"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('admin.matrix.saving')}
                    </>
                  ) : (
                    t('admin.matrix.saveSettings')
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {matrixEnabled && (
        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              {t('admin.matrix.setupTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                <span className="font-bold text-polly-orange">1.</span>
                <div>
                  <p className="font-medium">{t('admin.matrix.setupHints.createBotAccount')}</p>
                  <p className="text-muted-foreground">{t('admin.matrix.setupHints.createBotAccountDescription')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                <span className="font-bold text-polly-orange">2.</span>
                <div>
                  <p className="font-medium">{t('admin.matrix.setupHints.generateToken')}</p>
                  <p className="text-muted-foreground">{t('admin.matrix.setupHints.generateTokenDescription')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                <span className="font-bold text-polly-orange">3.</span>
                <div>
                  <p className="font-medium">{t('admin.matrix.setupHints.userDirectory')}</p>
                  <p className="text-muted-foreground">
                    {t('admin.matrix.setupHints.userDirectoryDescription')} 
                    <code className="mx-1 px-1 bg-background rounded">user_directory.search_all_users: true</code>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CustomizationPanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: customization, isLoading } = useQuery<CustomizationSettings>({
    queryKey: ['/api/v1/admin/customization'],
  });

  // Default theme colors for all 12 configurable colors
  const DEFAULT_THEME_COLORS = {
    // Core branding
    primaryColor: '#f97316',
    secondaryColor: '#1e40af',
    // Poll types
    scheduleColor: '#F97316',   // Orange - for Termin
    surveyColor: '#72BEB7',     // Light Blue/Teal - for Umfrage
    organizationColor: '#7DB942', // Green - for Orga
    // Semantic status colors
    successColor: '#22c55e',
    warningColor: '#f59e0b',
    errorColor: '#ef4444',
    infoColor: '#3b82f6',
    // UI accent colors
    accentColor: '#8b5cf6',
    mutedColor: '#64748b',
    neutralColor: '#f1f5f9',
  };

  const [themeSettings, setThemeSettings] = useState({
    ...DEFAULT_THEME_COLORS,
    defaultThemeMode: 'system' as 'light' | 'dark' | 'system',
  });

  const [brandingSettings, setBrandingSettings] = useState({
    logoUrl: null as string | null,
    siteName: '',
    siteNameAccent: '',
  });
  
  // Track if initial data has been loaded to prevent race conditions
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  const [footerSettings, setFooterSettings] = useState({
    description: '',
    copyrightText: '',
    supportLinks: [] as FooterLink[],
  });

  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    // Only load initial data once to prevent race conditions while user is typing
    if (customization && !initialDataLoaded) {
      setThemeSettings({
        primaryColor: customization.theme?.primaryColor || DEFAULT_THEME_COLORS.primaryColor,
        secondaryColor: customization.theme?.secondaryColor || DEFAULT_THEME_COLORS.secondaryColor,
        defaultThemeMode: customization.theme?.defaultThemeMode || 'system',
        scheduleColor: customization.theme?.scheduleColor || DEFAULT_THEME_COLORS.scheduleColor,
        surveyColor: customization.theme?.surveyColor || DEFAULT_THEME_COLORS.surveyColor,
        organizationColor: customization.theme?.organizationColor || DEFAULT_THEME_COLORS.organizationColor,
        successColor: customization.theme?.successColor || DEFAULT_THEME_COLORS.successColor,
        warningColor: customization.theme?.warningColor || DEFAULT_THEME_COLORS.warningColor,
        errorColor: customization.theme?.errorColor || DEFAULT_THEME_COLORS.errorColor,
        infoColor: customization.theme?.infoColor || DEFAULT_THEME_COLORS.infoColor,
        accentColor: customization.theme?.accentColor || DEFAULT_THEME_COLORS.accentColor,
        mutedColor: customization.theme?.mutedColor || DEFAULT_THEME_COLORS.mutedColor,
        neutralColor: customization.theme?.neutralColor || DEFAULT_THEME_COLORS.neutralColor,
      });
      setBrandingSettings({
        logoUrl: customization.branding?.logoUrl || null,
        siteName: customization.branding?.siteName ?? '',
        siteNameAccent: customization.branding?.siteNameAccent ?? '',
      });
      setFooterSettings({
        description: customization.footer?.description || '',
        copyrightText: customization.footer?.copyrightText || '',
        supportLinks: customization.footer?.supportLinks || [],
      });
      setInitialDataLoaded(true);
    }
  }, [customization, initialDataLoaded]);

  const saveMutation = useMutation({
    mutationFn: async (settings: Partial<CustomizationSettings>) => {
      const response = await apiRequest('PUT', '/api/v1/admin/customization', settings);
      return response.json();
    },
    onSuccess: (savedData) => {
      toast({ title: t('admin.toasts.saved'), description: t('admin.toasts.customizationSaved') });
      
      // Directly update local state with saved data to ensure UI reflects changes immediately
      if (savedData) {
        if (savedData.theme) {
          setThemeSettings({
            primaryColor: savedData.theme.primaryColor || DEFAULT_THEME_COLORS.primaryColor,
            secondaryColor: savedData.theme.secondaryColor || DEFAULT_THEME_COLORS.secondaryColor,
            defaultThemeMode: savedData.theme.defaultThemeMode || 'system',
            scheduleColor: savedData.theme.scheduleColor || DEFAULT_THEME_COLORS.scheduleColor,
            surveyColor: savedData.theme.surveyColor || DEFAULT_THEME_COLORS.surveyColor,
            organizationColor: savedData.theme.organizationColor || DEFAULT_THEME_COLORS.organizationColor,
            successColor: savedData.theme.successColor || DEFAULT_THEME_COLORS.successColor,
            warningColor: savedData.theme.warningColor || DEFAULT_THEME_COLORS.warningColor,
            errorColor: savedData.theme.errorColor || DEFAULT_THEME_COLORS.errorColor,
            infoColor: savedData.theme.infoColor || DEFAULT_THEME_COLORS.infoColor,
            accentColor: savedData.theme.accentColor || DEFAULT_THEME_COLORS.accentColor,
            mutedColor: savedData.theme.mutedColor || DEFAULT_THEME_COLORS.mutedColor,
            neutralColor: savedData.theme.neutralColor || DEFAULT_THEME_COLORS.neutralColor,
          });
        }
        if (savedData.branding) {
          setBrandingSettings({
            logoUrl: savedData.branding.logoUrl || null,
            siteName: savedData.branding.siteName ?? '',
            siteNameAccent: savedData.branding.siteNameAccent ?? '',
          });
        }
        if (savedData.footer) {
          setFooterSettings({
            description: savedData.footer.description || '',
            copyrightText: savedData.footer.copyrightText || '',
            supportLinks: savedData.footer.supportLinks || [],
          });
        }
      }
      
      // Invalidate caches to refresh other parts of the app
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/customization'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/customization'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.toasts.customizationSaveError'), variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/branding/reset', {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: t('admin.toasts.saved'), description: t('admin.customization.resetSuccess') });
      
      // Update local state with reset defaults
      if (data.settings) {
        if (data.settings.theme) {
          setThemeSettings({
            primaryColor: data.settings.theme.primaryColor || DEFAULT_THEME_COLORS.primaryColor,
            secondaryColor: data.settings.theme.secondaryColor || DEFAULT_THEME_COLORS.secondaryColor,
            defaultThemeMode: data.settings.theme.defaultThemeMode || 'system',
            scheduleColor: data.settings.theme.scheduleColor || DEFAULT_THEME_COLORS.scheduleColor,
            surveyColor: data.settings.theme.surveyColor || DEFAULT_THEME_COLORS.surveyColor,
            organizationColor: data.settings.theme.organizationColor || DEFAULT_THEME_COLORS.organizationColor,
            successColor: data.settings.theme.successColor || DEFAULT_THEME_COLORS.successColor,
            warningColor: data.settings.theme.warningColor || DEFAULT_THEME_COLORS.warningColor,
            errorColor: data.settings.theme.errorColor || DEFAULT_THEME_COLORS.errorColor,
            infoColor: data.settings.theme.infoColor || DEFAULT_THEME_COLORS.infoColor,
            accentColor: data.settings.theme.accentColor || DEFAULT_THEME_COLORS.accentColor,
            mutedColor: data.settings.theme.mutedColor || DEFAULT_THEME_COLORS.mutedColor,
            neutralColor: data.settings.theme.neutralColor || DEFAULT_THEME_COLORS.neutralColor,
          });
        }
        if (data.settings.branding) {
          setBrandingSettings({
            logoUrl: data.settings.branding.logoUrl || null,
            siteName: data.settings.branding.siteName ?? '',
            siteNameAccent: data.settings.branding.siteNameAccent ?? '',
          });
        }
        if (data.settings.footer) {
          setFooterSettings({
            description: data.settings.footer.description || '',
            copyrightText: data.settings.footer.copyrightText || '',
            supportLinks: data.settings.footer.supportLinks || [],
          });
        }
      }
      
      // Invalidate caches to refresh other parts of the app
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/customization'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/customization'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.customization.resetError'), variant: "destructive" });
    },
  });

  const [showResetDialog, setShowResetDialog] = useState(false);

  const handleReset = () => {
    setShowResetDialog(false);
    resetMutation.mutate();
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/v1/upload/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(t('admin.customization.uploadFailed'));

      const data = await response.json();
      setBrandingSettings(prev => ({ ...prev, logoUrl: data.imageUrl }));
      toast({ title: t('admin.toasts.logoUploaded'), description: t('admin.toasts.logoUploadedDescription') });
    } catch (error) {
      toast({ title: t('admin.toasts.uploadFailed'), description: t('admin.toasts.logoUploadError'), variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveAll = () => {
    saveMutation.mutate({
      theme: themeSettings,
      branding: brandingSettings,
      footer: footerSettings,
    });
  };

  const addFooterLink = () => {
    setFooterSettings(prev => ({
      ...prev,
      supportLinks: [...prev.supportLinks, { label: '', url: '' }],
    }));
  };

  const removeFooterLink = (index: number) => {
    setFooterSettings(prev => ({
      ...prev,
      supportLinks: prev.supportLinks.filter((_, i) => i !== index),
    }));
  };

  const updateFooterLink = (index: number, field: 'label' | 'url', value: string) => {
    setFooterSettings(prev => ({
      ...prev,
      supportLinks: prev.supportLinks.map((link, i) => 
        i === index ? { ...link, [field]: value } : link
      ),
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.nav.customize')}</h2>
          <p className="text-muted-foreground">{t('admin.customization.brandingDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => setShowResetDialog(true)}
            disabled={resetMutation.isPending}
            data-testid="button-reset-branding"
          >
            {resetMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('admin.customization.resetToDefaults')}
          </Button>
          <Button 
            className="polly-button-primary" 
            onClick={handleSaveAll}
            disabled={saveMutation.isPending}
            data-testid="button-save-customization"
          >
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('admin.customization.saveAllChanges')}
          </Button>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.customization.resetConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.customization.resetConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('admin.customization.resetConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Theme Colors */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Palette className="w-5 h-5 mr-2" />
            {t('profile.colorScheme')}
          </CardTitle>
          <CardDescription>{t('admin.customization.colorsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="primary-color">{t('admin.customization.primaryColor')}</Label>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  id="primary-color"
                  value={themeSettings.primaryColor}
                  onChange={(e) => setThemeSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="w-12 h-10 rounded border cursor-pointer"
                  data-testid="input-primary-color"
                />
                <Input 
                  value={themeSettings.primaryColor}
                  onChange={(e) => setThemeSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                  placeholder="#f97316"
                  className="flex-1"
                  data-testid="input-primary-color-text"
                />
                <div 
                  className="w-20 h-10 rounded border flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: themeSettings.primaryColor }}
                >
                  {t('common.preview')}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('admin.customization.primaryColorUsage')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary-color">{t('admin.customization.secondaryColor')}</Label>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  id="secondary-color"
                  value={themeSettings.secondaryColor}
                  onChange={(e) => setThemeSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  className="w-12 h-10 rounded border cursor-pointer"
                  data-testid="input-secondary-color"
                />
                <Input 
                  value={themeSettings.secondaryColor}
                  onChange={(e) => setThemeSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  placeholder="#1e40af"
                  className="flex-1"
                  data-testid="input-secondary-color-text"
                />
                <div 
                  className="w-20 h-10 rounded border flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: themeSettings.secondaryColor }}
                >
                  {t('common.preview')}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('admin.customization.secondaryColorUsage')}</p>
            </div>
          </div>
          
          {/* Feature Colors */}
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-4">{t('admin.featureColors')}</h4>
            <p className="text-sm text-muted-foreground mb-4">{t('admin.customization.pollTypeColorsDescription')}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Schedule Color */}
              <div className="space-y-2">
                <Label htmlFor="schedule-color" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {t('admin.customization.scheduleColor')}
                </Label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    id="schedule-color"
                    value={themeSettings.scheduleColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, scheduleColor: e.target.value }))}
                    className="w-10 h-10 rounded border cursor-pointer"
                    data-testid="input-schedule-color"
                  />
                  <Input 
                    value={themeSettings.scheduleColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, scheduleColor: e.target.value }))}
                    placeholder="#F97316"
                    className="flex-1 text-sm"
                  />
                </div>
                <div 
                  className="px-3 py-1.5 rounded text-sm font-medium text-center"
                  style={{ 
                    backgroundColor: themeSettings.scheduleColor,
                    color: 'white',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
                  }}
                >
                  {t('admin.customization.findSchedule')}
                </div>
              </div>

              {/* Survey Color */}
              <div className="space-y-2">
                <Label htmlFor="survey-color" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  {t('admin.customization.surveyColor')}
                </Label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    id="survey-color"
                    value={themeSettings.surveyColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, surveyColor: e.target.value }))}
                    className="w-10 h-10 rounded border cursor-pointer"
                    data-testid="input-survey-color"
                  />
                  <Input 
                    value={themeSettings.surveyColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, surveyColor: e.target.value }))}
                    placeholder="#72BEB7"
                    className="flex-1 text-sm"
                  />
                </div>
                <div 
                  className="px-3 py-1.5 rounded text-sm font-medium text-center"
                  style={{ 
                    backgroundColor: themeSettings.surveyColor,
                    color: 'white',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
                  }}
                >
                  {t('admin.customization.createSurvey')}
                </div>
              </div>

              {/* Organization Color */}
              <div className="space-y-2">
                <Label htmlFor="organization-color" className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  {t('admin.customization.orgaColor')}
                </Label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    id="organization-color"
                    value={themeSettings.organizationColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, organizationColor: e.target.value }))}
                    className="w-10 h-10 rounded border cursor-pointer"
                    data-testid="input-organization-color"
                  />
                  <Input 
                    value={themeSettings.organizationColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, organizationColor: e.target.value }))}
                    placeholder="#7DB942"
                    className="flex-1 text-sm"
                  />
                </div>
                <div 
                  className="px-3 py-1.5 rounded text-sm font-medium text-center"
                  style={{ 
                    backgroundColor: themeSettings.organizationColor,
                    color: 'white',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
                  }}
                >
                  {t('admin.customization.setOrga')}
                </div>
              </div>
            </div>
          </div>

          {/* Semantic Status Colors */}
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {t('admin.customization.statusColors')}
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              {t('admin.customization.statusColorsDescription')}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Success Color */}
              <div className="space-y-2">
                <Label htmlFor="success-color" className="text-sm">{t('admin.customization.success')}</Label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    id="success-color"
                    value={themeSettings.successColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, successColor: e.target.value }))}
                    className="w-8 h-8 rounded border cursor-pointer"
                    data-testid="input-success-color"
                  />
                  <Input 
                    value={themeSettings.successColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, successColor: e.target.value }))}
                    placeholder="#22c55e"
                    className="flex-1 text-xs"
                  />
                </div>
              </div>
              
              {/* Warning Color */}
              <div className="space-y-2">
                <Label htmlFor="warning-color" className="text-sm">{t('admin.customization.warning')}</Label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    id="warning-color"
                    value={themeSettings.warningColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, warningColor: e.target.value }))}
                    className="w-8 h-8 rounded border cursor-pointer"
                    data-testid="input-warning-color"
                  />
                  <Input 
                    value={themeSettings.warningColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, warningColor: e.target.value }))}
                    placeholder="#f59e0b"
                    className="flex-1 text-xs"
                  />
                </div>
              </div>
              
              {/* Error Color */}
              <div className="space-y-2">
                <Label htmlFor="error-color" className="text-sm">{t('admin.customization.error')}</Label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    id="error-color"
                    value={themeSettings.errorColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, errorColor: e.target.value }))}
                    className="w-8 h-8 rounded border cursor-pointer"
                    data-testid="input-error-color"
                  />
                  <Input 
                    value={themeSettings.errorColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, errorColor: e.target.value }))}
                    placeholder="#ef4444"
                    className="flex-1 text-xs"
                  />
                </div>
              </div>
              
              {/* Info Color */}
              <div className="space-y-2">
                <Label htmlFor="info-color" className="text-sm">Info</Label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    id="info-color"
                    value={themeSettings.infoColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, infoColor: e.target.value }))}
                    className="w-8 h-8 rounded border cursor-pointer"
                    data-testid="input-info-color"
                  />
                  <Input 
                    value={themeSettings.infoColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, infoColor: e.target.value }))}
                    placeholder="#3b82f6"
                    className="flex-1 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* UI Accent Colors */}
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-4 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              {t('admin.customization.accentColors')}
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              {t('admin.customization.extendedColorsDescription')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Accent Color */}
              <div className="space-y-2">
                <Label htmlFor="accent-color" className="text-sm">{t('admin.customization.accentHighlights')}</Label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    id="accent-color"
                    value={themeSettings.accentColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                    className="w-8 h-8 rounded border cursor-pointer"
                    data-testid="input-accent-color"
                  />
                  <Input 
                    value={themeSettings.accentColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                    placeholder="#8b5cf6"
                    className="flex-1 text-xs"
                  />
                </div>
              </div>
              
              {/* Muted Color */}
              <div className="space-y-2">
                <Label htmlFor="muted-color" className="text-sm">{t('admin.customization.mutedColor')}</Label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    id="muted-color"
                    value={themeSettings.mutedColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, mutedColor: e.target.value }))}
                    className="w-8 h-8 rounded border cursor-pointer"
                    data-testid="input-muted-color"
                  />
                  <Input 
                    value={themeSettings.mutedColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, mutedColor: e.target.value }))}
                    placeholder="#64748b"
                    className="flex-1 text-xs"
                  />
                </div>
              </div>
              
              {/* Neutral Color */}
              <div className="space-y-2">
                <Label htmlFor="neutral-color" className="text-sm">{t('admin.customization.neutralColor')}</Label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    id="neutral-color"
                    value={themeSettings.neutralColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, neutralColor: e.target.value }))}
                    className="w-8 h-8 rounded border cursor-pointer"
                    data-testid="input-neutral-color"
                  />
                  <Input 
                    value={themeSettings.neutralColor}
                    onChange={(e) => setThemeSettings(prev => ({ ...prev, neutralColor: e.target.value }))}
                    placeholder="#f1f5f9"
                    className="flex-1 text-xs"
                  />
                </div>
              </div>
            </div>
            
            {/* Reset All Colors Button */}
            <div className="mt-4 flex justify-end">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setThemeSettings(prev => ({
                    ...prev,
                    ...DEFAULT_THEME_COLORS
                  }));
                  toast({ 
                    title: t('admin.customization.colorsReset'), 
                    description: t('admin.customization.colorsResetDescription') 
                  });
                }}
                data-testid="button-reset-all-colors"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {t('admin.customization.resetAllColors')}
              </Button>
            </div>
          </div>
          
          {/* Dark Mode Default */}
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-4 flex items-center gap-2">
              <Moon className="w-4 h-4" />
              {t('admin.customization.defaultColorMode')}
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              {t('admin.customization.defaultColorMode')}
            </p>
            <div className="flex items-center gap-4">
              <Select 
                value={themeSettings.defaultThemeMode} 
                onValueChange={(value: 'light' | 'dark' | 'system') => setThemeSettings(prev => ({ ...prev, defaultThemeMode: value }))}
              >
                <SelectTrigger className="w-[200px]" data-testid="select-default-theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4" />
                      <span>{t('admin.customization.light')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4" />
                      <span>{t('admin.customization.dark')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      <span>System</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {themeSettings.defaultThemeMode === 'system' 
                  ? t('admin.customization.followsSystemSettings') 
                  : themeSettings.defaultThemeMode === 'dark' 
                    ? t('admin.customization.darkModeForNewVisitors')
                    : t('admin.customization.lightModeForNewVisitors')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branding / Logo */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Image className="w-5 h-5 mr-2" />
            {t('admin.branding')}
          </CardTitle>
          <CardDescription>{t('admin.customization.brandingDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="site-name">{t('admin.customization.siteName')}</Label>
                <Input 
                  id="site-name"
                  value={brandingSettings.siteName}
                  onChange={(e) => setBrandingSettings(prev => ({ ...prev, siteName: e.target.value }))}
                  placeholder="Poll"
                  data-testid="input-site-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-name-accent">{t('admin.customization.siteNameAccent')}</Label>
                <Input 
                  id="site-name-accent"
                  value={brandingSettings.siteNameAccent}
                  onChange={(e) => setBrandingSettings(prev => ({ ...prev, siteNameAccent: e.target.value }))}
                  placeholder="Poll"
                  data-testid="input-site-name-accent"
                />
                <p className="text-xs text-muted-foreground">{t('admin.customization.primaryColorPart')}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">{t('admin.customization.preview')}:</p>
                <h3 className="text-2xl font-bold">
                  {brandingSettings.siteName}
                  <span style={{ color: themeSettings.primaryColor }}>{brandingSettings.siteNameAccent}</span>
                </h3>
                {!brandingSettings.siteName && !brandingSettings.siteNameAccent && (
                  <p className="text-xs text-muted-foreground mt-1">{t('admin.customization.defaultPolly')}</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <Label>Logo</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                {brandingSettings.logoUrl ? (
                  <div className="space-y-4">
                    <img 
                      src={brandingSettings.logoUrl} 
                      alt="Logo" 
                      className="max-h-24 mx-auto object-contain"
                    />
                    <div className="flex justify-center gap-2">
                      <label className="cursor-pointer">
                        <Button variant="outline" size="sm" asChild>
                          <span>
                            <Upload className="w-4 h-4 mr-2" />
                            {t('admin.customization.change')}
                          </span>
                        </Button>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={isUploading}
                        />
                      </label>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setBrandingSettings(prev => ({ ...prev, logoUrl: null }))}
                        data-testid="button-remove-logo"
                      >
                        <X className="w-4 h-4 mr-2" />
                        {t('admin.customization.remove')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <div className="space-y-2">
                      {isUploading ? (
                        <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
                      ) : (
                        <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                      )}
                      <p className="text-sm text-muted-foreground">
                        {isUploading ? t('admin.customization.uploading') : t('admin.customization.clickToUpload')}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('admin.customization.fileTypes')}</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={isUploading}
                      data-testid="input-logo-upload"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer Settings */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Footer
          </CardTitle>
          <CardDescription>{t('admin.customization.footerDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="footer-description">{t('admin.customization.descriptionText')}</Label>
            <Textarea 
              id="footer-description"
              value={footerSettings.description}
              onChange={(e) => setFooterSettings(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Beschreibung Ihrer Plattform..."
              rows={3}
              data-testid="input-footer-description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="footer-copyright">{t('admin.customization.copyrightText')}</Label>
            <Input 
              id="footer-copyright"
              value={footerSettings.copyrightText}
              onChange={(e) => setFooterSettings(prev => ({ ...prev, copyrightText: e.target.value }))}
              placeholder={t('admin.customization.copyrightPlaceholder')}
              data-testid="input-footer-copyright"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('admin.customization.supportLinks')}</Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={addFooterLink}
                data-testid="button-add-footer-link"
              >
                <Plus className="w-4 h-4 mr-1" />
                {t('admin.customization.addLink')}
              </Button>
            </div>
            <div className="space-y-2">
              {footerSettings.supportLinks.map((link, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input 
                    value={link.label}
                    onChange={(e) => updateFooterLink(index, 'label', e.target.value)}
                    placeholder="Link-Text"
                    className="flex-1"
                    data-testid={`input-footer-link-label-${index}`}
                  />
                  <Input 
                    value={link.url}
                    onChange={(e) => updateFooterLink(index, 'url', e.target.value)}
                    placeholder="URL (z.B. /datenschutz)"
                    className="flex-1"
                    data-testid={`input-footer-link-url-${index}`}
                  />
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => removeFooterLink(index)}
                    data-testid={`button-remove-footer-link-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {footerSettings.supportLinks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('admin.customization.noLinksConfigured')}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Eye className="w-5 h-5 mr-2" />
            {t('admin.customization.footerPreview')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-[hsl(224,71%,4%)] text-white p-6 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <h3 className="text-xl font-bold mb-2">
                  {brandingSettings.siteName || brandingSettings.siteNameAccent ? (
                    <>
                      {brandingSettings.siteName}
                      <span style={{ color: themeSettings.primaryColor }}>{brandingSettings.siteNameAccent}</span>
                    </>
                  ) : (
                    <>Poll<span style={{ color: themeSettings.primaryColor }}>y</span></>
                  )}
                </h3>
                <p className="text-gray-300 text-sm">{footerSettings.description}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">{t('admin.customization.support')}</h4>
                <ul className="space-y-1 text-gray-300 text-sm">
                  {footerSettings.supportLinks.map((link, index) => (
                    <li key={index}>
                      <a href={link.url || '#'} className="hover:text-white">{link.label || t('admin.customization.noText')}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-700 mt-4 pt-4 text-center text-gray-400 text-sm">
              <p>{footerSettings.copyrightText}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============== PENTEST-TOOLS PANEL ==============

interface PentestToolsStatus {
  configured: boolean;
  configuredViaEnv?: boolean;
  connected?: boolean;
  message: string;
  account?: {
    email?: string;
    organization?: string;
    plan?: string;
  };
}

interface PentestTool {
  id: number;
  name: string;
}

interface ScanType {
  id: string;
  name: string;
}

interface ResultSummary {
  text?: string;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  info?: number;
}

interface PentestScan {
  id: string;
  status: string;
  progress?: number;
  target?: string;
  tool_id?: number;
  tool_name?: string;
  started_at?: string;
  finished_at?: string;
  findings_count?: number;
  result_summary?: ResultSummary;
}

interface PentestFinding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description?: string;
  solution?: string;
  affected_url?: string;
  cvss_score?: number;
  cwe_id?: string;
  reference?: string;
}

interface PollyTargetInfo {
  configured: boolean;
  url?: string;
  targetId?: number;
  workspaceId?: number;
  lastSynced?: string;
  error?: string;
}

function PentestToolsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedScan, setSelectedScan] = useState<string | null>(null);
  const [newScanToolId, setNewScanToolId] = useState(170);
  const [newScanType, setNewScanType] = useState('light');
  const [isStartingScan, setIsStartingScan] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [isSyncingTarget, setIsSyncingTarget] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [hiddenScanIds, setHiddenScanIds] = useState<Set<string>>(new Set());

  const { data: status, isLoading: isLoadingStatus, refetch: refetchStatus } = useQuery<PentestToolsStatus>({
    queryKey: ['/api/v1/admin/pentest-tools/status'],
    refetchInterval: 30000,
  });

  const { data: targetInfo, refetch: refetchTarget } = useQuery<PollyTargetInfo>({
    queryKey: ['/api/v1/admin/pentest-tools/target'],
    enabled: status?.configured === true && status?.connected === true,
  });

  const saveTokenMutation = useMutation({
    mutationFn: async (apiToken: string) => {
      const response = await apiRequest('POST', '/api/v1/admin/pentest-tools/config', { apiToken });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.pentest.tokenSaved'), description: t('admin.pentest.tokenSavedDescription') });
      setTokenInput('');
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/pentest-tools/status'] });
    },
    onError: (error: any) => {
      toast({ title: t('errors.generic'), description: error.message || t('admin.tests.tokenSaveError'), variant: "destructive" });
    },
    onSettled: () => {
      setIsSavingToken(false);
    }
  });

  const handleSaveToken = () => {
    if (!tokenInput.trim()) {
      toast({ title: t('errors.generic'), description: t('admin.tests.pleaseEnterToken'), variant: "destructive" });
      return;
    }
    setIsSavingToken(true);
    saveTokenMutation.mutate(tokenInput.trim());
  };

  const { data: toolsData } = useQuery<{ tools: PentestTool[]; scanTypes: ScanType[] }>({
    queryKey: ['/api/v1/admin/pentest-tools/tools'],
    enabled: status?.configured === true,
  });

  const { data: scansData, isLoading: isLoadingScans, refetch: refetchScans } = useQuery<{ scans: PentestScan[] }>({
    queryKey: ['/api/v1/admin/pentest-tools/scans'],
    enabled: status?.configured === true,
    refetchInterval: 10000,
  });

  const { data: findingsData, isLoading: isLoadingFindings } = useQuery<{ findings: PentestFinding[] }>({
    queryKey: ['/api/v1/admin/pentest-tools/scans', selectedScan, 'findings'],
    queryFn: async () => {
      const response = await fetch(`/api/v1/admin/pentest-tools/scans/${selectedScan}/findings`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch findings');
      }
      return response.json();
    },
    enabled: !!selectedScan,
  });

  const syncTargetMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/pentest-tools/target/sync');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.tests.targetSynced'), description: t('admin.tests.targetSyncedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/pentest-tools/target'] });
    },
    onError: (error: any) => {
      toast({ title: t('errors.generic'), description: error.message || t('admin.tests.targetSyncError'), variant: "destructive" });
    },
    onSettled: () => {
      setIsSyncingTarget(false);
    }
  });

  const startScanMutation = useMutation({
    mutationFn: async (data: { toolId: number; scanType: string }) => {
      const response = await apiRequest('POST', '/api/v1/admin/pentest-tools/scans', data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: t('admin.pentest.scanStarted'), description: t('admin.pentest.scanStartedDescription', { scanId: data.scan_id }) });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/pentest-tools/scans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/pentest-tools/target'] });
    },
    onError: (error: any) => {
      toast({ title: t('errors.generic'), description: error.message || t('admin.tests.scanStartError'), variant: "destructive" });
    },
    onSettled: () => {
      setIsStartingScan(false);
    }
  });

  const stopScanMutation = useMutation({
    mutationFn: async (scanId: string) => {
      const response = await apiRequest('POST', `/api/v1/admin/pentest-tools/scans/${scanId}/stop`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.tests.scanStopped'), description: t('admin.tests.scanStoppedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/pentest-tools/scans'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.tests.scanStopError'), variant: "destructive" });
    }
  });

  const handleSyncTarget = () => {
    setIsSyncingTarget(true);
    syncTargetMutation.mutate();
  };

  const handleStartScan = () => {
    setIsStartingScan(true);
    startScanMutation.mutate({
      toolId: newScanToolId,
      scanType: newScanType,
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running': return <Badge className="bg-blue-500">{t('admin.pentest.status.running')}</Badge>;
      case 'finished': return <Badge className="bg-green-500">{t('admin.pentest.status.finished')}</Badge>;
      case 'stopped': return <Badge className="bg-gray-500">{t('admin.pentest.status.stopped')}</Badge>;
      case 'failed': return <Badge className="bg-red-500">{t('admin.pentest.status.failed')}</Badge>;
      case 'queued': return <Badge className="bg-yellow-500">{t('admin.pentest.status.queued')}</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('de-DE');
    } catch {
      return dateStr;
    }
  };

  if (isLoadingStatus) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('admin.pentest.backToSettings')}
          </Button>
        </div>
        <Card className="polly-card">
          <CardContent className="p-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-pentest">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('admin.pentest.backToSettings')}
        </Button>
        <h2 className="text-2xl font-semibold text-foreground">{t('admin.pentest.title')}</h2>
      </div>

      {/* Connection Status */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {t('admin.pentest.connectionStatus')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {status?.configured ? (
              status.connected ? (
                <>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">{t('admin.pentest.connected')}</span>
                  </div>
                  {status.account && (
                    <div className="text-sm text-muted-foreground">
                      {status.account.email && <span>Account: {status.account.email}</span>}
                      {status.account.plan && <span className="ml-4">Plan: {status.account.plan}</span>}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">{t('admin.pentest.connectionError')}: {status.message}</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">{t('admin.pentest.apiTokenNotConfigured')}</span>
              </div>
            )}
          </div>
          
          {/* Token Configuration Form */}
          {status?.configuredViaEnv ? (
            <Alert className="mt-4">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                {t('admin.pentest.apiTokenEnvNote')}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="pentest-api-token">{t('admin.pentest.apiToken')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="pentest-api-token"
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder={status?.configured ? "••••••••••••••••" : t('admin.pentest.tokenPlaceholder')}
                    data-testid="input-pentest-token"
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSaveToken}
                    disabled={isSavingToken || !tokenInput.trim()}
                    data-testid="button-save-pentest-token"
                  >
                    {isSavingToken ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {t('common.save')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('admin.pentest.createToken')}: <a href="https://app.pentest-tools.com/account/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">pentest-tools.com → Account → API</a>
                </p>
              </div>
            </div>
          )}
          
          {status?.configured && !status.connected && (
            <Alert variant="destructive" className="mt-4">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>{t('admin.pentest.possibleCauses')}</p>
                <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                  <li>{t('admin.pentest.tokenInvalidOrExpired')}</li>
                  <li>{t('admin.pentest.networkProblems')}</li>
                  <li>{t('admin.pentest.accountNotActive')}</li>
                </ul>
                <p className="text-sm">
                  {t('admin.pentest.checkTokenHint')} <a href="https://app.pentest-tools.com/account/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Account Settings</a>
                </p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {status?.configured && status.connected && (
        <>
          {/* Polly Target Info */}
          <Card className="polly-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                {t('admin.pentest.pollySecurityScan')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm text-muted-foreground">{t('admin.pentest.scanTarget')}</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {targetInfo?.url ? (
                        <>
                          <code className="text-sm bg-background px-2 py-1 rounded border" data-testid="text-polly-url">
                            {targetInfo.url}
                          </code>
                          {targetInfo.configured && (
                            <Badge className="bg-green-500" data-testid="badge-target-synced">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {t('admin.pentest.synchronized')}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground text-sm">{t('admin.pentest.urlBeingDetermined')}</span>
                      )}
                    </div>
                    {targetInfo?.lastSynced && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('admin.pentest.lastSynced')}: {formatDate(targetInfo.lastSynced)}
                      </p>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleSyncTarget}
                    disabled={isSyncingTarget}
                    data-testid="button-sync-target"
                  >
                    {isSyncingTarget ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    {t('admin.pentest.syncTarget')}
                  </Button>
                </div>
                {targetInfo?.error && !targetInfo.configured && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                    {targetInfo.error}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="scan-tool">{t('admin.pentest.scanTool')}</Label>
                  <Select value={String(newScanToolId)} onValueChange={(v) => setNewScanToolId(parseInt(v))}>
                    <SelectTrigger data-testid="select-scan-tool">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {toolsData?.tools.map((tool) => (
                        <SelectItem key={tool.id} value={String(tool.id)}>
                          {tool.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="scan-type">{t('admin.pentest.scanDepth')}</Label>
                  <Select value={newScanType} onValueChange={setNewScanType}>
                    <SelectTrigger data-testid="select-scan-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {toolsData?.scanTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <Button 
                  onClick={handleStartScan} 
                  disabled={isStartingScan || !targetInfo?.url}
                  data-testid="button-start-scan"
                >
                  {isStartingScan ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  {t('admin.pentest.scanPolly')}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => refetchScans()}
                  data-testid="button-refresh-scans"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('common.refresh')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Scans */}
          <Card className="polly-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                {t('admin.pentest.recentScans')}
              </CardTitle>
              {scansData?.scans && scansData.scans.filter(s => !hiddenScanIds.has(s.id)).length > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          // Hide all current scans from local display only
                          const allIds = new Set(scansData.scans.map(s => s.id));
                          setHiddenScanIds(allIds);
                          toast({ 
                            title: t('admin.pentest.listCleared'), 
                            description: t('admin.pentest.listClearedDescription'),
                          });
                        }}
                        data-testid="button-clear-scans"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('admin.pentest.clearListOnly')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </CardHeader>
            <CardContent>
              {isLoadingScans ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : scansData?.scans && scansData.scans.filter(s => !hiddenScanIds.has(s.id)).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.pentest.tableTarget')}</TableHead>
                      <TableHead>{t('admin.pentest.tableTool')}</TableHead>
                      <TableHead>{t('admin.pentest.tableStatus')}</TableHead>
                      <TableHead>{t('admin.pentest.tableProgress')}</TableHead>
                      <TableHead>{t('admin.pentest.tableStarted')}</TableHead>
                      <TableHead>{t('admin.pentest.findings')}</TableHead>
                      <TableHead>{t('admin.pentest.tableActions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scansData.scans.filter(s => !hiddenScanIds.has(s.id)).map((scan) => (
                      <TableRow key={scan.id} data-testid={`row-scan-${scan.id}`}>
                        <TableCell className="max-w-[200px] truncate" title={scan.target}>
                          {scan.target}
                        </TableCell>
                        <TableCell>{scan.tool_name}</TableCell>
                        <TableCell>{getStatusBadge(scan.status)}</TableCell>
                        <TableCell>
                          {scan.status === 'running' && scan.progress !== undefined ? (
                            <div className="flex items-center gap-2">
                              <Progress value={scan.progress} className="w-20" />
                              <span className="text-sm">{scan.progress}%</span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(scan.started_at)}</TableCell>
                        <TableCell>
                          {scan.result_summary && (scan.result_summary.critical || scan.result_summary.high || scan.result_summary.medium || scan.result_summary.low || scan.result_summary.info) ? (
                            <div className="flex flex-wrap gap-1">
                              {scan.result_summary.critical ? (
                                <Badge className="bg-red-600 text-white text-xs px-1.5">{scan.result_summary.critical}</Badge>
                              ) : null}
                              {scan.result_summary.high ? (
                                <Badge className="bg-orange-600 text-white text-xs px-1.5">{scan.result_summary.high}</Badge>
                              ) : null}
                              {scan.result_summary.medium ? (
                                <Badge className="bg-yellow-600 text-white text-xs px-1.5">{scan.result_summary.medium}</Badge>
                              ) : null}
                              {scan.result_summary.low ? (
                                <Badge className="bg-blue-600 text-white text-xs px-1.5">{scan.result_summary.low}</Badge>
                              ) : null}
                              {scan.result_summary.info ? (
                                <Badge className="bg-gray-500 text-white text-xs px-1.5">{scan.result_summary.info}</Badge>
                              ) : null}
                            </div>
                          ) : scan.status === 'finished' ? (
                            <Badge variant="secondary">0</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {scan.status === 'finished' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSeverityFilter('all');
                                  setSelectedScan(scan.id);
                                }}
                                data-testid={`button-view-findings-${scan.id}`}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                {t('admin.pentest.findings')}
                              </Button>
                            )}
                            {scan.status === 'running' && (
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => stopScanMutation.mutate(scan.id)}
                                data-testid={`button-stop-scan-${scan.id}`}
                              >
                                <Square className="w-4 h-4 mr-1" />
                                {t('common.stop')}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('admin.pentest.noScansYet')}</p>
                  <p className="text-sm">{t('admin.pentest.startFirstScan')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Findings Dialog */}
          {selectedScan && (
            <Dialog open={!!selectedScan} onOpenChange={() => setSelectedScan(null)}>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5" />
                    {t('admin.pentest.scanResults')}
                  </DialogTitle>
                </DialogHeader>
                
                {isLoadingFindings ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : findingsData?.findings && findingsData.findings.length > 0 ? (
                  <div className="space-y-4">
                    {/* Severity Filter */}
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex gap-2 flex-wrap">
                        {['critical', 'high', 'medium', 'low', 'info'].map((sev) => {
                          const count = findingsData.findings.filter(f => f.severity === sev).length;
                          if (count === 0) return null;
                          return (
                            <Badge key={sev} className={getSeverityColor(sev)}>
                              {sev.toUpperCase()}: {count}
                            </Badge>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm whitespace-nowrap">Filter:</Label>
                        <Select value={severityFilter} onValueChange={setSeverityFilter}>
                          <SelectTrigger className="w-[180px]" data-testid="select-severity-filter">
                            <SelectValue placeholder={t('admin.pentest.filterShowAll')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t('admin.pentest.filterShowAll')}</SelectItem>
                            <SelectItem value="critical">🔴 {t('admin.pentest.filterCriticalOnly')}</SelectItem>
                            <SelectItem value="high">🟠 {t('admin.pentest.filterCriticalHigh')}</SelectItem>
                            <SelectItem value="medium">🟡 {t('admin.pentest.filterToMedium')}</SelectItem>
                            <SelectItem value="low">🔵 {t('admin.pentest.filterToLow')}</SelectItem>
                            <SelectItem value="info">ℹ️ {t('admin.pentest.filterAllIncInfo')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {findingsData.findings
                        .filter((finding) => {
                          if (severityFilter === 'all' || severityFilter === 'info') return true;
                          const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
                          const filterIndex = severityOrder.indexOf(severityFilter);
                          const findingIndex = severityOrder.indexOf(finding.severity);
                          return findingIndex <= filterIndex;
                        })
                        .map((finding) => (
                        <Card key={finding.id} className="border" data-testid={`finding-${finding.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <Badge className={getSeverityColor(finding.severity)}>
                                    {finding.severity.toUpperCase()}
                                  </Badge>
                                  {finding.cvss_score && (
                                    <Badge variant="outline">CVSS: {finding.cvss_score}</Badge>
                                  )}
                                  {finding.cwe_id && (
                                    <a
                                      href={`https://cwe.mitre.org/data/definitions/${finding.cwe_id.replace('CWE-', '')}.html`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex"
                                    >
                                      <Badge variant="outline" className="hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer">
                                        {finding.cwe_id}
                                      </Badge>
                                    </a>
                                  )}
                                </div>
                                <h4 className="font-semibold text-base">{finding.title}</h4>
                                {finding.affected_url && (
                                  <p className="text-sm text-muted-foreground mt-1 break-all font-mono bg-muted/50 px-2 py-1 rounded">
                                    {finding.affected_url}
                                  </p>
                                )}
                                {finding.description && (
                                  <p className="text-sm mt-3 text-muted-foreground">{finding.description}</p>
                                )}
                                {finding.solution && (
                                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg text-sm">
                                    <div className="flex items-start gap-2">
                                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <strong className="text-green-700 dark:text-green-400">{t('admin.pentest.recommendedSolution')}</strong>
                                        <p className="mt-1">{finding.solution}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {finding.reference && (
                                  <div className="mt-2">
                                    <a
                                      href={finding.reference}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      Mehr Informationen
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                    <p>{t('admin.pentest.noSecurityIssues')}</p>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </div>
  );
}

// GDPR Deletion Requests Panel Component
function DeletionRequestsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  interface DeletionRequestUser {
    id: number;
    username: string;
    email: string;
    name: string;
    organization: string | null;
    role: string;
    provider: string;
    createdAt: string;
    deletionRequestedAt: string | null;
  }

  const { data: requests, isLoading, refetch } = useQuery<DeletionRequestUser[]>({
    queryKey: ['/api/v1/admin/deletion-requests'],
  });

  const confirmDeletionMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest('POST', `/api/v1/admin/deletion-requests/${userId}/confirm`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('admin.deletionRequests.userDeleted'),
        description: t('admin.deletionRequests.userDeletedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/extended-stats'] });
    },
    onError: () => {
      toast({
        title: t('errors.generic'),
        description: t('admin.deletionRequests.userDeleteError'),
        variant: "destructive",
      });
    },
  });

  const rejectDeletionMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest('POST', `/api/v1/admin/deletion-requests/${userId}/reject`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('admin.deletionRequests.requestRejected'),
        description: t('admin.deletionRequests.requestRejectedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/deletion-requests'] });
    },
    onError: () => {
      toast({
        title: t('errors.generic'),
        description: t('admin.deletionRequests.requestRejectError'),
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-deletion">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <UserX className="w-5 h-5 text-destructive" />
              {t('admin.deletionRequests.title')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('admin.deletionRequests.description')}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-deletion-requests">
          <RefreshCw className="w-4 h-4 mr-2" />
          {t('common.refresh')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('admin.deletionRequests.openRequests')}</CardTitle>
          <CardDescription>
            {t('admin.deletionRequests.openRequestsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !requests || requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p className="font-medium">{t('admin.deletionRequests.noOpenRequests')}</p>
              <p className="text-sm mt-1">{t('admin.deletionRequests.allProcessed')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.deletionRequests.user')}</TableHead>
                  <TableHead>{t('admin.deletionRequests.email')}</TableHead>
                  <TableHead>{t('admin.deletionRequests.role')}</TableHead>
                  <TableHead>{t('admin.deletionRequests.provider')}</TableHead>
                  <TableHead>{t('admin.deletionRequests.registeredAt')}</TableHead>
                  <TableHead>{t('admin.deletionRequests.requestedAt')}</TableHead>
                  <TableHead className="text-right">{t('admin.deletionRequests.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((user) => (
                  <TableRow key={user.id} data-testid={`row-deletion-request-${user.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.name || user.username}</p>
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'destructive' : user.role === 'manager' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Manager' : t('admin.deletionRequests.userRole')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {user.provider === 'local' ? t('admin.deletionRequests.local') : user.provider === 'keycloak' ? 'Keycloak' : user.provider}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.createdAt), 'dd.MM.yyyy', { locale: getDateLocale() })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        {user.deletionRequestedAt && format(new Date(user.deletionRequestedAt), 'dd.MM.yyyy HH:mm', { locale: getDateLocale() })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              data-testid={`button-reject-deletion-${user.id}`}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              {t('admin.deletionRequests.reject')}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('admin.deletionRequests.rejectTitle')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('admin.deletionRequests.rejectDescription', { name: user.name || user.username })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => rejectDeletionMutation.mutate(user.id)}
                                className="bg-amber-600 hover:bg-amber-700"
                              >
                                {t('admin.deletionRequests.reject')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              data-testid={`button-confirm-deletion-${user.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              {t('admin.deletionRequests.delete')}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-destructive">{t('admin.deletionRequests.deleteTitle')}</AlertDialogTitle>
                              <AlertDialogDescription asChild>
                                <div className="space-y-3">
                                  <p>
                                    {t('admin.deletionRequests.deleteDescription', { name: user.name || user.username, email: user.email })}
                                  </p>
                                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                                    <p className="text-sm font-medium text-destructive">{t('admin.deletionRequests.dataDeleted')}</p>
                                    <ul className="mt-2 text-sm list-disc list-inside space-y-1">
                                      <li>{t('admin.deletionRequests.dataDeletedItems.account')}</li>
                                      <li>{t('admin.deletionRequests.dataDeletedItems.polls')}</li>
                                      <li>{t('admin.deletionRequests.dataDeletedItems.votes')}</li>
                                      <li>{t('admin.deletionRequests.dataDeletedItems.tokens')}</li>
                                    </ul>
                                  </div>
                                  <p className="text-sm font-medium">{t('admin.deletionRequests.cannotUndo')}</p>
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => confirmDeletionMutation.mutate(user.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                {t('admin.deletionRequests.deleteConfirm')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            {t('admin.deletionRequests.gdprComplianceNotes')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                {t('admin.deletionRequests.rightToErasure')}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {t('admin.deletionRequests.rightToErasureDescription')}
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                {t('admin.deletionRequests.processingDeadline')}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {t('admin.deletionRequests.processingDeadlineDescription')}
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                {t('admin.deletionRequests.checkExceptions')}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {t('admin.deletionRequests.checkExceptionsDescription')}
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                {t('admin.deletionRequests.documentation')}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {t('admin.deletionRequests.documentationDescription')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Automated Tests Panel Component
function AutomatedTestsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  interface TestCategory {
    id: string;
    name: string;
    description: string;
    testCount: number;
  }
  
  interface TestRun {
    id: number;
    status: string;
    triggeredBy: string;
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number | null;
    startedAt: string;
    completedAt: string | null;
  }

  interface TestScheduleConfig {
    enabled: boolean;
    intervalDays: number;
    runTime: string;
    lastRun?: string;
    nextRun?: string;
    notifyEmail?: string;
  }

  interface IndividualTest {
    testId: string;
    testFile: string;
    testName: string;
    testType: 'unit' | 'integration' | 'e2e' | 'data';
    category: string;
    description?: string;
    enabled: boolean;
    lastStatus?: string;
    lastRunAt?: Date;
  }

  interface TestModeConfig {
    mode: 'auto' | 'manual';
  }

  interface TestConfigurationsResponse {
    tests: {
      unit: IndividualTest[];
      integration: IndividualTest[];
      e2e: IndividualTest[];
      data: IndividualTest[];
    };
    mode: TestModeConfig;
  }

  interface TestEnvironmentInfo {
    environment: 'replit' | 'docker' | 'ci' | 'local';
    capabilities: {
      unit: boolean;
      integration: boolean;
      data: boolean;
      accessibility: boolean;
      e2e: boolean;
    };
    playwrightAvailable: boolean;
  }

  const { data: environmentInfo } = useQuery<TestEnvironmentInfo>({
    queryKey: ['/api/v1/admin/tests/environment'],
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery<{ categories: TestCategory[] }>({
    queryKey: ['/api/v1/admin/tests'],
  });

  const { data: runsData, isLoading: runsLoading, refetch: refetchRuns } = useQuery<{ runs: TestRun[] }>({
    queryKey: ['/api/v1/admin/tests/runs'],
    refetchInterval: 5000,
  });

  const { data: scheduleConfig, isLoading: scheduleLoading } = useQuery<TestScheduleConfig>({
    queryKey: ['/api/v1/admin/tests/schedule'],
  });

  const { data: testConfigs, isLoading: configsLoading, refetch: refetchConfigs } = useQuery<TestConfigurationsResponse>({
    queryKey: ['/api/v1/admin/tests/configurations'],
  });

  const [selectedRun, setSelectedRun] = useState<number | null>(null);
  const [historyLimit, setHistoryLimit] = useState(3);
  const [resultStatusFilter, setResultStatusFilter] = useState<'all' | 'passed' | 'failed' | 'skipped'>('all');
  const [scheduleForm, setScheduleForm] = useState<TestScheduleConfig>({
    enabled: false,
    intervalDays: 7,
    runTime: '03:00',
    notifyEmail: '',
  });

  useEffect(() => {
    if (scheduleConfig) {
      setScheduleForm(scheduleConfig);
    }
  }, [scheduleConfig]);

  useEffect(() => {
    setResultStatusFilter('all');
  }, [selectedRun]);

  const { data: runDetails } = useQuery<TestRun & { results: any[] }>({
    queryKey: ['/api/v1/admin/tests/runs', selectedRun],
    enabled: !!selectedRun,
  });

  const updateModeMutation = useMutation({
    mutationFn: async (mode: 'auto' | 'manual') => {
      const response = await apiRequest('PUT', '/api/v1/admin/tests/mode', { mode });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.tests.modeChanged'), description: t('admin.tests.modeChangedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/tests/configurations'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.tests.modeChangeError'), variant: 'destructive' });
    },
  });

  const toggleTestMutation = useMutation({
    mutationFn: async ({ testId, enabled }: { testId: string; enabled: boolean }) => {
      const response = await apiRequest('PUT', `/api/v1/admin/tests/configurations/${encodeURIComponent(testId)}`, { enabled });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/tests/configurations'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.tests.testChangeError'), variant: 'destructive' });
    },
  });

  const syncTestsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/tests/sync');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: t('admin.tests.testsSynced'), description: t('admin.tests.testsSyncedDescription', { count: data.count || 0 }) });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/tests/configurations'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.tests.testsSyncError'), variant: 'destructive' });
    },
  });

  const currentMode = testConfigs?.mode?.mode || 'auto';
  const isAutoMode = currentMode === 'auto';

  const testTypeLabels: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
    unit: { label: t('admin.tests.testTypes.unit'), icon: <TestTube className="w-4 h-4" />, description: t('admin.tests.testTypes.unitDescription') },
    integration: { label: t('admin.tests.testTypes.integration'), icon: <Workflow className="w-4 h-4" />, description: t('admin.tests.testTypes.integrationDescription') },
    e2e: { label: t('admin.tests.testTypes.e2e'), icon: <Globe className="w-4 h-4" />, description: t('admin.tests.testTypes.e2eDescription') },
    data: { label: t('admin.tests.testTypes.data'), icon: <DatabaseIcon className="w-4 h-4" />, description: t('admin.tests.testTypes.dataDescription') },
    accessibility: { label: t('admin.tests.testTypes.accessibility'), icon: <Eye className="w-4 h-4" />, description: t('admin.tests.testTypes.accessibilityDescription') },
  };

  const runTestsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/tests/run');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: t('admin.tests.testsStarted'), description: t('admin.tests.testsStartedDescription', { id: data.runId }) });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/tests/runs'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.tests.testsStartError'), variant: 'destructive' });
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async (config: TestScheduleConfig) => {
      const response = await apiRequest('PUT', '/api/v1/admin/tests/schedule', config);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.tests.scheduleSaved'), description: t('admin.tests.scheduleSavedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/tests/schedule'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.tests.scheduleSaveError'), variant: 'destructive' });
    },
  });

  const runs = runsData?.runs || [];
  const latestRun = runs[0];
  const isRunning = latestRun?.status === 'running';

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-tests">
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t('admin.tests.backToSettings')}
      </Button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="w-8 h-8 text-polly-orange" />
          <div>
            <h2 className="text-2xl font-bold">{t('admin.tests.title')}</h2>
            <p className="text-muted-foreground">{t('admin.tests.description')}</p>
          </div>
        </div>
        <Button 
          onClick={() => runTestsMutation.mutate()} 
          disabled={runTestsMutation.isPending || isRunning}
          data-testid="button-run-tests"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('admin.tests.runningTests')}
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              {t('admin.tests.startTests')}
            </>
          )}
        </Button>
      </div>

      {/* Latest Run Summary - FIRST */}
      {latestRun && (
        <Card className={latestRun.status === 'completed' && latestRun.failed === 0 ? 'border-green-500' : latestRun.failed > 0 ? 'border-red-500' : ''}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                {latestRun.status === 'running' ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                ) : latestRun.failed > 0 ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                {t('admin.tests.lastTestRun', { id: latestRun.id })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRun(latestRun.id)}
                  data-testid="button-view-run-details"
                >
                  {t('common.details')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/api/v1/admin/tests/runs/${latestRun.id}/pdf`, '_blank')}
                  data-testid="button-download-pdf"
                >
                  <Download className="w-4 h-4 mr-1" />
                  PDF
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{latestRun.totalTests}</div>
                <div className="text-sm text-muted-foreground">{t('admin.tests.total')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{latestRun.passed}</div>
                <div className="text-sm text-muted-foreground">{t('admin.tests.passed')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{latestRun.failed}</div>
                <div className="text-sm text-muted-foreground">{t('admin.tests.failed')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{latestRun.skipped}</div>
                <div className="text-sm text-muted-foreground">{t('admin.tests.skipped')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{latestRun.duration ? `${(latestRun.duration / 1000).toFixed(1)}s` : '-'}</div>
                <div className="text-sm text-muted-foreground">{t('admin.tests.duration')}</div>
              </div>
            </div>
            {latestRun.status === 'running' && (
              <Progress value={30} className="mt-4" />
            )}
          </CardContent>
        </Card>
      )}

      {/* Test Run History - SECOND */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {t('admin.tests.history')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('admin.tests.loadingHistory')}
            </div>
          ) : runs.length === 0 ? (
            <p className="text-muted-foreground">{t('admin.tests.noTestsRun')}</p>
          ) : (
            <div className="space-y-2">
              {runs.slice(0, historyLimit).map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => setSelectedRun(run.id)}
                  data-testid={`test-run-${run.id}`}
                >
                  <div className="flex items-center gap-3">
                    {run.status === 'running' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    ) : run.failed > 0 ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    <div>
                      <span className="font-medium">#{run.id}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        {run.triggeredBy === 'manual' ? t('admin.tests.manual') : t('admin.tests.scheduled')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600">{run.passed} ✓</span>
                    <span className="text-red-600">{run.failed} ✗</span>
                    <span className="text-muted-foreground">
                      {run.startedAt ? formatDistanceToNow(new Date(run.startedAt), { addSuffix: true, locale: getDateLocale() }) : '-'}
                    </span>
                  </div>
                </div>
              ))}
              {runs.length > historyLimit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setHistoryLimit(prev => prev + 5)}
                  data-testid="button-load-more-history"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('admin.tests.loadOlderResults', { count: runs.length - historyLimit })}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Data Management */}
      <TestDataManagementSection />

      {/* Test Mode Selector */}
      <Card data-testid="card-test-mode">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="w-5 h-5" />
            {t('admin.tests.testMode')}
          </CardTitle>
          <CardDescription>
            {t('admin.tests.testModeDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <RadioGroup
              value={currentMode}
              onValueChange={(value: 'auto' | 'manual') => updateModeMutation.mutate(value)}
              className="flex gap-4"
              disabled={updateModeMutation.isPending}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="auto" id="mode-auto" data-testid="radio-mode-auto" />
                <Label htmlFor="mode-auto" className="flex items-center gap-2 cursor-pointer">
                  <ToggleRight className="w-4 h-4 text-green-500" />
                  <span>{t('admin.tests.automatic')}</span>
                  <span className="text-sm text-muted-foreground">{t('admin.tests.allTests')}</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="mode-manual" data-testid="radio-mode-manual" />
                <Label htmlFor="mode-manual" className="flex items-center gap-2 cursor-pointer">
                  <ToggleLeft className="w-4 h-4 text-orange-500" />
                  <span>{t('admin.tests.manual')}</span>
                  <span className="text-sm text-muted-foreground">{t('admin.tests.selectedTests')}</span>
                </Label>
              </div>
            </RadioGroup>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncTestsMutation.mutate()}
              disabled={syncTestsMutation.isPending}
              data-testid="button-sync-tests"
            >
              {syncTestsMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="ml-2">Synchronisieren</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Environment Info Banner */}
      {environmentInfo && !environmentInfo.playwrightAvailable && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg" data-testid="environment-banner">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              {t('admin.tests.environmentDetected', { environment: t(`admin.tests.environments.${environmentInfo.environment}`) })}
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400">
              {t('admin.tests.e2eOnlyInCICD')}
            </p>
          </div>
        </div>
      )}

      {/* Test Categories by Type - Accordion */}
      <Card data-testid="card-test-configurations">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            {t('admin.tests.testConfiguration')}
          </CardTitle>
          <CardDescription>
            {isAutoMode ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                {t('admin.tests.automaticModeNoteAvailable')}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-orange-600">
                <AlertCircle className="w-4 h-4" />
                {t('admin.tests.manualModeNote')}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('admin.tests.loadingTestConfig')}
            </div>
          ) : testConfigs?.tests ? (
            <Accordion type="multiple" defaultValue={[]} className="w-full">
              {(['unit', 'integration', 'e2e', 'data', 'accessibility'] as const).map((testType) => {
                const tests = (testConfigs.tests as Record<string, any[]>)[testType] || [];
                const enabledCount = tests.filter((t: any) => t.enabled).length;
                const typeInfo = testTypeLabels[testType];
                const isUnavailable = (testType === 'e2e' || testType === 'accessibility') && environmentInfo && !environmentInfo.playwrightAvailable;
                
                return (
                  <AccordionItem key={testType} value={testType} data-testid={`accordion-${testType}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <span className={`p-1.5 rounded ${isUnavailable ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted'}`}>{typeInfo.icon}</span>
                          <div className="text-left">
                            <div className="font-medium flex items-center gap-2">
                              {typeInfo.label}
                              {isUnavailable && (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400" title={t('admin.tests.cicdOnly')}>
                                  <AlertCircle className="w-3 h-3" />
                                  <span className="hidden sm:inline">CI/CD</span>
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">{typeInfo.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isUnavailable && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700 text-xs">
                              {t('admin.tests.notAvailable')}
                            </Badge>
                          )}
                          <Badge variant={isAutoMode ? "secondary" : enabledCount === tests.length ? "default" : "outline"}>
                            {isAutoMode ? tests.length : enabledCount} / {tests.length} {t('admin.tests.active')}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {tests.length === 0 ? (
                        <div className="py-4 text-center text-muted-foreground">
                          {t('admin.tests.noTestsInCategory')}
                        </div>
                      ) : (
                        <div className="space-y-2 py-2">
                          {tests.map((test: any) => (
                            <div
                              key={test.testId}
                              className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                                isAutoMode ? 'bg-muted/30 opacity-60' : 'hover:bg-muted/50'
                              }`}
                              data-testid={`test-item-${test.testId.replace(/[^a-zA-Z0-9]/g, '-')}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate" title={test.testName}>
                                  {test.testName}
                                </div>
                                <div className="text-xs text-muted-foreground truncate" title={test.testFile}>
                                  {test.testFile}
                                </div>
                                {test.description && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {test.description}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-3 ml-4">
                                <Badge variant="outline" className="text-xs">
                                  {test.category}
                                </Badge>
                                {test.lastStatus && (
                                  <Badge
                                    variant={test.lastStatus === 'passed' ? 'default' : test.lastStatus === 'failed' ? 'destructive' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {test.lastStatus === 'passed' ? '✓' : test.lastStatus === 'failed' ? '✗' : '○'}
                                  </Badge>
                                )}
                                <Switch
                                  checked={isAutoMode || test.enabled}
                                  onCheckedChange={(checked) => toggleTestMutation.mutate({ testId: test.testId, enabled: checked })}
                                  disabled={isAutoMode || toggleTestMutation.isPending}
                                  data-testid={`switch-test-${test.testId.replace(/[^a-zA-Z0-9]/g, '-')}`}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('admin.tests.noTestsFoundClickSync')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduler Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarClock className="w-5 h-5" />
            {t('admin.tests.automaticExecution')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="schedule-enabled"
              checked={scheduleForm.enabled}
              onCheckedChange={(checked) => setScheduleForm(prev => ({ ...prev, enabled: checked }))}
              data-testid="switch-schedule-enabled"
            />
            <Label htmlFor="schedule-enabled">{t('admin.tests.enableAutomaticTests')}</Label>
          </div>
          
          {scheduleForm.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="interval-days">{t('admin.tests.intervalDays')}</Label>
                <Input
                  id="interval-days"
                  type="number"
                  min={1}
                  max={30}
                  value={scheduleForm.intervalDays}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, intervalDays: parseInt(e.target.value) || 7 }))}
                  data-testid="input-interval-days"
                />
              </div>
              <div>
                <Label htmlFor="run-time">{t('admin.tests.runTime')}</Label>
                <Input
                  id="run-time"
                  type="time"
                  value={scheduleForm.runTime}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, runTime: e.target.value }))}
                  data-testid="input-run-time"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="notify-email">{t('admin.tests.notificationEmail')}</Label>
                <Input
                  id="notify-email"
                  type="email"
                  placeholder="admin@example.com"
                  value={scheduleForm.notifyEmail || ''}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, notifyEmail: e.target.value }))}
                  data-testid="input-notify-email"
                />
              </div>
            </div>
          )}
          
          <Button
            onClick={() => updateScheduleMutation.mutate(scheduleForm)}
            disabled={updateScheduleMutation.isPending}
            data-testid="button-save-schedule"
          >
            {updateScheduleMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {t('common.save')}
          </Button>
        </CardContent>
      </Card>

      {/* Run Details Dialog */}
      <Dialog open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5" />
              {t('admin.tests.testRunDetailsTitle', { id: selectedRun })}
            </DialogTitle>
          </DialogHeader>
          {runDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4 text-center">
                <button
                  onClick={() => setResultStatusFilter('all')}
                  className={`p-3 rounded cursor-pointer transition-all ${
                    resultStatusFilter === 'all' 
                      ? 'bg-muted ring-2 ring-primary ring-offset-2' 
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                  aria-pressed={resultStatusFilter === 'all'}
                  aria-label={t('admin.tests.showAllTests')}
                  data-testid="filter-all"
                >
                  <div className="text-xl font-bold">{runDetails.totalTests}</div>
                  <div className="text-sm text-muted-foreground">{t('admin.tests.total')}</div>
                </button>
                <button
                  onClick={() => setResultStatusFilter('passed')}
                  className={`p-3 rounded cursor-pointer transition-all ${
                    resultStatusFilter === 'passed' 
                      ? 'bg-green-200 dark:bg-green-900 ring-2 ring-green-500 ring-offset-2' 
                      : 'bg-green-100 dark:bg-green-950 hover:bg-green-200 dark:hover:bg-green-900'
                  }`}
                  aria-pressed={resultStatusFilter === 'passed'}
                  aria-label={t('admin.tests.showPassedOnly')}
                  data-testid="filter-passed"
                >
                  <div className="text-xl font-bold text-green-600">{runDetails.passed}</div>
                  <div className="text-sm text-muted-foreground">{t('admin.tests.passed')}</div>
                </button>
                <button
                  onClick={() => setResultStatusFilter('failed')}
                  className={`p-3 rounded cursor-pointer transition-all ${
                    resultStatusFilter === 'failed' 
                      ? 'bg-red-200 dark:bg-red-900 ring-2 ring-red-500 ring-offset-2' 
                      : 'bg-red-100 dark:bg-red-950 hover:bg-red-200 dark:hover:bg-red-900'
                  }`}
                  aria-pressed={resultStatusFilter === 'failed'}
                  aria-label={t('admin.tests.showFailedOnly')}
                  data-testid="filter-failed"
                >
                  <div className="text-xl font-bold text-red-600">{runDetails.failed}</div>
                  <div className="text-sm text-muted-foreground">{t('admin.tests.failed')}</div>
                </button>
                <button
                  onClick={() => setResultStatusFilter('skipped')}
                  className={`p-3 rounded cursor-pointer transition-all ${
                    resultStatusFilter === 'skipped' 
                      ? 'bg-yellow-200 dark:bg-yellow-900 ring-2 ring-yellow-500 ring-offset-2' 
                      : 'bg-yellow-100 dark:bg-yellow-950 hover:bg-yellow-200 dark:hover:bg-yellow-900'
                  }`}
                  aria-pressed={resultStatusFilter === 'skipped'}
                  aria-label={t('admin.tests.showSkippedOnly')}
                  data-testid="filter-skipped"
                >
                  <div className="text-xl font-bold text-yellow-600">{runDetails.skipped}</div>
                  <div className="text-sm text-muted-foreground">{t('admin.tests.skipped')}</div>
                </button>
              </div>
              
              <div className="space-y-2">
                {runDetails.results
                  ?.filter((result: any) => resultStatusFilter === 'all' || result.status === resultStatusFilter)
                  .map((result: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3 border rounded-lg ${
                      result.status === 'passed' ? 'border-green-200 bg-green-50 dark:bg-green-950/30' :
                      result.status === 'failed' ? 'border-red-200 bg-red-50 dark:bg-red-950/30' :
                      'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {result.status === 'passed' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : result.status === 'failed' ? (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className="font-medium">{result.testName}</span>
                        <Badge variant="outline" className="text-xs">{result.category}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">{result.duration}ms</span>
                    </div>
                    {result.error && (
                      <div className="mt-2 p-2 bg-red-100 dark:bg-red-950 rounded text-sm text-red-700 dark:text-red-300 font-mono">
                        {result.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Test Data Management Section Component
function TestDataManagementSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  interface TestDataStats {
    testPolls: number;
    testUsers: number;
    testVotes: number;
    testOptions: number;
  }

  const { data: testDataStats, isLoading: statsLoading, refetch: refetchStats } = useQuery<TestDataStats>({
    queryKey: ['/api/v1/admin/tests/data-stats'],
    refetchInterval: 30000,
  });

  const purgeTestDataMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/v1/admin/tests/purge-data');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: t('admin.tests.testDataDeleted'), 
        description: t('admin.tests.testDataDeletedDescription', { polls: data.deletedPolls || 0, users: data.deletedUsers || 0 }) 
      });
      refetchStats();
      setShowPurgeConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/extended-stats'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.tests.testDataDeleteError'), variant: 'destructive' });
    },
  });

  const totalTestItems = (testDataStats?.testPolls || 0) + (testDataStats?.testUsers || 0) + (testDataStats?.testVotes || 0) + (testDataStats?.testOptions || 0);

  return (
    <Card data-testid="card-test-data-management">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DatabaseIcon className="w-5 h-5" />
          {t('admin.tests.testDataManagement')}
        </CardTitle>
        <CardDescription>
          {t('admin.tests.testDataDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {statsLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('admin.tests.loadingTestDataStats')}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-blue-600">{testDataStats?.testPolls || 0}</div>
                <div className="text-sm text-muted-foreground">{t('admin.tests.testPolls')}</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-blue-600">{testDataStats?.testOptions || 0}</div>
                <div className="text-sm text-muted-foreground">{t('admin.tests.testOptions')}</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-blue-600">{testDataStats?.testVotes || 0}</div>
                <div className="text-sm text-muted-foreground">{t('admin.tests.testVotes')}</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-blue-600">{testDataStats?.testUsers || 0}</div>
                <div className="text-sm text-muted-foreground">{t('admin.tests.testUsers')}</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-sm text-muted-foreground">
                {totalTestItems === 0 ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    {t('admin.tests.noTestDataPresent')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {t('admin.tests.testDataFound', { count: totalTestItems })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchStats()}
                  data-testid="button-refresh-test-stats"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('common.refresh')}
                </Button>
                <AlertDialog open={showPurgeConfirm} onOpenChange={setShowPurgeConfirm}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={totalTestItems === 0 || purgeTestDataMutation.isPending}
                      data-testid="button-purge-test-data"
                    >
                      {purgeTestDataMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      {t('admin.tests.deleteTestData')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('admin.tests.deleteTestDataTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('admin.tests.deleteTestDataWarning')}
                        <ul className="mt-2 list-disc list-inside">
                          <li>{testDataStats?.testPolls || 0} {t('admin.tests.testPolls')}</li>
                          <li>{testDataStats?.testOptions || 0} {t('admin.tests.testOptions')}</li>
                          <li>{testDataStats?.testVotes || 0} {t('admin.tests.testVotes')}</li>
                          <li>{testDataStats?.testUsers || 0} {t('admin.tests.testUsers')}</li>
                        </ul>
                        {t('admin.tests.deleteTestDataPermanent')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-purge">{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => purgeTestDataMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="button-confirm-purge"
                      >
                        {t('admin.tests.delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WCAGAccessibilityPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: customization, isLoading } = useQuery<CustomizationSettings>({
    queryKey: ['/api/v1/admin/customization'],
  });
  
  const wcagSettings = customization?.wcag || { enforcementEnabled: false, enforceDefaultTheme: true };
  const lastAudit = 'lastAudit' in wcagSettings ? wcagSettings.lastAudit : undefined;
  
  const toggleEnforcementMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await apiRequest('PUT', '/api/v1/admin/wcag/settings', { enforcementEnabled: enabled });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/customization'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/customization'] });
      toast({ title: t('admin.toasts.saved'), description: t('admin.wcag.settingsSaved') });
    },
    onError: () => {
      toast({ title: t('errors.generic'), variant: "destructive" });
    }
  });
  
  const runAuditMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/wcag/audit', {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/customization'] });
      if (data.passed) {
        toast({ title: t('admin.wcag.auditPassed'), description: t('admin.wcag.allColorsMeetWCAG') });
      } else {
        toast({ title: t('admin.wcag.auditFailed'), description: t('admin.wcag.issuesFound', { count: data.issues.length }), variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: t('errors.generic'), variant: "destructive" });
    }
  });
  
  const applyCorrectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/wcag/apply-corrections', {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/customization'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/customization'] });
      toast({ title: t('admin.wcag.correctionsApplied'), description: t('admin.wcag.colorsUpdated') });
    },
    onError: () => {
      toast({ title: t('errors.generic'), variant: "destructive" });
    }
  });
  
  const getTokenLabel = (token: string) => {
    const labels: Record<string, string> = {
      '--primary': t('admin.wcag.primaryColor'),
      '--color-schedule': t('admin.wcag.scheduleColor'),
      '--color-survey': t('admin.wcag.surveyColor'),
      '--color-organization': t('admin.wcag.organizationColor'),
    };
    return labels[token] || token;
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-wcag-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{t('admin.wcag.title')}</h2>
            <p className="text-muted-foreground">{t('admin.wcag.subtitle')}</p>
          </div>
        </div>
      </div>
      
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            {t('admin.wcag.enforcementTitle')}
          </CardTitle>
          <CardDescription>{t('admin.wcag.enforcementDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <Label htmlFor="wcag-enforcement" className="text-base font-medium">
                {t('admin.wcag.autoCorrection')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('admin.wcag.autoCorrectionDescription')}
              </p>
            </div>
            <Switch
              id="wcag-enforcement"
              checked={wcagSettings.enforcementEnabled}
              onCheckedChange={(v) => toggleEnforcementMutation.mutate(v)}
              disabled={toggleEnforcementMutation.isPending}
              data-testid="switch-wcag-enforcement"
            />
          </div>
          
          {wcagSettings.enforcementEnabled && (
            <Alert>
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>
                {t('admin.wcag.enforcementActiveNote')}
              </AlertDescription>
            </Alert>
          )}
          
          {!wcagSettings.enforcementEnabled && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                {t('admin.wcag.enforcementInactiveNote')}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            {t('admin.wcag.auditTitle')}
          </CardTitle>
          <CardDescription>{t('admin.wcag.auditDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => runAuditMutation.mutate()}
              disabled={runAuditMutation.isPending}
              data-testid="button-run-wcag-audit"
            >
              {runAuditMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {t('admin.wcag.runAudit')}
            </Button>
            
            {lastAudit && (
              <span className="text-sm text-muted-foreground">
                {t('admin.wcag.lastAudit')}: {format(new Date(lastAudit.runAt), 'dd.MM.yyyy HH:mm')}
              </span>
            )}
          </div>
          
          {lastAudit && (
            <div className="space-y-4 pt-4 border-t">
              {lastAudit.passed ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">{t('admin.wcag.allColorsMeetWCAG')}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="w-5 h-5" />
                    <span className="font-medium">{t('admin.wcag.issuesFound', { count: lastAudit.issues.length })}</span>
                  </div>
                  
                  <div className="space-y-3">
                    {lastAudit.issues.map((issue: any, idx: number) => (
                      <div key={idx} className="p-4 rounded-lg border bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{getTokenLabel(issue.token)}</span>
                          <Badge variant="destructive">
                            {t('admin.wcag.contrast')}: {issue.contrastRatio}:1
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <span>{t('admin.wcag.current')}:</span>
                            <div 
                              className="w-6 h-6 rounded border" 
                              style={{ backgroundColor: issue.originalValue }}
                            />
                            <code className="text-xs">{issue.originalValue}</code>
                          </div>
                          <ChevronRight className="w-4 h-4" />
                          <div className="flex items-center gap-2">
                            <span>{t('admin.wcag.suggested')}:</span>
                            <div 
                              className="w-6 h-6 rounded border" 
                              style={{ backgroundColor: issue.suggestedValue }}
                            />
                            <code className="text-xs">{issue.suggestedValue}</code>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {t('admin.wcag.requiredRatio')}: {issue.requiredRatio}:1
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Button
                    variant="default"
                    onClick={() => applyCorrectMutation.mutate()}
                    disabled={applyCorrectMutation.isPending}
                    data-testid="button-apply-wcag-corrections"
                  >
                    {applyCorrectMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    {t('admin.wcag.applyCorrections')}
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
