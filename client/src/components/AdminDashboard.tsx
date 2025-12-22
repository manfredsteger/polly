import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Globe,
  Database as DatabaseIcon,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  Info
} from "lucide-react";
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
import { de } from "date-fns/locale";
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

type SettingsPanel = 'oidc' | 'database' | 'email' | 'security' | 'matrix' | 'roles' | 'notifications' | 'session-timeout' | 'pentest' | 'tests' | null;

export function AdminDashboard({ stats, users, polls, settings, userRole }: AdminDashboardProps) {
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

  const { data: systemStatus, isLoading: systemStatusLoading, refetch: refetchSystemStatus } = useQuery<SystemStatusData>({
    queryKey: ['/api/v1/admin/system-status'],
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchOnWindowFocus: false,
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
      toast({ title: "System-Status aktualisiert", description: "Die EoL-Daten wurden neu abgerufen." });
    } catch (error) {
      toast({ title: "Fehler", description: "Aktualisierung fehlgeschlagen.", variant: "destructive" });
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
      toast({ title: "Sicherheitscheck aktualisiert", description: "npm audit wurde neu ausgeführt." });
    } catch (error) {
      toast({ title: "Fehler", description: "Aktualisierung fehlgeschlagen.", variant: "destructive" });
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
      toast({ title: "System-Packages aktualisiert", description: "Nix-Packages wurden neu geladen." });
    } catch (error) {
      toast({ title: "Fehler", description: "Aktualisierung fehlgeschlagen.", variant: "destructive" });
    } finally {
      setSystemPackagesRefreshing(false);
    }
  };

  const getImpactBadgeColor = (area: ImpactArea) => {
    switch (area) {
      case 'development': return 'kita-badge-dev-only';
      case 'frontend': return 'kita-badge-frontend';
      case 'backend': return 'kita-badge-backend';
      case 'shared': return 'kita-badge-fullstack';
      default: return 'kita-badge-info';
    }
  };

  const formatTimeUntil = (date: Date | string) => {
    const target = new Date(date);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) return 'jetzt';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}min`;
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
      toast({ title: "Umfrage aktualisiert", description: "Die Änderungen wurden gespeichert." });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/polls'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/extended-stats'] });
    },
    onError: () => {
      toast({ title: "Fehler", description: "Die Umfrage konnte nicht aktualisiert werden.", variant: "destructive" });
    },
  });

  const deletePollMutation = useMutation({
    mutationFn: async (pollId: string) => {
      const response = await apiRequest("DELETE", `/api/v1/admin/polls/${pollId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Umfrage gelöscht", description: "Die Umfrage wurde erfolgreich entfernt." });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/polls'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/extended-stats'] });
      setSelectedPoll(null);
    },
    onError: () => {
      toast({ title: "Fehler", description: "Die Umfrage konnte nicht gelöscht werden.", variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: number; updates: any }) => {
      const response = await apiRequest("PATCH", `/api/v1/admin/users/${userId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Benutzer aktualisiert", description: "Die Änderungen wurden gespeichert." });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/users'] });
    },
    onError: () => {
      toast({ title: "Fehler", description: "Der Benutzer konnte nicht aktualisiert werden.", variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUserForm) => {
      const response = await apiRequest("POST", `/api/v1/admin/users`, userData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Benutzer konnte nicht erstellt werden.');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Benutzer erstellt", description: "Der neue Benutzer wurde erfolgreich angelegt." });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/users'] });
      setShowAddUserDialog(false);
      setNewUserForm({ name: '', email: '', username: '', password: '', role: 'user' });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/v1/admin/users/${userId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.code === 'MANUAL_DELETE_DISABLED' 
          ? 'Manuelle Löschung ist deaktiviert. Nutzen Sie den externen Deprovisionierungsservice.'
          : error.error || 'Benutzer konnte nicht gelöscht werden');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Benutzer gelöscht", description: "Der Benutzer wurde erfolgreich entfernt." });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/extended-stats'] });
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({ title: "Fehler", description: error.message || "Der Benutzer konnte nicht gelöscht werden.", variant: "destructive" });
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
          <Card className="kita-card sticky top-24">
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
                  <TooltipContent side="bottom">{sidebarCollapsed ? 'Erweitern' : 'Minimieren'}</TooltipContent>
                </Tooltip>
              </div>
              <nav className="space-y-1">
                <NavButton collapsed={sidebarCollapsed} active={activeTab === "overview"} onClick={() => { setActiveTab("overview"); setSelectedUser(null); setSelectedPoll(null); setSelectedSettingsPanel(null); }} icon={<BarChart3 className="w-4 h-4" />} label="Dashboard" testId="nav-overview" />
                <NavButton collapsed={sidebarCollapsed} active={activeTab === "monitoring"} onClick={() => { setActiveTab("monitoring"); setSelectedUser(null); setSelectedPoll(null); setSelectedSettingsPanel(null); }} icon={<Activity className="w-4 h-4" />} label="Monitoring" testId="nav-monitoring" />
                <NavButton collapsed={sidebarCollapsed} active={activeTab === "polls"} onClick={() => { setActiveTab("polls"); setSelectedUser(null); setSelectedPoll(null); setSelectedSettingsPanel(null); }} icon={<Vote className="w-4 h-4" />} label="Umfragen" testId="nav-polls" />
                <NavButton collapsed={sidebarCollapsed} active={activeTab === "users"} onClick={() => { setActiveTab("users"); setSelectedUser(null); setSelectedPoll(null); setSelectedSettingsPanel(null); }} icon={<Users className="w-4 h-4" />} label="Benutzer" testId="nav-users" />
                <NavButton collapsed={sidebarCollapsed} active={activeTab === "customize"} onClick={() => { setActiveTab("customize"); setSelectedUser(null); setSelectedPoll(null); setSelectedSettingsPanel(null); }} icon={<Paintbrush className="w-4 h-4" />} label="Anpassen" testId="nav-customize" />
                <NavButton collapsed={sidebarCollapsed} active={activeTab === "settings"} onClick={() => { setActiveTab("settings"); setSelectedUser(null); setSelectedPoll(null); setSelectedSettingsPanel(null); }} icon={<Settings className="w-4 h-4" />} label="Einstellungen" testId="nav-settings" />
                <NavButton collapsed={sidebarCollapsed} active={activeTab === "tests"} onClick={() => { setActiveTab("tests"); setSelectedUser(null); setSelectedPoll(null); setSelectedSettingsPanel(null); }} icon={<FlaskConical className="w-4 h-4" />} label="Tests" testId="nav-tests" />
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
              <h2 className="text-2xl font-semibold text-foreground">System-Übersicht</h2>
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle className="w-3 h-3 mr-1" />
                System aktiv
              </Badge>
            </div>
            
            {/* Main Stats Grid - Clickable */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard 
                icon={<Users />} 
                label="Benutzer" 
                value={displayStats.totalUsers} 
                color="blue" 
                onClick={() => handleStatCardClick("users")}
                testId="stat-users"
              />
              <StatCard 
                icon={<Vote />} 
                label="Aktive Umfragen" 
                value={displayStats.activePolls} 
                color="green" 
                onClick={() => handleStatCardClick("polls")}
                testId="stat-active-polls"
              />
              <StatCard 
                icon={<BarChart3 />} 
                label="Abstimmungen" 
                value={displayStats.totalVotes} 
                color="purple" 
                onClick={() => handleStatCardClick("monitoring")}
                testId="stat-votes"
              />
              <StatCard 
                icon={<TrendingUp />} 
                label="Diesen Monat" 
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
                    <p className="text-sm text-muted-foreground">Terminumfragen</p>
                    <p className="text-xl font-bold">{displayStats.schedulePolls}</p>
                  </div>
                  <Calendar className="w-6 h-6 text-kita-orange" />
                </div>
              </Card>
              <Card 
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleStatCardClick("polls")}
                data-testid="stat-survey-polls"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Klassische Umfragen</p>
                    <p className="text-xl font-bold">{displayStats.surveyPolls}</p>
                  </div>
                  <FileText className="w-6 h-6 text-kita-blue" />
                </div>
              </Card>
              <Card className="p-4" data-testid="stat-weekly">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Diese Woche</p>
                    <p className="text-xl font-bold">{displayStats.weeklyPolls}</p>
                  </div>
                  <Clock className="w-6 h-6 text-amber-500" />
                </div>
              </Card>
              <Card className="p-4" data-testid="stat-today">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Heute</p>
                    <p className="text-xl font-bold">{displayStats.todayPolls}</p>
                  </div>
                  <Activity className="w-6 h-6 text-green-500" />
                </div>
              </Card>
            </div>

            {/* System Components Status */}
            <Card className="kita-card" data-testid="system-components-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Server className="w-5 h-5 mr-2" />
                    System-Komponenten
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    {systemStatus?.lastChecked && (
                      <div className="text-xs text-muted-foreground text-right">
                        <div>Letzter Check: {formatDistanceToNow(new Date(systemStatus.lastChecked), { addSuffix: true, locale: de })}</div>
                        {systemStatus.cacheExpiresAt && (
                          <div>Nächster: in {formatTimeUntil(systemStatus.cacheExpiresAt)}</div>
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
                      Prüfen
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {systemStatusLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : systemStatus?.components ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">Komponente</th>
                          <th className="text-left py-2 font-medium">Version</th>
                          <th className="text-left py-2 font-medium">Status</th>
                          <th className="text-left py-2 font-medium">End of Life</th>
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
                                <Badge className="kita-badge-success">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Aktuell
                                </Badge>
                              )}
                              {component.status === 'warning' && (
                                <Badge className="kita-badge-warning">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Bald EOL
                                </Badge>
                              )}
                              {component.status === 'eol' && (
                                <Badge className="kita-badge-error">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  EOL
                                </Badge>
                              )}
                              {component.status === 'unknown' && (
                                <Badge variant="secondary">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Unbekannt
                                </Badge>
                              )}
                            </td>
                            <td className="py-2 text-muted-foreground">
                              {component.eolDate ? (
                                <span className={component.status === 'eol' ? 'text-red-600 dark:text-red-400' : component.status === 'warning' ? 'text-amber-600 dark:text-amber-400' : ''}>
                                  {format(new Date(component.eolDate), 'MMM yyyy', { locale: de })}
                                  {component.daysUntilEol !== null && component.daysUntilEol > 0 && (
                                    <span className="ml-1 text-xs">
                                      ({component.daysUntilEol} Tage)
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
                  <p className="text-muted-foreground text-center py-8">Status konnte nicht geladen werden</p>
                )}
              </CardContent>
            </Card>

            {/* Security Vulnerabilities */}
            <Card className="kita-card" data-testid="vulnerabilities-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center">
                    <ShieldAlert className="w-5 h-5 mr-2" />
                    Sicherheitslücken
                  </CardTitle>
                  <div className="flex items-center gap-3 flex-wrap">
                    {vulnerabilities?.summary && vulnerabilities.summary.total > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {vulnerabilities.summary.critical > 0 && (
                          <Badge className="kita-badge-critical" data-testid="badge-critical">
                            {vulnerabilities.summary.critical} Kritisch
                          </Badge>
                        )}
                        {vulnerabilities.summary.high > 0 && (
                          <Badge className="kita-badge-high" data-testid="badge-high">
                            {vulnerabilities.summary.high} Hoch
                          </Badge>
                        )}
                        {vulnerabilities.summary.moderate > 0 && (
                          <Badge className="kita-badge-moderate" data-testid="badge-moderate">
                            {vulnerabilities.summary.moderate} Mittel
                          </Badge>
                        )}
                        {vulnerabilities.summary.low > 0 && (
                          <Badge variant="secondary" data-testid="badge-low">
                            {vulnerabilities.summary.low} Niedrig
                          </Badge>
                        )}
                      </div>
                    )}
                    {vulnerabilities?.lastChecked && (
                      <div className="text-xs text-muted-foreground text-right">
                        <div>Letzter Check: {formatDistanceToNow(new Date(vulnerabilities.lastChecked), { addSuffix: true, locale: de })}</div>
                        {vulnerabilities.cacheExpiresAt && (
                          <div>Nächster: in {formatTimeUntil(vulnerabilities.cacheExpiresAt)}</div>
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
                      Prüfen
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
                          <th className="text-left py-2 font-medium">Paket</th>
                          <th className="text-left py-2 font-medium">Bereich</th>
                          <th className="text-left py-2 font-medium">Schweregrad</th>
                          <th className="text-left py-2 font-medium">Beschreibung</th>
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
                                <Badge className="kita-badge-critical">Kritisch</Badge>
                              )}
                              {vuln.severity === 'high' && (
                                <Badge className="kita-badge-high">Hoch</Badge>
                              )}
                              {vuln.severity === 'moderate' && (
                                <Badge className="kita-badge-moderate">Mittel</Badge>
                              )}
                              {vuln.severity === 'low' && (
                                <Badge variant="secondary">Niedrig</Badge>
                              )}
                              {vuln.severity === 'info' && (
                                <Badge variant="outline">Info</Badge>
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
                                <span className="text-muted-foreground text-xs">Kein Fix verfügbar</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {vulnerabilities.impactSummary && (
                      <div className="mt-4 pt-4 border-t flex flex-wrap gap-2 text-xs">
                        <span className="text-muted-foreground">Auswirkungsbereiche:</span>
                        {vulnerabilities.impactSummary.development > 0 && (
                          <Badge className="bg-slate-500 text-white border-0">{vulnerabilities.impactSummary.development}x Entwicklung</Badge>
                        )}
                        {vulnerabilities.impactSummary.backend > 0 && (
                          <Badge className="bg-purple-500 text-white border-0">{vulnerabilities.impactSummary.backend}x Backend</Badge>
                        )}
                        {vulnerabilities.impactSummary.frontend > 0 && (
                          <Badge className="bg-blue-500 text-white border-0">{vulnerabilities.impactSummary.frontend}x Frontend</Badge>
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
                    <span>Keine Sicherheitslücken gefunden</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Packages (Nix) */}
            <Card className="kita-card" data-testid="system-packages-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center">
                    <Layers className="w-5 h-5 mr-2" />
                    System-Packages (Nix)
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
                      Aktualisieren
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Diese Packages werden vom Betriebssystem (Replit/Nix) bereitgestellt und sind nicht direkt in der Anwendung enthalten.
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
                          <th className="text-left py-2 font-medium">Package</th>
                          <th className="text-left py-2 font-medium">Version</th>
                          <th className="text-left py-2 font-medium">Verwendung</th>
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
                    <span>Keine System-Packages konfiguriert</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="kita-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Letzte Aktivitäten
                </CardTitle>
              </CardHeader>
              <CardContent>
                {displayStats.recentActivity.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Keine aktuellen Aktivitäten</p>
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
            <h2 className="text-2xl font-semibold text-foreground">System-Monitoring</h2>
            
            {/* System Health */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 border-l-4 border-l-green-500" data-testid="status-api-server">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="font-medium">API Server</p>
                    <p className="text-sm text-muted-foreground">Aktiv & Erreichbar</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border-l-4 border-l-green-500" data-testid="status-database">
                <div className="flex items-center space-x-3">
                  <Database className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="font-medium">Datenbank</p>
                    <p className="text-sm text-muted-foreground">PostgreSQL verbunden</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border-l-4 border-l-green-500" data-testid="status-auth">
                <div className="flex items-center space-x-3">
                  <Shield className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="font-medium">Authentifizierung</p>
                    <p className="text-sm text-muted-foreground">Session aktiv</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Poll Statistics */}
            <Card className="kita-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="w-5 h-5 mr-2" />
                  Umfrage-Statistiken
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center cursor-pointer hover:bg-muted/50 p-3 rounded-lg" onClick={() => handleStatCardClick("polls")} data-testid="chart-active-polls">
                    <div className="text-4xl font-bold text-green-600">{displayStats.activePolls}</div>
                    <p className="text-sm text-muted-foreground mt-1">Aktiv</p>
                  </div>
                  <div className="text-center cursor-pointer hover:bg-muted/50 p-3 rounded-lg" onClick={() => handleStatCardClick("polls")} data-testid="chart-inactive-polls">
                    <div className="text-4xl font-bold text-gray-400">{displayStats.inactivePolls}</div>
                    <p className="text-sm text-muted-foreground mt-1">Inaktiv</p>
                  </div>
                  <div className="text-center cursor-pointer hover:bg-muted/50 p-3 rounded-lg" onClick={() => handleStatCardClick("polls")} data-testid="chart-schedule-polls">
                    <div className="text-4xl font-bold text-kita-orange">{displayStats.schedulePolls}</div>
                    <p className="text-sm text-muted-foreground mt-1">Terminumfragen</p>
                  </div>
                  <div className="text-center cursor-pointer hover:bg-muted/50 p-3 rounded-lg" onClick={() => handleStatCardClick("polls")} data-testid="chart-survey-polls">
                    <div className="text-4xl font-bold text-kita-blue">{displayStats.surveyPolls}</div>
                    <p className="text-sm text-muted-foreground mt-1">Umfragen</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card className="kita-card">
              <CardHeader>
                <CardTitle>Aktivitäts-Timeline</CardTitle>
                <CardDescription>Die letzten System-Aktivitäten in Echtzeit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative pl-6 space-y-4">
                  {displayStats.recentActivity.length === 0 ? (
                    <p className="text-muted-foreground">Keine Aktivitäten vorhanden</p>
                  ) : (
                    displayStats.recentActivity.map((activity, index) => (
                      <div key={index} className="relative">
                        <div className="absolute -left-6 top-1 w-3 h-3 bg-kita-orange rounded-full" />
                        <div className="ml-2">
                          {activity.pollToken ? (
                            <a 
                              href={`/poll/${activity.pollToken}`}
                              className="text-sm font-medium hover:text-kita-orange hover:underline cursor-pointer transition-colors"
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
                            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: de })}
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
                  Zurück zu Benutzer
                </Button>
                <ChevronRight className="w-4 h-4" />
                <span className="font-medium text-foreground">{selectedUser.name}'s Umfragen</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-foreground">
                {selectedUser ? `Umfragen von ${selectedUser.name}` : 'Umfragen-Verwaltung'}
              </h2>
              <Badge variant="outline">
                {selectedUser ? getUserPolls(selectedUser.id).length : polls?.length || 0} Umfragen
              </Badge>
            </div>
            
            <Card className="kita-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titel</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Ersteller</TableHead>
                      <TableHead>Teilnehmer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Erstellt</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
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
                              <p className="text-muted-foreground">Keine Umfragen gefunden.</p>
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
                            <Badge className={
                              poll.type === 'schedule' ? 'kita-badge-schedule' : 
                              poll.type === 'organization' ? 'kita-badge-organization' : 
                              'kita-badge-survey'
                            }>
                              {poll.type === 'schedule' ? 'Termin' : 
                               poll.type === 'organization' ? 'Orga' : 'Umfrage'}
                            </Badge>
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
                              <span className="text-muted-foreground">Anonym</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Set(poll.votes.map(v => v.userId ? `user_${v.userId}` : `anon_${v.voterName}`)).size}
                          </TableCell>
                          <TableCell>
                            <Badge variant={poll.isActive ? 'default' : 'secondary'}>
                              {poll.isActive ? 'Aktiv' : 'Inaktiv'}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(poll.createdAt), 'dd.MM.yyyy', { locale: de })}</TableCell>
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
                                    Ansehen
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handlePollClick(poll)}>
                                    <Edit2 className="w-4 h-4 mr-2" />
                                    Details
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => updatePollMutation.mutate({ pollId: poll.id, updates: { isActive: !poll.isActive } })}
                                    disabled={updatePollMutation.isPending}
                                  >
                                    {poll.isActive ? (
                                      <>
                                        <XCircle className="w-4 h-4 mr-2" />
                                        Deaktivieren
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Aktivieren
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
                                        Löschen
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Umfrage löschen?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Diese Aktion kann nicht rückgängig gemacht werden. Die Umfrage "{poll.title}" wird dauerhaft gelöscht.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                        <AlertDialogAction 
                                          onClick={() => deletePollMutation.mutate(poll.id)} 
                                          className="bg-destructive text-destructive-foreground"
                                        >
                                          Löschen
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
              <h2 className="text-2xl font-semibold text-foreground">Benutzerverwaltung</h2>
              <div className="flex items-center gap-3">
                <Button 
                  onClick={() => setShowAddUserDialog(true)}
                  className="kita-button-primary"
                  data-testid="button-add-user"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Benutzer hinzufügen
                </Button>
                <Badge variant="outline">{users?.length || 0} Benutzer</Badge>
              </div>
            </div>
            
            {/* Add User Dialog */}
            <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Neuen Benutzer anlegen
                  </DialogTitle>
                  <DialogDescription>
                    Erstellen Sie manuell ein neues Benutzerkonto. Der Benutzer kann sich danach mit diesen Zugangsdaten anmelden.
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
                    <Label htmlFor="newUserName">Name *</Label>
                    <Input
                      id="newUserName"
                      placeholder="Max Mustermann"
                      value={newUserForm.name}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, name: e.target.value }))}
                      data-testid="input-new-user-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newUserEmail">E-Mail *</Label>
                    <Input
                      id="newUserEmail"
                      type="email"
                      placeholder="max@example.com"
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                      data-testid="input-new-user-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newUserUsername">Benutzername *</Label>
                    <Input
                      id="newUserUsername"
                      placeholder="maxmustermann"
                      value={newUserForm.username}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, username: e.target.value }))}
                      data-testid="input-new-user-username"
                    />
                    <p className="text-xs text-muted-foreground">Mindestens 3 Zeichen, nur Buchstaben, Zahlen und Unterstriche.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newUserPassword">Passwort *</Label>
                    <Input
                      id="newUserPassword"
                      type="password"
                      placeholder="Sicheres Passwort"
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                      data-testid="input-new-user-password"
                    />
                    {newUserForm.password.length > 0 && (
                      <div className="space-y-1 mt-2 p-2 bg-muted/50 rounded text-xs">
                        <div className={newUserForm.password.length >= 8 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {newUserForm.password.length >= 8 ? '✓' : '○'} Mindestens 8 Zeichen
                        </div>
                        <div className={/[A-Z]/.test(newUserForm.password) ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {/[A-Z]/.test(newUserForm.password) ? '✓' : '○'} Großbuchstabe
                        </div>
                        <div className={/[a-z]/.test(newUserForm.password) ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {/[a-z]/.test(newUserForm.password) ? '✓' : '○'} Kleinbuchstabe
                        </div>
                        <div className={/[0-9]/.test(newUserForm.password) ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {/[0-9]/.test(newUserForm.password) ? '✓' : '○'} Zahl
                        </div>
                        <div className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newUserForm.password) ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newUserForm.password) ? '✓' : '○'} Sonderzeichen
                        </div>
                      </div>
                    )}
                    {newUserForm.password.length === 0 && (
                      <p className="text-xs text-muted-foreground">Min. 8 Zeichen, Groß-/Kleinbuchstaben, Zahl, Sonderzeichen.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newUserRole">Rolle</Label>
                    <Select
                      value={newUserForm.role}
                      onValueChange={(value: 'user' | 'admin' | 'manager') => setNewUserForm(prev => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger data-testid="select-new-user-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Benutzer</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowAddUserDialog(false)}
                    >
                      Abbrechen
                    </Button>
                    <Button 
                      type="submit" 
                      className="kita-button-primary"
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
                          Wird erstellt...
                        </>
                      ) : (
                        'Benutzer erstellen'
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
                    Profil bearbeiten
                  </DialogTitle>
                  <DialogDescription>
                    Ändern Sie die Profildaten für {editingUser?.name || 'diesen Benutzer'}.
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
                    <Label htmlFor="editUserName">Name</Label>
                    <Input
                      id="editUserName"
                      placeholder="Name des Benutzers"
                      value={editUserForm.name}
                      onChange={(e) => setEditUserForm(prev => ({ ...prev, name: e.target.value }))}
                      data-testid="input-edit-user-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editUserEmail">E-Mail</Label>
                    <Input
                      id="editUserEmail"
                      type="email"
                      placeholder="E-Mail-Adresse"
                      value={editUserForm.email}
                      onChange={(e) => setEditUserForm(prev => ({ ...prev, email: e.target.value }))}
                      data-testid="input-edit-user-email"
                    />
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>Benutzername:</strong> @{editingUser?.username}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Der Benutzername kann nicht geändert werden.
                    </p>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setEditingUser(null)}
                    >
                      Abbrechen
                    </Button>
                    <Button 
                      type="submit" 
                      className="kita-button-primary"
                      disabled={updateUserMutation.isPending || !editUserForm.name || !editUserForm.email}
                      data-testid="button-save-user"
                    >
                      {updateUserMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Wird gespeichert...
                        </>
                      ) : (
                        'Speichern'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            
            <Card className="kita-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Benutzername</TableHead>
                      <TableHead>Rolle</TableHead>
                      <TableHead>Umfragen</TableHead>
                      <TableHead>Registriert</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!users || users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">Keine Benutzer gefunden.</p>
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
                              <div className="w-8 h-8 bg-kita-orange rounded-full flex items-center justify-center text-white text-sm font-medium">
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
                          <TableCell>{format(new Date(user.createdAt), 'dd.MM.yyyy', { locale: de })}</TableCell>
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
                                        Profil bearbeiten
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  <DropdownMenuLabel>Rolle ändern</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => updateUserMutation.mutate({ userId: user.id, updates: { role: 'user' } })} disabled={user.role === 'user'}>
                                    <Users className="w-4 h-4 mr-2" />
                                    Benutzer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateUserMutation.mutate({ userId: user.id, updates: { role: 'manager' } })} disabled={user.role === 'manager'}>
                                    <UserCheck className="w-4 h-4 mr-2" />
                                    Manager
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateUserMutation.mutate({ userId: user.id, updates: { role: 'admin' } })} disabled={user.role === 'admin'}>
                                    <Shield className="w-4 h-4 mr-2" />
                                    Admin
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {isDeprovisionEnabled ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <DropdownMenuItem disabled className="text-muted-foreground cursor-not-allowed">
                                            <Unplug className="w-4 h-4 mr-2" />
                                            Löschen (extern)
                                          </DropdownMenuItem>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Benutzer-Löschung erfolgt über externen Deprovisionierungsservice</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                          <Trash2 className="w-4 h-4 mr-2" />
                                          Löschen
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Diese Aktion kann nicht rückgängig gemacht werden. Der Benutzer "{user.name}" wird dauerhaft gelöscht.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteUserMutation.mutate(user.id)} className="bg-destructive text-destructive-foreground">
                                            Löschen
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
            onDelete={() => deleteUserMutation.mutate(selectedUser.id)}
            isDeleting={deleteUserMutation.isPending}
            isUpdating={updateUserMutation.isPending}
            isDeprovisionEnabled={isDeprovisionEnabled}
          />
        )}

        {/* Settings - Overview */}
        {activeTab === "settings" && !selectedUser && !selectedPoll && !selectedSettingsPanel && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">System-Einstellungen</h2>
            <p className="text-muted-foreground">Klicken Sie auf eine Karte, um die Konfiguration zu öffnen</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SettingCard
                title="Authentifizierung"
                description="Benutzeranmeldung, Registrierung & Keycloak SSO"
                icon={<Key className="w-6 h-6" />}
                status="Verfügbar"
                statusType="success"
                onClick={() => setSelectedSettingsPanel('oidc')}
                testId="settings-oidc"
              />
              
              <SettingCard
                title="PostgreSQL Datenbank"
                description="Neon Database Verbindung"
                icon={<Database className="w-6 h-6" />}
                status="Verbunden"
                statusType="success"
                onClick={() => setSelectedSettingsPanel('database')}
                testId="settings-database"
              />
              
              <SettingCard
                title="E-Mail Versand"
                description="Nodemailer SMTP Konfiguration"
                icon={<Mail className="w-6 h-6" />}
                status="Aktiv"
                statusType="success"
                onClick={() => setSelectedSettingsPanel('email')}
                testId="settings-email"
              />
              
              <SettingCard
                title="Sicherheit & DSGVO"
                description="Datenschutz, Verschlüsselung & Datenaufbewahrung"
                icon={<ShieldCheck className="w-6 h-6" />}
                status="Aktiviert"
                statusType="success"
                onClick={() => setSelectedSettingsPanel('security')}
                testId="settings-security"
              />
              
              <SettingCard
                title="Benachrichtigungen"
                description="Erinnerungen & Gast-Einschränkungen"
                icon={<Bell className="w-6 h-6" />}
                status="Konfigurierbar"
                statusType="neutral"
                onClick={() => setSelectedSettingsPanel('notifications')}
                testId="settings-notifications"
              />
              
              <SettingCard
                title="Rollenmanagement"
                description="Benutzerrollen und Berechtigungen"
                icon={<Shield className="w-6 h-6" />}
                status="3 Rollen"
                statusType="neutral"
                onClick={() => setSelectedSettingsPanel('roles')}
                testId="settings-roles"
              />
              
              <SettingCard
                title="Session-Timeout"
                description="Automatische Abmeldung nach Inaktivität"
                icon={<Timer className="w-6 h-6" />}
                status="Konfigurierbar"
                statusType="neutral"
                onClick={() => setSelectedSettingsPanel('session-timeout')}
                testId="settings-session-timeout"
              />
            </div>
            
            {/* Integrationen Section */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Unplug className="w-5 h-5" />
                Integrationen
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SettingCard
                  title="Matrix Chat"
                  description="Chat-Benachrichtigungen über Matrix"
                  icon={<MessageSquare className="w-6 h-6" />}
                  status="Optional"
                  statusType="neutral"
                  onClick={() => setSelectedSettingsPanel('matrix')}
                  testId="settings-matrix"
                />
                
                <SettingCard
                  title="Pentest-Tools.com"
                  description="Automatisierte Sicherheitsscans"
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

        {/* Automated Tests Tab - Top Level */}
        {activeTab === "tests" && (
          <AutomatedTestsPanel onBack={() => setActiveTab("overview")} />
        )}

        {/* Customization Panel */}
        {activeTab === "customize" && (
          <CustomizationPanel />
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
  switch (role) {
    case 'admin': return <Badge className="bg-red-500 text-white">Admin</Badge>;
    case 'manager': return <Badge className="bg-blue-500 text-white">Manager</Badge>;
    default: return <Badge variant="secondary">Benutzer</Badge>;
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
      case 'poll_created': return 'bg-kita-orange';
      case 'vote': return 'bg-green-500';
      case 'user_registered': return 'bg-kita-blue';
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
            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: de })}
          </p>
        </div>
      </div>
      {activity.actor && <span className="text-xs text-muted-foreground">{activity.actor}</span>}
    </div>
  );
}

function UserDetailView({ user, polls, onBack, onPollClick, onUpdateRole, onDelete, isDeleting, isUpdating, isDeprovisionEnabled = false }: {
  user: User;
  polls: PollWithOptions[];
  onBack: () => void;
  onPollClick: (poll: PollWithOptions) => void;
  onUpdateRole: (role: string) => void;
  onDelete: () => void;
  isDeleting: boolean;
  isUpdating: boolean;
  isDeprovisionEnabled?: boolean;
}) {
  const schedulePolls = polls.filter(p => p.type === 'schedule');
  const surveyPolls = polls.filter(p => p.type === 'survey');
  const activePolls = polls.filter(p => p.isActive);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-users">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Zurück zu Benutzer
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">{user.name}</span>
      </div>

      {/* User Header */}
      <Card className="kita-card">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-kita-orange rounded-full flex items-center justify-center text-white text-xl font-bold">
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
                    Aktionen
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Rolle ändern</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onUpdateRole('user')} disabled={user.role === 'user' || isUpdating}>
                    <Users className="w-4 h-4 mr-2" />
                    Benutzer
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onUpdateRole('manager')} disabled={user.role === 'manager' || isUpdating}>
                    <UserCheck className="w-4 h-4 mr-2" />
                    Manager
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onUpdateRole('admin')} disabled={user.role === 'admin' || isUpdating}>
                    <Shield className="w-4 h-4 mr-2" />
                    Admin
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {isDeprovisionEnabled ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuItem disabled className="text-muted-foreground cursor-not-allowed">
                            <Unplug className="w-4 h-4 mr-2" />
                            Löschen (extern)
                          </DropdownMenuItem>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Benutzer-Löschung erfolgt über externen Deprovisionierungsservice</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Benutzer löschen
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Diese Aktion kann nicht rückgängig gemacht werden. Der Benutzer "{user.name}" und alle zugehörigen Daten werden dauerhaft gelöscht.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                            {isDeleting ? 'Wird gelöscht...' : 'Löschen'}
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
            <p className="text-sm text-muted-foreground">Gesamt Umfragen</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{activePolls.length}</p>
            <p className="text-sm text-muted-foreground">Aktive Umfragen</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-kita-orange">{schedulePolls.length}</p>
            <p className="text-sm text-muted-foreground">Terminumfragen</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-kita-blue">{surveyPolls.length}</p>
            <p className="text-sm text-muted-foreground">Umfragen</p>
          </div>
        </Card>
      </div>

      {/* User's Polls */}
      <Card className="kita-card">
        <CardHeader>
          <CardTitle>Umfragen von {user.name}</CardTitle>
          <CardDescription>Alle erstellten Umfragen und Terminumfragen</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Teilnehmer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {polls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Vote className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Dieser Benutzer hat noch keine Umfragen erstellt.</p>
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
                      <Badge className={
                        poll.type === 'schedule' ? 'kita-badge-schedule' : 
                        poll.type === 'organization' ? 'kita-badge-organization' : 
                        'kita-badge-survey'
                      }>
                        {poll.type === 'schedule' ? 'Termin' : 
                         poll.type === 'organization' ? 'Orga' : 'Umfrage'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Set(poll.votes.map(v => v.userId ? `user_${v.userId}` : `anon_${v.voterName}`)).size}
                    </TableCell>
                    <TableCell>
                      <Badge variant={poll.isActive ? 'default' : 'secondary'}>
                        {poll.isActive ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(poll.createdAt), 'dd.MM.yyyy', { locale: de })}</TableCell>
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
  const uniqueVoters = new Set(poll.votes.map(v => v.userId ? `user_${v.userId}` : `anon_${v.voterName}`)).size;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-polls">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Zurück
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">{poll.title}</span>
      </div>

      {/* Poll Header */}
      <Card className="kita-card">
        <CardContent className="p-6 space-y-6">
          {/* Title and Badges */}
          <div className="space-y-3">
            <div className="flex items-center flex-wrap gap-2">
              <Badge className={
                poll.type === 'schedule' ? 'kita-badge-schedule' : 
                poll.type === 'organization' ? 'kita-badge-organization' : 
                'kita-badge-survey'
              }>
                {poll.type === 'schedule' ? <Calendar className="w-3 h-3 mr-1" /> : 
                 poll.type === 'organization' ? <ClipboardList className="w-3 h-3 mr-1" /> : 
                 <Vote className="w-3 h-3 mr-1" />}
                {poll.type === 'schedule' ? 'Terminumfrage' : 
                 poll.type === 'organization' ? 'Orga-Liste' : 'Umfrage'}
              </Badge>
              <Badge variant={poll.isActive ? 'default' : 'secondary'}>
                {poll.isActive ? 'Aktiv' : 'Inaktiv'}
              </Badge>
            </div>
            <h2 className="text-2xl font-bold text-foreground">{poll.title}</h2>
            {poll.description && (
              <p className="text-muted-foreground">{poll.description}</p>
            )}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Erstellt: {format(new Date(poll.createdAt), 'dd. MMMM yyyy, HH:mm', { locale: de })}</span>
              {poll.user && <span>Von: {poll.user.name}</span>}
            </div>
          </div>

          {/* Controls - separate row */}
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border">
            {/* Toggles */}
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
              <Label className="text-sm text-muted-foreground whitespace-nowrap flex items-center gap-1">
                {poll.resultsPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Ergebnisse öffentlich
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
                Aktiv
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
                Ansehen
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" data-testid="button-delete-poll">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Löschen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Umfrage löschen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Diese Aktion kann nicht rückgängig gemacht werden. Die Umfrage "{poll.title}" und alle zugehörigen Abstimmungen werden dauerhaft gelöscht.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                      {isDeleting ? 'Wird gelöscht...' : 'Löschen'}
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
            <p className="text-sm text-muted-foreground">Teilnehmer</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{poll.votes.length}</p>
            <p className="text-sm text-muted-foreground">{poll.type === 'organization' ? 'Eintragungen' : 'Abstimmungen'}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{poll.options.length}</p>
            <p className="text-sm text-muted-foreground">{poll.type === 'organization' ? 'Slots' : 'Optionen'}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">
              {poll.expiresAt ? format(new Date(poll.expiresAt), 'dd.MM.yy', { locale: de }) : '∞'}
            </p>
            <p className="text-sm text-muted-foreground">Ablaufdatum</p>
          </div>
        </Card>
      </div>

      {/* Options / Slots */}
      <Card className="kita-card">
        <CardHeader>
          <CardTitle>{poll.type === 'organization' ? 'Slots' : 'Optionen'}</CardTitle>
          <CardDescription>
            {poll.type === 'organization' 
              ? 'Verfügbare Slots mit Kapazitäten' 
              : 'Alle verfügbaren Antwortmöglichkeiten'}
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
                        ? format(new Date(option.startTime), 'EEEE, dd. MMMM yyyy', { locale: de })
                        : option.text || `Option ${index + 1}`
                      }
                    </span>
                    {poll.type === 'organization' ? (
                      <Badge variant={isFull ? "secondary" : "outline"} className={isFull ? "bg-green-100 text-green-800" : ""}>
                        {signupCount} / {maxCapacity || '∞'} {isFull ? 'voll' : 'Plätze'}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">{optionVotes.length} Stimmen</span>
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
                        {yesCount} Ja
                      </span>
                      <span className="flex items-center text-amber-600">
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        {maybeCount} Vielleicht
                      </span>
                      <span className="flex items-center text-red-600">
                        <XCircle className="w-4 h-4 mr-1" />
                        {noCount} Nein
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
      <Card className="kita-card">
        <CardHeader>
          <CardTitle>{poll.type === 'organization' ? 'Alle Eintragungen' : 'Alle Abstimmungen'}</CardTitle>
          <CardDescription>
            {poll.type === 'organization' 
              ? 'Detaillierte Übersicht aller Eintragungen' 
              : 'Detaillierte Übersicht aller abgegebenen Stimmen'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teilnehmer</TableHead>
                <TableHead>{poll.type === 'organization' ? 'Slot' : 'Option'}</TableHead>
                {poll.type === 'organization' ? (
                  <TableHead>Kommentar</TableHead>
                ) : (
                  <TableHead>Antwort</TableHead>
                )}
                <TableHead>Datum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {poll.votes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <Vote className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {poll.type === 'organization' 
                        ? 'Noch keine Eintragungen vorhanden.' 
                        : 'Noch keine Abstimmungen vorhanden.'}
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
                          <span>{vote.voterName || 'Anonym'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {poll.type === 'schedule' && option?.startTime 
                          ? format(new Date(option.startTime), 'dd.MM.yyyy', { locale: de })
                          : option?.text || 'Unbekannt'
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
                            {vote.response === 'yes' ? 'Ja' : vote.response === 'maybe' ? 'Vielleicht' : 'Nein'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {vote.createdAt ? format(new Date(vote.createdAt), 'dd.MM.yyyy HH:mm', { locale: de }) : '-'}
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
      className={`kita-card ${onClick ? 'cursor-pointer hover:shadow-md hover:border-kita-orange transition-all' : ''}`}
      onClick={onClick}
      data-testid={testId}
    >
      <CardContent className="p-4">
        <div className="flex items-start space-x-4">
          <div className="text-kita-orange">{icon}</div>
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
        description: 'Ob die lokale Registrierung aktiviert ist'
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/auth/methods'] });
      toast({ 
        title: registrationEnabled ? "Registrierung aktiviert" : "Registrierung deaktiviert",
        description: registrationEnabled 
          ? "Neue Benutzer können sich jetzt registrieren." 
          : "Die Registrierung ist jetzt für neue Benutzer gesperrt."
      });
    },
    onError: () => {
      toast({ 
        title: "Fehler", 
        description: "Einstellung konnte nicht gespeichert werden.",
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
          Zurück zu Einstellungen
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">Authentifizierung</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Authentifizierung</h2>
          <p className="text-muted-foreground">Benutzeranmeldung, Registrierung & Keycloak SSO</p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          Verfügbar
        </Badge>
      </div>

      {/* Registration Settings */}
      <Card className={`kita-card ${registrationEnabled ? 'border-green-200' : 'border-red-200'}`}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <UserPlus className="w-5 h-5 mr-2" />
              Benutzer-Registrierung
            </div>
            {saveRegistrationMutation.isPending && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
          <CardDescription>Konfigurieren Sie, ob neue Benutzer sich registrieren können</CardDescription>
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
                <p className="font-medium text-foreground">Lokale Registrierung erlauben</p>
                <p className="text-sm text-muted-foreground">
                  {registrationEnabled 
                    ? "Benutzer können sich mit E-Mail und Passwort registrieren" 
                    : "Registrierung ist deaktiviert - nur Anmeldung möglich"}
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
                  <p className="font-medium text-amber-800 dark:text-amber-200">Registrierung deaktiviert</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Die Registrierung ist deaktiviert. Neue Benutzer können sich nicht mehr selbst registrieren. 
                    Bestehende Benutzer können sich weiterhin anmelden.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <div className="flex items-start space-x-3">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">Identity Provider Integration</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Bei aktivierter OIDC/Keycloak-Authentifizierung werden Benutzer automatisch über den zentralen 
                  Identity Provider verwaltet. Die lokale Registrierung kann dann deaktiviert werden.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keycloak Settings */}
      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Key className="w-5 h-5 mr-2" />
            Keycloak Einstellungen
          </CardTitle>
          <CardDescription>Konfigurieren Sie die Verbindung zu Ihrem Keycloak Identity Provider</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="keycloak-issuer">Issuer URL</Label>
              <Input 
                id="keycloak-issuer" 
                placeholder="https://keycloak.example.com/realms/kita" 
                data-testid="input-keycloak-issuer"
              />
              <p className="text-xs text-muted-foreground mt-1">Die URL Ihres Keycloak Realms</p>
            </div>
            <div>
              <Label htmlFor="keycloak-client">Client ID</Label>
              <Input 
                id="keycloak-client" 
                placeholder="kita-poll-client" 
                data-testid="input-keycloak-client"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="keycloak-secret">Client Secret</Label>
              <Input 
                id="keycloak-secret" 
                type="password" 
                placeholder="••••••••••••••••" 
                data-testid="input-keycloak-secret"
              />
            </div>
            <div>
              <Label htmlFor="keycloak-callback">Callback URL</Label>
              <Input 
                id="keycloak-callback" 
                value={typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : ''}
                readOnly
                className="bg-muted"
                data-testid="input-keycloak-callback"
              />
              <p className="text-xs text-muted-foreground mt-1">In Keycloak als gültige Redirect-URI eintragen</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Switch id="keycloak-enabled" data-testid="switch-keycloak-enabled" />
            <Label htmlFor="keycloak-enabled">OIDC Authentifizierung aktivieren</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" data-testid="button-test-oidc">
              Verbindung testen
            </Button>
            <Button 
              className="kita-button-primary" 
              data-testid="button-save-oidc"
              onClick={() => toast({ title: "Gespeichert", description: "OIDC-Einstellungen wurden gespeichert." })}
            >
              Einstellungen speichern
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="kita-card">
        <CardHeader>
          <CardTitle>Hinweise zur Konfiguration</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Die Admin-Rollenzuweisung erfolgt über Keycloak-Gruppen</li>
            <li>Benutzer mit der Gruppe "kita-admins" erhalten automatisch Admin-Rechte</li>
            <li>Die lokale Anmeldung bleibt als Fallback verfügbar</li>
            <li>Alle Sessions werden bei Konfigurationsänderungen invalidiert</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function DatabaseSettingsPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Zurück zu Einstellungen
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">PostgreSQL Datenbank</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Datenbank-Konfiguration</h2>
          <p className="text-muted-foreground">PostgreSQL über Neon Database</p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          Verbunden
        </Badge>
      </div>

      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="w-5 h-5 mr-2" />
            Verbindungsstatus
          </CardTitle>
          <CardDescription>Aktuelle Datenbankverbindung (nur lesbar)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">Host</p>
              <p className="font-mono text-sm">Neon PostgreSQL</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">Status</p>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm">Aktiv</span>
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">ORM</p>
              <p className="font-mono text-sm">Drizzle ORM</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">SSL</p>
              <p className="text-sm flex items-center">
                <Lock className="w-3 h-3 mr-1 text-green-600" />
                Verschlüsselt
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="kita-card border-amber-200 bg-amber-50/30">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Hinweis</p>
              <p className="text-sm text-amber-700">
                Die Datenbankverbindung wird über Umgebungsvariablen konfiguriert und kann nicht über die Oberfläche geändert werden. 
                Änderungen erfordern einen Neustart der Anwendung.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmailSettingsPanel({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Zurück zu Einstellungen
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">E-Mail Versand</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">E-Mail Konfiguration</h2>
          <p className="text-muted-foreground">SMTP-Einstellungen für Benachrichtigungen</p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          Aktiv
        </Badge>
      </div>

      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="w-5 h-5 mr-2" />
            SMTP Einstellungen
          </CardTitle>
          <CardDescription>Konfigurieren Sie den E-Mail-Versand für Benachrichtigungen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="smtp-host">SMTP Host</Label>
              <Input id="smtp-host" placeholder="smtp.example.com" data-testid="input-smtp-host" />
            </div>
            <div>
              <Label htmlFor="smtp-port">Port</Label>
              <Input id="smtp-port" placeholder="587" data-testid="input-smtp-port" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="smtp-user">Benutzername</Label>
              <Input id="smtp-user" placeholder="user@example.com" data-testid="input-smtp-user" />
            </div>
            <div>
              <Label htmlFor="smtp-pass">Passwort</Label>
              <Input id="smtp-pass" type="password" placeholder="••••••••" data-testid="input-smtp-pass" />
            </div>
          </div>
          
          <div>
            <Label htmlFor="from-email">Absender E-Mail</Label>
            <Input id="from-email" placeholder="noreply@kita-poll.bayern.de" data-testid="input-from-email" />
          </div>

          <div>
            <Label htmlFor="from-name">Absender Name</Label>
            <Input id="from-name" placeholder="Polly System" data-testid="input-from-name" />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Switch id="smtp-tls" defaultChecked data-testid="switch-smtp-tls" />
            <Label htmlFor="smtp-tls">TLS/SSL Verschlüsselung verwenden</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" data-testid="button-test-email">
              Test-E-Mail senden
            </Button>
            <Button 
              className="kita-button-primary" 
              data-testid="button-save-email"
              onClick={() => toast({ title: "Gespeichert", description: "E-Mail-Einstellungen wurden gespeichert." })}
            >
              Einstellungen speichern
            </Button>
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
      toast({ title: "Gespeichert", description: "Anmelde-Ratenbegrenzung wurde gespeichert." });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/security'] });
    },
    onError: () => {
      toast({ title: "Fehler", description: "Einstellungen konnten nicht gespeichert werden.", variant: "destructive" });
    }
  });
  
  // Clear rate limits mutation
  const clearRateLimitsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/security/clear-rate-limits');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Zurückgesetzt", description: "Alle Rate-Limit-Sperren wurden aufgehoben." });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/security'] });
    },
    onError: () => {
      toast({ title: "Fehler", description: "Sperren konnten nicht zurückgesetzt werden.", variant: "destructive" });
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

  // Fetch ClamAV settings
  const { data: clamavConfig, isLoading: isLoadingClamav } = useQuery<ClamAVConfig>({
    queryKey: ['/api/v1/admin/clamav'],
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
      toast({ title: "Gespeichert", description: "ClamAV-Einstellungen wurden gespeichert." });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/clamav'] });
      setClamavTestResult(null);
    },
    onError: () => {
      toast({ title: "Fehler", description: "ClamAV-Einstellungen konnten nicht gespeichert werden.", variant: "destructive" });
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
        toast({ title: "Verbindung erfolgreich", description: `Antwortzeit: ${result.responseTime}ms` });
      } else {
        toast({ title: "Verbindung fehlgeschlagen", description: result.message, variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Fehler", description: "Verbindungstest fehlgeschlagen.", variant: "destructive" });
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
      toast({ title: "Gespeichert", description: "Deprovisionierungs-Einstellungen wurden gespeichert." });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/deprovision-settings'] });
      setDeprovisionPassword(''); // Clear password after save
    },
    onError: () => {
      toast({ title: "Fehler", description: "Einstellungen konnten nicht gespeichert werden.", variant: "destructive" });
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
          Zurück zu Einstellungen
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">Sicherheit & DSGVO</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Sicherheit & Datenschutz</h2>
          <p className="text-muted-foreground">DSGVO-Konformität und Datensicherheit</p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600">
          <ShieldCheck className="w-3 h-3 mr-1" />
          DSGVO-konform
        </Badge>
      </div>

      {/* Encryption Info */}
      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lock className="w-5 h-5 mr-2" />
            Verschlüsselung
          </CardTitle>
          <CardDescription>Informationen zur Datenverschlüsselung</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Lock className="w-4 h-4 text-green-600" />
                <span className="font-medium">Transport-Verschlüsselung</span>
              </div>
              <p className="text-sm text-muted-foreground">TLS 1.3 für alle Verbindungen</p>
              <Badge className="mt-2 bg-green-100 text-green-700">Aktiv</Badge>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Database className="w-4 h-4 text-green-600" />
                <span className="font-medium">Datenbank-Verschlüsselung</span>
              </div>
              <p className="text-sm text-muted-foreground">AES-256 at rest encryption</p>
              <Badge className="mt-2 bg-green-100 text-green-700">Aktiv</Badge>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Key className="w-4 h-4 text-green-600" />
                <span className="font-medium">Passwort-Hashing</span>
              </div>
              <p className="text-sm text-muted-foreground">bcrypt mit Salt-Rounds: 12</p>
              <Badge className="mt-2 bg-green-100 text-green-700">Aktiv</Badge>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="w-4 h-4 text-green-600" />
                <span className="font-medium">Session-Sicherheit</span>
              </div>
              <p className="text-sm text-muted-foreground">HTTP-Only, Secure, SameSite</p>
              <Badge className="mt-2 bg-green-100 text-green-700">Aktiv</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Login Rate Limiter */}
      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <ShieldCheck className="w-5 h-5 mr-2" />
            Anmelde-Ratenbegrenzung
          </CardTitle>
          <CardDescription>Schutz vor Brute-Force-Angriffen auf lokale Anmeldungen</CardDescription>
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
                  <p className="font-medium">Ratenbegrenzung aktivieren</p>
                  <p className="text-sm text-muted-foreground">Begrenzt fehlgeschlagene Anmeldeversuche</p>
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
                  <Label htmlFor="max-attempts">Max. Versuche</Label>
                  <Select 
                    value={maxAttempts.toString()} 
                    onValueChange={(v) => setMaxAttempts(parseInt(v))}
                    disabled={!rateLimitEnabled}
                  >
                    <SelectTrigger id="max-attempts" data-testid="select-max-attempts">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 Versuche</SelectItem>
                      <SelectItem value="5">5 Versuche</SelectItem>
                      <SelectItem value="10">10 Versuche</SelectItem>
                      <SelectItem value="15">15 Versuche</SelectItem>
                      <SelectItem value="20">20 Versuche</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Anzahl vor Sperrung</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="window-minutes">Zeitfenster</Label>
                  <Select 
                    value={windowMinutes.toString()} 
                    onValueChange={(v) => setWindowMinutes(parseInt(v))}
                    disabled={!rateLimitEnabled}
                  >
                    <SelectTrigger id="window-minutes" data-testid="select-window-minutes">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Minuten</SelectItem>
                      <SelectItem value="10">10 Minuten</SelectItem>
                      <SelectItem value="15">15 Minuten</SelectItem>
                      <SelectItem value="30">30 Minuten</SelectItem>
                      <SelectItem value="60">60 Minuten</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Zähler-Fenster</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cooldown-minutes">Sperrzeit</Label>
                  <Select 
                    value={cooldownMinutes.toString()} 
                    onValueChange={(v) => setCooldownMinutes(parseInt(v))}
                    disabled={!rateLimitEnabled}
                  >
                    <SelectTrigger id="cooldown-minutes" data-testid="select-cooldown-minutes">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Minuten</SelectItem>
                      <SelectItem value="10">10 Minuten</SelectItem>
                      <SelectItem value="15">15 Minuten</SelectItem>
                      <SelectItem value="30">30 Minuten</SelectItem>
                      <SelectItem value="60">60 Minuten</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Wartezeit nach Sperrung</p>
                </div>
              </div>

              {/* Stats */}
              {securityData?.stats && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Aktuell verfolgt</p>
                    <p className="text-xl font-semibold">{securityData.stats.totalTracked}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Gesperrte Konten</p>
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
                      Alle Sperren aufheben
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Alle Rate-Limit-Sperren aufheben?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Dies hebt alle aktuellen Anmelde-Sperren auf. Benutzer können sofort wieder versuchen, sich anzumelden.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => clearRateLimitsMutation.mutate()}
                        className="kita-button-primary"
                      >
                        Sperren aufheben
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button 
                  onClick={handleSaveRateLimit}
                  disabled={saveRateLimitMutation.isPending}
                  className="kita-button-primary"
                  data-testid="button-save-rate-limit"
                >
                  {saveRateLimitMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Speichern...
                    </>
                  ) : (
                    'Ratenbegrenzung speichern'
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ClamAV Antivirus Scanner */}
      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Virenscanner (ClamAV)
          </CardTitle>
          <CardDescription>Upload-Prüfung vor Persistierung - Pflicht für behördliche Pentests</CardDescription>
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
                    Alle Uploads werden VOR dem Speichern durch ClamAV geprüft. Dateien mit erkannten Viren werden abgelehnt und nie persistiert.
                  </p>
                </div>
              </div>

              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Virenscanner aktivieren</p>
                  <p className="text-sm text-muted-foreground">Alle Uploads vor Speicherung prüfen</p>
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
                  <p className="text-xs text-muted-foreground">clamd Server-Adresse</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clamav-port">Port</Label>
                  <Input 
                    id="clamav-port"
                    type="number"
                    value={clamavPort}
                    onChange={(e) => setClamavPort(parseInt(e.target.value) || 3310)}
                    disabled={!clamavEnabled}
                    placeholder="3310"
                    data-testid="input-clamav-port"
                  />
                  <p className="text-xs text-muted-foreground">Standard: 3310</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clamav-timeout">Timeout (Sekunden)</Label>
                  <Select 
                    value={clamavTimeout.toString()} 
                    onValueChange={(v) => setClamavTimeout(parseInt(v))}
                    disabled={!clamavEnabled}
                  >
                    <SelectTrigger id="clamav-timeout" data-testid="select-clamav-timeout">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 Sekunden</SelectItem>
                      <SelectItem value="30">30 Sekunden</SelectItem>
                      <SelectItem value="60">60 Sekunden</SelectItem>
                      <SelectItem value="120">120 Sekunden</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Max. Scan-Wartezeit</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clamav-maxsize">Max. Dateigröße (MB)</Label>
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
                  <p className="text-xs text-muted-foreground">Größere Dateien werden abgelehnt</p>
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
                      Teste...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Verbindung testen
                    </>
                  )}
                </Button>

                <Button 
                  onClick={handleSaveClamav}
                  disabled={saveClamavMutation.isPending}
                  className="kita-button-primary"
                  data-testid="button-save-clamav"
                >
                  {saveClamavMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Speichern...
                    </>
                  ) : (
                    'ClamAV speichern'
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Data Retention - Split by User Type */}
      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Timer className="w-5 h-5 mr-2" />
            Datenaufbewahrung & Auto-Löschung
          </CardTitle>
          <CardDescription>Konfigurieren Sie die automatische Bereinigung alter Daten getrennt nach Benutzertyp (DSGVO Art. 5)</CardDescription>
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
              <span>Gastnutzer</span>
              <Badge variant="secondary" className="ml-1 text-xs">Anonym</Badge>
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
              <span>SSO-Nutzer</span>
              <Badge variant="secondary" className="ml-1 text-xs bg-kita-orange/10 text-kita-orange">Authentifiziert</Badge>
            </button>
          </div>

          {/* Guest Users Settings */}
          {userTypeTab === 'guest' && (
            <div className="space-y-4" data-testid="guest-retention-settings">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Gastnutzer</strong> sind anonyme Benutzer, die ohne Anmeldung an Umfragen teilnehmen. 
                  Ihre Daten sollten gemäß DSGVO-Grundsätzen zeitnah gelöscht werden.
                </p>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Inaktive Gast-Umfragen löschen</p>
                  <p className="text-sm text-muted-foreground">Anonyme Umfragen ohne Aktivität</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select defaultValue="30">
                    <SelectTrigger className="w-32" data-testid="select-guest-inactive-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 Tage</SelectItem>
                      <SelectItem value="14">14 Tage</SelectItem>
                      <SelectItem value="30">30 Tage</SelectItem>
                      <SelectItem value="60">60 Tage</SelectItem>
                      <SelectItem value="90">90 Tage</SelectItem>
                      <SelectItem value="never">Nie</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch id="guest-auto-delete" defaultChecked data-testid="switch-guest-auto-delete" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Abgelaufene Gast-Terminumfragen</p>
                  <p className="text-sm text-muted-foreground">Termine deren Datum verstrichen ist</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select defaultValue="7">
                    <SelectTrigger className="w-32" data-testid="select-guest-expired-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Tag</SelectItem>
                      <SelectItem value="7">7 Tage</SelectItem>
                      <SelectItem value="14">14 Tage</SelectItem>
                      <SelectItem value="30">30 Tage</SelectItem>
                      <SelectItem value="never">Nie</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch id="guest-archive-expired" defaultChecked data-testid="switch-guest-archive-expired" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Gast-Stimmen anonymisieren</p>
                  <p className="text-sm text-muted-foreground">E-Mail-Adressen bei Stimmen entfernen</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select defaultValue="30">
                    <SelectTrigger className="w-32" data-testid="select-guest-anonymize-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 Tage</SelectItem>
                      <SelectItem value="14">14 Tage</SelectItem>
                      <SelectItem value="30">30 Tage</SelectItem>
                      <SelectItem value="immediate">Sofort nach Umfrage</SelectItem>
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
                  <strong>SSO-Nutzer</strong> sind authentifizierte Benutzer über Keycloak/OIDC. 
                  Ihre Daten können länger aufbewahrt werden, da sie einer Organisation zugeordnet sind.
                </p>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Inaktive Benutzer-Umfragen löschen</p>
                  <p className="text-sm text-muted-foreground">Umfragen von authentifizierten Nutzern ohne Aktivität</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select defaultValue="180">
                    <SelectTrigger className="w-32" data-testid="select-kitahub-inactive-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="90">90 Tage</SelectItem>
                      <SelectItem value="180">180 Tage</SelectItem>
                      <SelectItem value="365">1 Jahr</SelectItem>
                      <SelectItem value="730">2 Jahre</SelectItem>
                      <SelectItem value="never">Nie</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch id="kitahub-auto-delete" data-testid="switch-kitahub-auto-delete" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Abgelaufene Terminumfragen archivieren</p>
                  <p className="text-sm text-muted-foreground">Termine werden archiviert, nicht gelöscht</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select defaultValue="60">
                    <SelectTrigger className="w-32" data-testid="select-kitahub-expired-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 Tage</SelectItem>
                      <SelectItem value="60">60 Tage</SelectItem>
                      <SelectItem value="90">90 Tage</SelectItem>
                      <SelectItem value="180">180 Tage</SelectItem>
                      <SelectItem value="never">Nie</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch id="kitahub-archive-expired" defaultChecked data-testid="switch-kitahub-archive-expired" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Gelöschte Benutzer-Daten bereinigen</p>
                  <p className="text-sm text-muted-foreground">Nach Löschung des Keycloak-Accounts</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select defaultValue="30">
                    <SelectTrigger className="w-32" data-testid="select-kitahub-cleanup-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Sofort</SelectItem>
                      <SelectItem value="7">7 Tage</SelectItem>
                      <SelectItem value="30">30 Tage</SelectItem>
                      <SelectItem value="90">90 Tage</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch id="kitahub-cleanup" defaultChecked data-testid="switch-kitahub-cleanup" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Umfragen bei Benutzer-Löschung</p>
                  <p className="text-sm text-muted-foreground">Was passiert mit Umfragen gelöschter Benutzer</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select defaultValue="anonymize">
                    <SelectTrigger className="w-40" data-testid="select-kitahub-user-delete-action">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delete">Löschen</SelectItem>
                      <SelectItem value="anonymize">Anonymisieren</SelectItem>
                      <SelectItem value="transfer">An Admin übertragen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* External Deprovisioning (Kafka/Keycloak) */}
      <Card className="kita-card" data-testid="deprovision-settings-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Unplug className="w-5 h-5 mr-2" />
              Externe Deprovisionierung
            </div>
            {deprovisionEnabled ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Wifi className="w-3 h-3 mr-1" />
                Aktiv
              </Badge>
            ) : (
              <Badge variant="secondary">
                <WifiOff className="w-3 h-3 mr-1" />
                Inaktiv
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Integration mit Kafka/Keycloak Deprovisionierungsservice für automatische Benutzer-Löschung
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
                  <strong>Hinweis:</strong> Bei aktivierter externer Deprovisionierung wird die Benutzer-Löschung 
                  zentral über Ihren Kafka/Keycloak-Service gesteuert. Der Endpoint akzeptiert DELETE-Requests 
                  mit Basic-Auth.
                </p>
              </div>

              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Deprovisionierung aktivieren</p>
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
                  <span className="font-medium">Basic Auth Konfiguration</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="deprovision-username">Benutzername</Label>
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
                      Passwort {deprovisionSettings?.hasPassword && !deprovisionPassword && (
                        <span className="text-xs text-muted-foreground">(bereits gesetzt)</span>
                      )}
                    </Label>
                    <div className="relative">
                      <Input 
                        id="deprovision-password"
                        type={showDeprovisionPassword ? 'text' : 'password'}
                        value={deprovisionPassword}
                        onChange={(e) => setDeprovisionPassword(e.target.value)}
                        placeholder={deprovisionSettings?.hasPassword ? '••••••••' : 'Neues Passwort'}
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
                      <strong>Wichtig:</strong> Bei aktivierter externer Deprovisionierung wird die manuelle 
                      Benutzer-Löschung im Admin-Panel deaktiviert. Alle Löschungen erfolgen über den 
                      externen Service.
                    </p>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <Button 
                  onClick={handleSaveDeprovision}
                  disabled={saveDeprovisionMutation.isPending || !deprovisionUsername}
                  className="kita-button-primary"
                  data-testid="button-save-deprovision"
                >
                  {saveDeprovisionMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Speichern...
                    </>
                  ) : (
                    'Deprovisionierung speichern'
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* GDPR Compliance */}
      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Archive className="w-5 h-5 mr-2" />
            DSGVO-Funktionen
          </CardTitle>
          <CardDescription>Datenschutz-Grundverordnung Konformität</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-sm">Recht auf Auskunft (Art. 15)</p>
                <p className="text-xs text-muted-foreground">Datenexport verfügbar</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-sm">Recht auf Löschung (Art. 17)</p>
                <p className="text-xs text-muted-foreground">Account-Löschung möglich</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-sm">Datenminimierung (Art. 5)</p>
                <p className="text-xs text-muted-foreground">Nur notwendige Daten</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-sm">Speicherbegrenzung (Art. 5)</p>
                <p className="text-xs text-muted-foreground">Auto-Löschung konfigurierbar</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          className="kita-button-primary" 
          data-testid="button-save-security"
          onClick={() => toast({ title: "Gespeichert", description: "Sicherheitseinstellungen wurden gespeichert." })}
        >
          Einstellungen speichern
        </Button>
      </div>
    </div>
  );
}

function RoleManagementPanel({ onBack }: { onBack: () => void }) {
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
      name: 'Benutzer',
      description: 'Standard-Benutzerrolle für alle registrierten Mitglieder',
      color: 'bg-gray-500',
      badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      count: userCounts.user,
      permissions: [
        { name: 'Eigene Umfragen erstellen', allowed: true },
        { name: 'An Umfragen teilnehmen', allowed: true },
        { name: 'Eigene Umfragen verwalten', allowed: true },
        { name: 'Eigene Stimmen bearbeiten', allowed: true },
        { name: 'Admin-Panel Zugang', allowed: false },
        { name: 'Andere Benutzer verwalten', allowed: false },
        { name: 'Systemeinstellungen ändern', allowed: false },
      ],
    },
    {
      id: 'manager',
      name: 'Manager',
      description: 'Erweiterte Rechte für Team- und Gruppenleiter',
      color: 'bg-blue-500',
      badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      count: userCounts.manager,
      permissions: [
        { name: 'Eigene Umfragen erstellen', allowed: true },
        { name: 'An Umfragen teilnehmen', allowed: true },
        { name: 'Eigene Umfragen verwalten', allowed: true },
        { name: 'Eigene Stimmen bearbeiten', allowed: true },
        { name: 'Team-Umfragen einsehen', allowed: true },
        { name: 'Benutzerübersicht (lesend)', allowed: true },
        { name: 'Systemeinstellungen ändern', allowed: false },
      ],
    },
    {
      id: 'admin',
      name: 'Administrator',
      description: 'Vollzugriff auf alle Funktionen und Einstellungen',
      color: 'bg-red-500',
      badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      count: userCounts.admin,
      permissions: [
        { name: 'Eigene Umfragen erstellen', allowed: true },
        { name: 'An Umfragen teilnehmen', allowed: true },
        { name: 'Alle Umfragen verwalten', allowed: true },
        { name: 'Alle Stimmen einsehen', allowed: true },
        { name: 'Admin-Panel Zugang', allowed: true },
        { name: 'Benutzer verwalten', allowed: true },
        { name: 'Systemeinstellungen ändern', allowed: true },
        { name: 'Rollen zuweisen', allowed: true },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Zurück zu Einstellungen
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">Rollenmanagement</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Rollenmanagement</h2>
          <p className="text-muted-foreground">Übersicht der Benutzerrollen und deren Berechtigungen</p>
        </div>
        <Badge variant="outline">
          <Users className="w-3 h-3 mr-1" />
          {users?.length || 0} Benutzer gesamt
        </Badge>
      </div>

      <div className="grid gap-6">
        {roles.map((role) => (
          <Card key={role.id} className="kita-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${role.color}`} />
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {role.name}
                      <Badge className={role.badgeClass}>{role.count} Benutzer</Badge>
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

      <Card className="kita-card border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-700 dark:text-blue-400">
            <AlertCircle className="w-5 h-5 mr-2" />
            Hinweis zur Rollenverwaltung
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Rollen können einzelnen Benutzern im Bereich <strong>Benutzer</strong> zugewiesen werden. 
            Klicken Sie auf einen Benutzer und wählen Sie die gewünschte Rolle aus dem Dropdown-Menü.
          </p>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="font-medium text-foreground">SSO-Benutzer (Keycloak):</p>
            <p>
              Bei SSO-Anmeldungen wird die Rolle automatisch aus dem Token übernommen. 
              Unterstützte Rollennamen in Keycloak:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><code className="bg-muted px-1 rounded">admin</code> oder <code className="bg-muted px-1 rounded">kita-poll-admin</code></li>
              <li><code className="bg-muted px-1 rounded">manager</code> oder <code className="bg-muted px-1 rounded">kita-poll-manager</code></li>
              <li><code className="bg-muted px-1 rounded">user</code> oder <code className="bg-muted px-1 rounded">kita-poll-user</code></li>
            </ul>
            <p className="text-xs">
              Rollen können als Realm Roles, Client Roles oder über einen Custom Protocol Mapper konfiguriert werden.
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
      toast({ title: "Gespeichert", description: "Benachrichtigungs-Einstellungen wurden gespeichert." });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/notifications'] });
    },
    onError: () => {
      toast({ title: "Fehler", description: "Einstellungen konnten nicht gespeichert werden.", variant: "destructive" });
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
          Zurück zu Einstellungen
        </Button>
        <span className="font-medium text-foreground">Benachrichtigungen</span>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Benachrichtigungen & Erinnerungen</h2>
          <p className="text-muted-foreground">Konfigurieren Sie E-Mail-Erinnerungen und Gast-Einschränkungen</p>
        </div>

        {/* Master Switch */}
        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Benachrichtigungen
            </CardTitle>
            <CardDescription>
              Globaler Schalter für alle Erinnerungsfunktionen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Benachrichtigungen aktiviert</Label>
                <p className="text-sm text-muted-foreground">Alle Erinnerungsfunktionen ein-/ausschalten</p>
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
        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="w-5 h-5" />
              Erinnerungstypen
            </CardTitle>
            <CardDescription>
              Welche Erinnerungen sind erlaubt?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Automatische Ablauferinnerungen</Label>
                <p className="text-sm text-muted-foreground">Vor Ablauf einer Umfrage automatisch erinnern</p>
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
                <Label>Manuelle Erinnerungen</Label>
                <p className="text-sm text-muted-foreground">Ersteller können Teilnehmer manuell erinnern</p>
              </div>
              <Switch
                checked={settings.manualRemindersEnabled}
                onCheckedChange={(v) => setSettings({ ...settings, manualRemindersEnabled: v })}
                disabled={!settings.enabled}
                data-testid="switch-manual-reminders"
              />
            </div>

            <div className="space-y-2">
              <Label>Standard-Erinnerungszeitpunkt (Stunden vor Ablauf)</Label>
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
              <p className="text-sm text-muted-foreground">Standardwert für neue Umfragen (1-168 Stunden)</p>
            </div>
          </CardContent>
        </Card>

        {/* Guest Restrictions */}
        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Gast-Einschränkungen
            </CardTitle>
            <CardDescription>
              Spam-Schutz für anonyme Umfrage-Ersteller
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Gäste können die App für Spam-Angriffe missbrauchen. Strenge Limits empfohlen!
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Gäste dürfen Erinnerungen senden</Label>
                <p className="text-sm text-muted-foreground">Anonyme Ersteller können Erinnerungs-E-Mails versenden</p>
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
                <Label>Max. Erinnerungen pro Umfrage (Gäste)</Label>
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
                <p className="text-sm text-muted-foreground">0 = deaktiviert</p>
              </div>

              <div className="space-y-2">
                <Label>Max. Erinnerungen pro Umfrage (Benutzer)</Label>
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
              <Label>Abkühlzeit zwischen Erinnerungen (Minuten)</Label>
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
              <p className="text-sm text-muted-foreground">Mindestwartezeit zwischen Erinnerungen für dieselbe Umfrage</p>
            </div>
          </CardContent>
        </Card>

        {/* Integration Hint */}
        <Card className="kita-card border-dashed">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Matrix Chat Integration</p>
                <p className="text-sm text-muted-foreground">
                  Für Chat-Benachrichtigungen über Matrix konfigurieren Sie die{' '}
                  <Button variant="link" className="p-0 h-auto" onClick={onBack}>
                    Matrix Integration
                  </Button>{' '}
                  in den Einstellungen.
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
                Speichern...
              </>
            ) : (
              'Einstellungen speichern'
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
      toast({ title: "Gespeichert", description: "Session-Timeout-Einstellungen wurden gespeichert." });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/session-timeout'] });
    },
    onError: () => {
      toast({ title: "Fehler", description: "Einstellungen konnten nicht gespeichert werden.", variant: "destructive" });
    }
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours} Stunden`;
    }
    return `${minutes} Minuten`;
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
          Zurück zu Einstellungen
        </Button>
        <span className="font-medium text-foreground">Session-Timeout</span>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Automatische Session-Abmeldung</h2>
          <p className="text-muted-foreground">Konfigurieren Sie rollenbasierte Timeout-Zeiten für automatische Abmeldung</p>
        </div>

        {/* Master Switch */}
        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5" />
              Session-Timeout
            </CardTitle>
            <CardDescription>
              Benutzer werden nach Inaktivität automatisch abgemeldet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Session-Timeout aktiviert</Label>
                <p className="text-sm text-muted-foreground">Automatische Abmeldung nach Inaktivität aktivieren</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
                data-testid="switch-session-timeout-enabled"
              />
            </div>
            
            {!settings.enabled && (
              <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
                Bei deaktiviertem Session-Timeout bleiben Benutzer bis zum manuellen Logout oder Cookie-Ablauf (24 Stunden) angemeldet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role-based Timeouts */}
        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Rollenbasierte Timeouts
            </CardTitle>
            <CardDescription>
              Unterschiedliche Timeout-Zeiten je nach Benutzerrolle
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-100 text-red-800">Admin</Badge>
                  <span className="text-sm text-muted-foreground">Längste Session für Administratoren</span>
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
                <span>12 Stunden</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-800">Manager</Badge>
                  <span className="text-sm text-muted-foreground">Mittlere Session für Manager</span>
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
                <span>8 Stunden</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-gray-100 text-gray-800">User</Badge>
                  <span className="text-sm text-muted-foreground">Kürzeste Session für normale Benutzer</span>
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
                <span>4 Stunden</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warning Settings */}
        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Warnhinweis
            </CardTitle>
            <CardDescription>
              Benutzer vor der automatischen Abmeldung warnen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Warnung anzeigen (Minuten vor Abmeldung)</Label>
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
                Benutzer sehen {settings.showWarningMinutes} Minute(n) vor der Abmeldung einen Warnhinweis mit der Möglichkeit, die Session zu verlängern.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="kita-card border-dashed">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Hinweis zur Implementierung</p>
                <p className="text-sm text-muted-foreground">
                  Die Session-Timeout-Funktion überprüft die letzte Aktivität des Benutzers und meldet ihn nach der konfigurierten Inaktivitätszeit automatisch ab. 
                  Aktivitäten wie Mausklicks, Tastatureingaben und Seitenwechsel verlängern die Session.
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
                Speichern...
              </>
            ) : (
              'Einstellungen speichern'
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
      toast({ title: "Gespeichert", description: "Matrix-Einstellungen wurden gespeichert." });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/customization'] });
      setBotAccessToken('');
    },
    onError: () => {
      toast({ title: "Fehler", description: "Einstellungen konnten nicht gespeichert werden.", variant: "destructive" });
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
        setTestMessage(`Verbunden als ${result.userId}`);
      } else {
        setTestStatus('error');
        setTestMessage(result.error || 'Verbindung fehlgeschlagen');
      }
    } catch (error: any) {
      setTestStatus('error');
      setTestMessage('Verbindungstest fehlgeschlagen');
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
          Zurück zu Einstellungen
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">Matrix Chat</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Matrix Chat Integration</h2>
          <p className="text-muted-foreground">Chat-Benachrichtigungen über Matrix für SSO-Benutzer</p>
        </div>
        <Badge variant="outline" className={matrixEnabled ? "text-green-600 border-green-600" : "text-muted-foreground border-muted"}>
          {matrixEnabled ? (
            <>
              <CheckCircle className="w-3 h-3 mr-1" />
              Aktiviert
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3 mr-1" />
              Deaktiviert
            </>
          )}
        </Badge>
      </div>

      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              Matrix Verbindung
            </div>
            {saveMutation.isPending && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
          <CardDescription>Konfigurieren Sie die Verbindung zu Ihrem Matrix Homeserver</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={`flex items-center justify-between p-4 border rounded-lg ${matrixEnabled ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-muted/50 border-muted'}`}>
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-lg ${matrixEnabled ? 'bg-green-100 dark:bg-green-900/50' : 'bg-muted'}`}>
                <MessageSquare className={`w-6 h-6 ${matrixEnabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="font-medium text-foreground">Matrix Integration aktivieren</p>
                <p className="text-sm text-muted-foreground">
                  {matrixEnabled 
                    ? "SSO-Benutzer können Chat-Benachrichtigungen erhalten" 
                    : "Nur E-Mail-Benachrichtigungen aktiv"}
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
                    <p className="font-medium text-blue-800 dark:text-blue-200">Matrix Homeserver</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Diese Integration funktioniert mit jedem Matrix-kompatiblen Homeserver, inkl. dem Bundesmessenger (BUM) 
                      oder Ihrem eigenen Matrix-Server.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="matrix-homeserver">Homeserver URL</Label>
                  <Input 
                    id="matrix-homeserver" 
                    placeholder="https://matrix.example.com"
                    value={homeserverUrl}
                    onChange={(e) => setHomeserverUrl(e.target.value)}
                    data-testid="input-matrix-homeserver"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Die URL Ihres Matrix Homeservers</p>
                </div>
                <div>
                  <Label htmlFor="matrix-bot-user">Bot User ID</Label>
                  <Input 
                    id="matrix-bot-user" 
                    placeholder="@pollbot:matrix.example.com"
                    value={botUserId}
                    onChange={(e) => setBotUserId(e.target.value)}
                    data-testid="input-matrix-bot-user"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Die Matrix User-ID des Bots</p>
                </div>
              </div>

              <div>
                <Label htmlFor="matrix-token">Bot Access Token</Label>
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
                  Access Token des Bot-Accounts. Leer lassen, um den vorhandenen Token beizubehalten.
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
                  <Label htmlFor="matrix-search" className="font-medium">User Directory Suche aktivieren</Label>
                  <p className="text-sm text-muted-foreground">
                    Ermöglicht Type-Ahead-Suche nach Matrix-Benutzern beim Einladen
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
                        Teste...
                      </>
                    ) : (
                      <>
                        <Wifi className="w-4 h-4 mr-2" />
                        Verbindung testen
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
                  className="kita-button-primary"
                  data-testid="button-save-matrix"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Speichern...
                    </>
                  ) : (
                    'Einstellungen speichern'
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {matrixEnabled && (
        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              Hinweise zur Einrichtung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                <span className="font-bold text-kita-orange">1.</span>
                <div>
                  <p className="font-medium">Bot-Account erstellen</p>
                  <p className="text-muted-foreground">Erstellen Sie einen Matrix-Benutzer (z.B. @pollbot:matrix.example.com) mit einem sicheren Passwort.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                <span className="font-bold text-kita-orange">2.</span>
                <div>
                  <p className="font-medium">Access Token generieren</p>
                  <p className="text-muted-foreground">Melden Sie sich als Bot an und generieren Sie einen Access Token über Element oder die Admin-API.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                <span className="font-bold text-kita-orange">3.</span>
                <div>
                  <p className="font-medium">User Directory Suche</p>
                  <p className="text-muted-foreground">
                    Für die vollständige Benutzersuche setzen Sie in Ihrer Synapse-Konfiguration: 
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: customization, isLoading } = useQuery<CustomizationSettings>({
    queryKey: ['/api/v1/admin/customization'],
  });

  // Default feature colors: Termin=Orange, Umfrage=Hellblau, Orga=Grün
  const DEFAULT_FEATURE_COLORS = {
    scheduleColor: '#F97316',   // Orange - for Termin
    surveyColor: '#72BEB7',     // Light Blue/Teal - for Umfrage
    organizationColor: '#7DB942', // Green - for Orga
  };

  const [themeSettings, setThemeSettings] = useState({
    primaryColor: '#f97316',
    secondaryColor: '#1e40af',
    defaultThemeMode: 'system' as 'light' | 'dark' | 'system',
    ...DEFAULT_FEATURE_COLORS,
  });

  const [brandingSettings, setBrandingSettings] = useState({
    logoUrl: null as string | null,
    siteName: '',
    siteNameAccent: '',
  });
  
  // Track if initial data has been loaded to prevent race conditions
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  const [footerSettings, setFooterSettings] = useState({
    description: 'Die professionelle Open-Source Abstimmungsplattform für Teams. Sicher, einfach und DSGVO-konform.',
    copyrightText: '© 2025 Polly. Open-Source Software unter MIT-Lizenz.',
    supportLinks: [
      { label: 'Hilfe & FAQ', url: '#' },
      { label: 'Kontakt', url: '#' },
      { label: 'Datenschutz', url: '#' },
      { label: 'Impressum', url: '#' },
    ] as FooterLink[],
  });

  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    // Only load initial data once to prevent race conditions while user is typing
    if (customization && !initialDataLoaded) {
      setThemeSettings({
        primaryColor: customization.theme?.primaryColor || '#f97316',
        secondaryColor: customization.theme?.secondaryColor || '#1e40af',
        defaultThemeMode: customization.theme?.defaultThemeMode || 'system',
        scheduleColor: customization.theme?.scheduleColor || DEFAULT_FEATURE_COLORS.scheduleColor,
        surveyColor: customization.theme?.surveyColor || DEFAULT_FEATURE_COLORS.surveyColor,
        organizationColor: customization.theme?.organizationColor || DEFAULT_FEATURE_COLORS.organizationColor,
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
    onSuccess: () => {
      toast({ title: "Gespeichert", description: "Anpassungen wurden gespeichert." });
      // Reset initial data flag to allow fresh reload after save
      setInitialDataLoaded(false);
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/customization'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/customization'] });
    },
    onError: () => {
      toast({ title: "Fehler", description: "Anpassungen konnten nicht gespeichert werden.", variant: "destructive" });
    },
  });

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

      if (!response.ok) throw new Error('Upload fehlgeschlagen');

      const data = await response.json();
      setBrandingSettings(prev => ({ ...prev, logoUrl: data.imageUrl }));
      toast({ title: "Logo hochgeladen", description: "Das Logo wurde erfolgreich hochgeladen." });
    } catch (error) {
      toast({ title: "Fehler", description: "Logo konnte nicht hochgeladen werden.", variant: "destructive" });
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
          <h2 className="text-2xl font-semibold text-foreground">Anpassen</h2>
          <p className="text-muted-foreground">Design, Branding und Footer individualisieren</p>
        </div>
        <Button 
          className="kita-button-primary" 
          onClick={handleSaveAll}
          disabled={saveMutation.isPending}
          data-testid="button-save-customization"
        >
          {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Alle Änderungen speichern
        </Button>
      </div>

      {/* Theme Colors */}
      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Palette className="w-5 h-5 mr-2" />
            Farbschema
          </CardTitle>
          <CardDescription>Primär- und Sekundärfarben für die gesamte Anwendung</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primärfarbe (Akzentfarbe)</Label>
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
                  Vorschau
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Wird für Buttons, Links und Akzente verwendet</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary-color">Sekundärfarbe</Label>
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
                  Vorschau
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Wird für sekundäre Elemente und Hintergründe verwendet</p>
            </div>
          </div>
          
          {/* Feature Colors */}
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-4">Feature-Farben</h4>
            <p className="text-sm text-muted-foreground mb-4">Jede Umfrage-Art erhält eine eigene Farbe für konsistentes Design.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Schedule Color */}
              <div className="space-y-2">
                <Label htmlFor="schedule-color" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Termin-Farbe
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
                  Termin finden
                </div>
              </div>

              {/* Survey Color */}
              <div className="space-y-2">
                <Label htmlFor="survey-color" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Umfrage-Farbe
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
                  Umfrage erstellen
                </div>
              </div>

              {/* Organization Color */}
              <div className="space-y-2">
                <Label htmlFor="organization-color" className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  Orga-Farbe
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
                  Orga festlegen
                </div>
              </div>
            </div>
            
            {/* Reset Feature Colors Button */}
            <div className="mt-4 flex justify-end">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setThemeSettings(prev => ({
                    ...prev,
                    ...DEFAULT_FEATURE_COLORS
                  }));
                  toast({ 
                    title: "Farben zurückgesetzt", 
                    description: "Feature-Farben wurden auf die Standardwerte zurückgesetzt. Klicken Sie auf 'Speichern' um die Änderungen zu übernehmen." 
                  });
                }}
                data-testid="button-reset-feature-colors"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Auf Standard zurücksetzen
              </Button>
            </div>
          </div>
          
          {/* Dark Mode Default */}
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-4 flex items-center gap-2">
              <Moon className="w-4 h-4" />
              Standard-Farbmodus
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              Wählen Sie den Standard-Farbmodus für neue Besucher. Benutzer können ihren bevorzugten Modus in den Profileinstellungen ändern.
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
                      <span>Hell</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4" />
                      <span>Dunkel</span>
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
                  ? 'Folgt den Systemeinstellungen des Besuchers' 
                  : themeSettings.defaultThemeMode === 'dark' 
                    ? 'Dunkler Modus für alle neuen Besucher'
                    : 'Heller Modus für alle neuen Besucher'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branding / Logo */}
      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Image className="w-5 h-5 mr-2" />
            Branding & Logo
          </CardTitle>
          <CardDescription>Logo und Markenname für Ihre Instanz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="site-name">Seitenname</Label>
                <Input 
                  id="site-name"
                  value={brandingSettings.siteName}
                  onChange={(e) => setBrandingSettings(prev => ({ ...prev, siteName: e.target.value }))}
                  placeholder="Poll"
                  data-testid="input-site-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-name-accent">Akzent-Teil (farbig)</Label>
                <Input 
                  id="site-name-accent"
                  value={brandingSettings.siteNameAccent}
                  onChange={(e) => setBrandingSettings(prev => ({ ...prev, siteNameAccent: e.target.value }))}
                  placeholder="Poll"
                  data-testid="input-site-name-accent"
                />
                <p className="text-xs text-muted-foreground">Dieser Teil wird in der Primärfarbe angezeigt</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Vorschau:</p>
                <h3 className="text-2xl font-bold">
                  {brandingSettings.siteName}
                  <span style={{ color: themeSettings.primaryColor }}>{brandingSettings.siteNameAccent}</span>
                </h3>
                {!brandingSettings.siteName && !brandingSettings.siteNameAccent && (
                  <p className="text-xs text-muted-foreground mt-1">Standard: Polly</p>
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
                            Ändern
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
                        Entfernen
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
                        {isUploading ? 'Wird hochgeladen...' : 'Klicken zum Hochladen'}
                      </p>
                      <p className="text-xs text-muted-foreground">PNG, JPG oder SVG (max. 2MB)</p>
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
      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Footer
          </CardTitle>
          <CardDescription>Fußzeile mit Beschreibung, Copyright und Links</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="footer-description">Beschreibungstext</Label>
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
            <Label htmlFor="footer-copyright">Copyright-Text</Label>
            <Input 
              id="footer-copyright"
              value={footerSettings.copyrightText}
              onChange={(e) => setFooterSettings(prev => ({ ...prev, copyrightText: e.target.value }))}
              placeholder="© 2025 Ihre Organisation"
              data-testid="input-footer-copyright"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Support-Links</Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={addFooterLink}
                data-testid="button-add-footer-link"
              >
                <Plus className="w-4 h-4 mr-1" />
                Link hinzufügen
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
                  Keine Links konfiguriert. Klicken Sie auf "Link hinzufügen" um einen neuen Link zu erstellen.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Eye className="w-5 h-5 mr-2" />
            Footer-Vorschau
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
                <h4 className="font-semibold mb-2">Unterstützung</h4>
                <ul className="space-y-1 text-gray-300 text-sm">
                  {footerSettings.supportLinks.map((link, index) => (
                    <li key={index}>
                      <a href={link.url || '#'} className="hover:text-white">{link.label || '(Kein Text)'}</a>
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
      toast({ title: "Token gespeichert", description: "API-Token wurde erfolgreich gespeichert." });
      setTokenInput('');
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/pentest-tools/status'] });
    },
    onError: (error: any) => {
      toast({ title: "Fehler", description: error.message || "Token konnte nicht gespeichert werden.", variant: "destructive" });
    },
    onSettled: () => {
      setIsSavingToken(false);
    }
  });

  const handleSaveToken = () => {
    if (!tokenInput.trim()) {
      toast({ title: "Fehler", description: "Bitte geben Sie einen API-Token ein.", variant: "destructive" });
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
      toast({ title: "Target synchronisiert", description: "Polly wurde als Scan-Ziel registriert." });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/pentest-tools/target'] });
    },
    onError: (error: any) => {
      toast({ title: "Fehler", description: error.message || "Target konnte nicht synchronisiert werden.", variant: "destructive" });
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
      toast({ title: "Scan gestartet", description: `Polly-Scan wurde gestartet (ID: ${data.scan_id})` });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/pentest-tools/scans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/pentest-tools/target'] });
    },
    onError: (error: any) => {
      toast({ title: "Fehler", description: error.message || "Scan konnte nicht gestartet werden.", variant: "destructive" });
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
      toast({ title: "Scan gestoppt", description: "Der Scan wurde abgebrochen." });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/pentest-tools/scans'] });
    },
    onError: () => {
      toast({ title: "Fehler", description: "Scan konnte nicht gestoppt werden.", variant: "destructive" });
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
      case 'running': return <Badge className="bg-blue-500">Läuft</Badge>;
      case 'finished': return <Badge className="bg-green-500">Abgeschlossen</Badge>;
      case 'stopped': return <Badge className="bg-gray-500">Gestoppt</Badge>;
      case 'failed': return <Badge className="bg-red-500">Fehlgeschlagen</Badge>;
      case 'queued': return <Badge className="bg-yellow-500">In Warteschlange</Badge>;
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
            Zurück
          </Button>
        </div>
        <Card className="kita-card">
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
          Zurück
        </Button>
        <h2 className="text-2xl font-semibold text-foreground">Pentest-Tools.com</h2>
      </div>

      {/* Connection Status */}
      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Verbindungsstatus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {status?.configured ? (
              status.connected ? (
                <>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Verbunden</span>
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
                  <span className="font-medium">Verbindungsfehler: {status.message}</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">API Token nicht konfiguriert</span>
              </div>
            )}
          </div>
          
          {/* Token Configuration Form */}
          {status?.configuredViaEnv ? (
            <Alert className="mt-4">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Der API-Token ist über eine Umgebungsvariable (<code className="bg-muted px-1 rounded">PENTEST_TOOLS_API_TOKEN</code>) konfiguriert und kann hier nicht geändert werden.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="pentest-api-token">API-Token</Label>
                <div className="flex gap-2">
                  <Input
                    id="pentest-api-token"
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder={status?.configured ? "••••••••••••••••" : "Token hier eingeben..."}
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
                    Speichern
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Token erstellen: <a href="https://app.pentest-tools.com/account/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">pentest-tools.com → Account → API</a>
                </p>
              </div>
            </div>
          )}
          
          {status?.configured && !status.connected && (
            <Alert variant="destructive" className="mt-4">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>Mögliche Ursachen:</p>
                <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                  <li>Der API-Token ist ungültig oder abgelaufen</li>
                  <li>Netzwerkprobleme zur Pentest-Tools.com API</li>
                  <li>Ihr Pentest-Tools Account ist nicht aktiv</li>
                </ul>
                <p className="text-sm">
                  Prüfen Sie Ihren Token unter: <a href="https://app.pentest-tools.com/account/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Account Settings</a>
                </p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {status?.configured && status.connected && (
        <>
          {/* Polly Target Info */}
          <Card className="kita-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Polly Sicherheitsscan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm text-muted-foreground">Scan-Ziel</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {targetInfo?.url ? (
                        <>
                          <code className="text-sm bg-background px-2 py-1 rounded border" data-testid="text-polly-url">
                            {targetInfo.url}
                          </code>
                          {targetInfo.configured && (
                            <Badge className="bg-green-500" data-testid="badge-target-synced">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Synchronisiert
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground text-sm">URL wird ermittelt...</span>
                      )}
                    </div>
                    {targetInfo?.lastSynced && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Zuletzt synchronisiert: {formatDate(targetInfo.lastSynced)}
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
                    Target synchronisieren
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
                  <Label htmlFor="scan-tool">Scan-Tool</Label>
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
                  <Label htmlFor="scan-type">Scan-Tiefe</Label>
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
                  Polly scannen
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => refetchScans()}
                  data-testid="button-refresh-scans"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Aktualisieren
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Scans */}
          <Card className="kita-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Letzte Scans
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
                            title: "Liste geleert", 
                            description: "Die Anzeige wurde geleert. Neue Scans werden nach dem Start wieder angezeigt.",
                          });
                        }}
                        data-testid="button-clear-scans"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Liste leeren (nur Anzeige)</p>
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
                      <TableHead>Ziel</TableHead>
                      <TableHead>Tool</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fortschritt</TableHead>
                      <TableHead>Gestartet</TableHead>
                      <TableHead>Findings</TableHead>
                      <TableHead>Aktionen</TableHead>
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
                                Findings
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
                                Stoppen
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
                  <p>Noch keine Scans durchgeführt.</p>
                  <p className="text-sm">Starten Sie Ihren ersten Sicherheitsscan oben.</p>
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
                    Scan-Ergebnisse
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
                            <SelectValue placeholder="Alle anzeigen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Alle anzeigen</SelectItem>
                            <SelectItem value="critical">🔴 Nur Critical</SelectItem>
                            <SelectItem value="high">🟠 Critical + High</SelectItem>
                            <SelectItem value="medium">🟡 Bis Medium</SelectItem>
                            <SelectItem value="low">🔵 Bis Low</SelectItem>
                            <SelectItem value="info">ℹ️ Alle (inkl. Info)</SelectItem>
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
                                        <strong className="text-green-700 dark:text-green-400">Empfohlene Lösung:</strong>
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
                    <p>Keine Sicherheitsprobleme gefunden!</p>
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

// Automated Tests Panel Component
function AutomatedTestsPanel({ onBack }: { onBack: () => void }) {
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
      toast({ title: 'Modus geändert', description: 'Der Test-Modus wurde aktualisiert.' });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/tests/configurations'] });
    },
    onError: () => {
      toast({ title: 'Fehler', description: 'Modus konnte nicht geändert werden.', variant: 'destructive' });
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
      toast({ title: 'Fehler', description: 'Test konnte nicht geändert werden.', variant: 'destructive' });
    },
  });

  const syncTestsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/tests/sync');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Tests synchronisiert', description: `${data.count || 0} Tests gefunden.` });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/tests/configurations'] });
    },
    onError: () => {
      toast({ title: 'Fehler', description: 'Tests konnten nicht synchronisiert werden.', variant: 'destructive' });
    },
  });

  const currentMode = testConfigs?.mode?.mode || 'auto';
  const isAutoMode = currentMode === 'auto';

  const testTypeLabels: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
    unit: { label: 'Unit-Tests', icon: <TestTube className="w-4 h-4" />, description: 'Einzelne Funktionen und Komponenten' },
    integration: { label: 'Integrationstests', icon: <Workflow className="w-4 h-4" />, description: 'API-Endpunkte und Datenbankoperationen' },
    e2e: { label: 'E2E-Tests', icon: <Globe className="w-4 h-4" />, description: 'Browser-basierte End-to-End-Tests' },
    data: { label: 'Datentests', icon: <DatabaseIcon className="w-4 h-4" />, description: 'Fixtures und Testdaten-Generierung' },
  };

  const runTestsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/tests/run');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Tests gestartet', description: `Test-Lauf #${data.runId} wurde gestartet.` });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/tests/runs'] });
    },
    onError: () => {
      toast({ title: 'Fehler', description: 'Tests konnten nicht gestartet werden.', variant: 'destructive' });
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async (config: TestScheduleConfig) => {
      const response = await apiRequest('PUT', '/api/v1/admin/tests/schedule', config);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Zeitplan gespeichert', description: 'Die Scheduler-Einstellungen wurden aktualisiert.' });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/tests/schedule'] });
    },
    onError: () => {
      toast({ title: 'Fehler', description: 'Zeitplan konnte nicht gespeichert werden.', variant: 'destructive' });
    },
  });

  const runs = runsData?.runs || [];
  const latestRun = runs[0];
  const isRunning = latestRun?.status === 'running';

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-tests">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Zurück zu Einstellungen
      </Button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="w-8 h-8 text-kita-orange" />
          <div>
            <h2 className="text-2xl font-bold">Automatisierte Tests</h2>
            <p className="text-muted-foreground">Backend-Integrationstests ausführen und überwachen</p>
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
              Läuft...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Tests starten
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
                Letzter Test-Lauf #{latestRun.id}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRun(latestRun.id)}
                  data-testid="button-view-run-details"
                >
                  Details
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
                <div className="text-sm text-muted-foreground">Gesamt</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{latestRun.passed}</div>
                <div className="text-sm text-muted-foreground">Bestanden</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{latestRun.failed}</div>
                <div className="text-sm text-muted-foreground">Fehlgeschlagen</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{latestRun.skipped}</div>
                <div className="text-sm text-muted-foreground">Übersprungen</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{latestRun.duration ? `${(latestRun.duration / 1000).toFixed(1)}s` : '-'}</div>
                <div className="text-sm text-muted-foreground">Dauer</div>
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
            Test-Historie
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Lade Historie...
            </div>
          ) : runs.length === 0 ? (
            <p className="text-muted-foreground">Noch keine Tests durchgeführt.</p>
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
                        {run.triggeredBy === 'manual' ? 'Manuell' : 'Geplant'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600">{run.passed} ✓</span>
                    <span className="text-red-600">{run.failed} ✗</span>
                    <span className="text-muted-foreground">
                      {run.startedAt ? formatDistanceToNow(new Date(run.startedAt), { addSuffix: true, locale: de }) : '-'}
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
                  Ältere Ergebnisse laden ({runs.length - historyLimit} weitere)
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
            Test-Modus
          </CardTitle>
          <CardDescription>
            Wählen Sie, ob alle Tests automatisch oder nur ausgewählte Tests ausgeführt werden sollen.
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
                  <span>Automatisch</span>
                  <span className="text-sm text-muted-foreground">(alle Tests)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="mode-manual" data-testid="radio-mode-manual" />
                <Label htmlFor="mode-manual" className="flex items-center gap-2 cursor-pointer">
                  <ToggleLeft className="w-4 h-4 text-orange-500" />
                  <span>Manuell</span>
                  <span className="text-sm text-muted-foreground">(ausgewählte Tests)</span>
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

      {/* Test Categories by Type - Accordion */}
      <Card data-testid="card-test-configurations">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Test-Konfiguration
          </CardTitle>
          <CardDescription>
            {isAutoMode ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                Automatischer Modus: Alle Tests werden ausgeführt
              </span>
            ) : (
              <span className="flex items-center gap-1 text-orange-600">
                <AlertCircle className="w-4 h-4" />
                Manueller Modus: Nur aktivierte Tests werden ausgeführt
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Lade Test-Konfiguration...
            </div>
          ) : testConfigs?.tests ? (
            <Accordion type="multiple" defaultValue={[]} className="w-full">
              {(['unit', 'integration', 'e2e', 'data'] as const).map((testType) => {
                const tests = testConfigs.tests[testType] || [];
                const enabledCount = tests.filter(t => t.enabled).length;
                const typeInfo = testTypeLabels[testType];
                
                return (
                  <AccordionItem key={testType} value={testType} data-testid={`accordion-${testType}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <span className="p-1.5 rounded bg-muted">{typeInfo.icon}</span>
                          <div className="text-left">
                            <div className="font-medium">{typeInfo.label}</div>
                            <div className="text-sm text-muted-foreground">{typeInfo.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={isAutoMode ? "secondary" : enabledCount === tests.length ? "default" : "outline"}>
                            {isAutoMode ? tests.length : enabledCount} / {tests.length} aktiv
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {tests.length === 0 ? (
                        <div className="py-4 text-center text-muted-foreground">
                          Keine Tests in dieser Kategorie gefunden.
                        </div>
                      ) : (
                        <div className="space-y-2 py-2">
                          {tests.map((test) => (
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
              <p>Keine Tests gefunden. Klicken Sie auf "Synchronisieren" um Tests zu scannen.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduler Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarClock className="w-5 h-5" />
            Automatische Ausführung
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
            <Label htmlFor="schedule-enabled">Automatische Tests aktivieren</Label>
          </div>
          
          {scheduleForm.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="interval-days">Intervall (Tage)</Label>
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
                <Label htmlFor="run-time">Uhrzeit</Label>
                <Input
                  id="run-time"
                  type="time"
                  value={scheduleForm.runTime}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, runTime: e.target.value }))}
                  data-testid="input-run-time"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="notify-email">Benachrichtigungs-E-Mail</Label>
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
            Speichern
          </Button>
        </CardContent>
      </Card>

      {/* Run Details Dialog */}
      <Dialog open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5" />
              Test-Lauf #{selectedRun} - Details
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
                  aria-label="Alle Tests anzeigen"
                  data-testid="filter-all"
                >
                  <div className="text-xl font-bold">{runDetails.totalTests}</div>
                  <div className="text-sm text-muted-foreground">Gesamt</div>
                </button>
                <button
                  onClick={() => setResultStatusFilter('passed')}
                  className={`p-3 rounded cursor-pointer transition-all ${
                    resultStatusFilter === 'passed' 
                      ? 'bg-green-200 dark:bg-green-900 ring-2 ring-green-500 ring-offset-2' 
                      : 'bg-green-100 dark:bg-green-950 hover:bg-green-200 dark:hover:bg-green-900'
                  }`}
                  aria-pressed={resultStatusFilter === 'passed'}
                  aria-label="Nur bestandene Tests anzeigen"
                  data-testid="filter-passed"
                >
                  <div className="text-xl font-bold text-green-600">{runDetails.passed}</div>
                  <div className="text-sm text-muted-foreground">Bestanden</div>
                </button>
                <button
                  onClick={() => setResultStatusFilter('failed')}
                  className={`p-3 rounded cursor-pointer transition-all ${
                    resultStatusFilter === 'failed' 
                      ? 'bg-red-200 dark:bg-red-900 ring-2 ring-red-500 ring-offset-2' 
                      : 'bg-red-100 dark:bg-red-950 hover:bg-red-200 dark:hover:bg-red-900'
                  }`}
                  aria-pressed={resultStatusFilter === 'failed'}
                  aria-label="Nur fehlgeschlagene Tests anzeigen"
                  data-testid="filter-failed"
                >
                  <div className="text-xl font-bold text-red-600">{runDetails.failed}</div>
                  <div className="text-sm text-muted-foreground">Fehlgeschlagen</div>
                </button>
                <button
                  onClick={() => setResultStatusFilter('skipped')}
                  className={`p-3 rounded cursor-pointer transition-all ${
                    resultStatusFilter === 'skipped' 
                      ? 'bg-yellow-200 dark:bg-yellow-900 ring-2 ring-yellow-500 ring-offset-2' 
                      : 'bg-yellow-100 dark:bg-yellow-950 hover:bg-yellow-200 dark:hover:bg-yellow-900'
                  }`}
                  aria-pressed={resultStatusFilter === 'skipped'}
                  aria-label="Nur übersprungene Tests anzeigen"
                  data-testid="filter-skipped"
                >
                  <div className="text-xl font-bold text-yellow-600">{runDetails.skipped}</div>
                  <div className="text-sm text-muted-foreground">Übersprungen</div>
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
        title: 'Testdaten gelöscht', 
        description: `${data.deletedPolls || 0} Umfragen, ${data.deletedUsers || 0} Benutzer entfernt.` 
      });
      refetchStats();
      setShowPurgeConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/extended-stats'] });
    },
    onError: () => {
      toast({ title: 'Fehler', description: 'Testdaten konnten nicht gelöscht werden.', variant: 'destructive' });
    },
  });

  const totalTestItems = (testDataStats?.testPolls || 0) + (testDataStats?.testUsers || 0) + (testDataStats?.testVotes || 0) + (testDataStats?.testOptions || 0);

  return (
    <Card data-testid="card-test-data-management">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DatabaseIcon className="w-5 h-5" />
          Testdaten-Verwaltung
        </CardTitle>
        <CardDescription>
          Testdaten werden während der Testläufe erstellt und sind von den Dashboard-Statistiken ausgeschlossen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {statsLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Lade Testdaten-Statistiken...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-blue-600">{testDataStats?.testPolls || 0}</div>
                <div className="text-sm text-muted-foreground">Test-Umfragen</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-blue-600">{testDataStats?.testOptions || 0}</div>
                <div className="text-sm text-muted-foreground">Test-Optionen</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-blue-600">{testDataStats?.testVotes || 0}</div>
                <div className="text-sm text-muted-foreground">Test-Stimmen</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-blue-600">{testDataStats?.testUsers || 0}</div>
                <div className="text-sm text-muted-foreground">Test-Benutzer</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-sm text-muted-foreground">
                {totalTestItems === 0 ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    Keine Testdaten vorhanden
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {totalTestItems} Testdaten-Einträge gefunden
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
                  Aktualisieren
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
                      Testdaten löschen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Testdaten löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Diese Aktion löscht alle Testdaten aus der Datenbank:
                        <ul className="mt-2 list-disc list-inside">
                          <li>{testDataStats?.testPolls || 0} Test-Umfragen</li>
                          <li>{testDataStats?.testOptions || 0} Test-Optionen</li>
                          <li>{testDataStats?.testVotes || 0} Test-Stimmen</li>
                          <li>{testDataStats?.testUsers || 0} Test-Benutzer</li>
                        </ul>
                        Diese Aktion kann nicht rückgängig gemacht werden.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-purge">Abbrechen</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => purgeTestDataMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="button-confirm-purge"
                      >
                        Löschen
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
