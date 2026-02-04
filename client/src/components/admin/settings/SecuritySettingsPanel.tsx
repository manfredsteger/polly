import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  Lock,
  Database,
  Key,
  Shield,
  Timer,
  ShieldCheck,
  UserX,
  Building2,
  ArrowLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  RotateCcw,
  RefreshCw,
  Unplug,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  File as FileIcon
} from "lucide-react";

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
  unavailable?: boolean;
}

interface ClamavScanLog {
  id: number;
  filename: string;
  fileSize: number;
  mimeType: string | null;
  scanStatus: 'clean' | 'infected' | 'error' | 'skipped';
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

interface ApiRateLimitItem {
  enabled: boolean;
  maxRequests: number;
  windowSeconds: number;
}

interface ApiRateLimitsSettings {
  registration: ApiRateLimitItem;
  passwordReset: ApiRateLimitItem;
  pollCreation: ApiRateLimitItem;
  voting: ApiRateLimitItem;
  email: ApiRateLimitItem;
  apiGeneral: ApiRateLimitItem;
}

interface ApiRateLimitsResponse {
  settings: ApiRateLimitsSettings;
  stats: Record<string, { totalTracked: number; blockedClients: number }>;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function SecuritySettingsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userTypeTab, setUserTypeTab] = useState<'guest' | 'kitahub'>('guest');
  
  const [rateLimitEnabled, setRateLimitEnabled] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [windowMinutes, setWindowMinutes] = useState(15);
  const [cooldownMinutes, setCooldownMinutes] = useState(15);
  
  const [apiRateLimits, setApiRateLimits] = useState<ApiRateLimitsSettings>({
    registration: { enabled: true, maxRequests: 5, windowSeconds: 3600 },
    passwordReset: { enabled: true, maxRequests: 3, windowSeconds: 900 },
    pollCreation: { enabled: true, maxRequests: 10, windowSeconds: 60 },
    voting: { enabled: true, maxRequests: 30, windowSeconds: 10 },
    email: { enabled: true, maxRequests: 5, windowSeconds: 60 },
    apiGeneral: { enabled: true, maxRequests: 100, windowSeconds: 60 },
  });
  
  const { data: securityData, isLoading: isLoadingSecurity } = useQuery<SecuritySettingsResponse>({
    queryKey: ['/api/v1/admin/security'],
  });
  
  const { data: apiRateLimitsData, isLoading: isLoadingApiRateLimits } = useQuery<ApiRateLimitsResponse>({
    queryKey: ['/api/v1/admin/api-rate-limits'],
  });
  
  useEffect(() => {
    if (apiRateLimitsData?.settings) {
      setApiRateLimits(apiRateLimitsData.settings);
    }
  }, [apiRateLimitsData]);
  
  useEffect(() => {
    if (securityData?.settings?.loginRateLimit) {
      const rl = securityData.settings.loginRateLimit;
      setRateLimitEnabled(rl.enabled);
      setMaxAttempts(rl.maxAttempts);
      setWindowMinutes(Math.round(rl.windowSeconds / 60));
      setCooldownMinutes(Math.round(rl.cooldownSeconds / 60));
    }
  }, [securityData]);
  
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
  
  const saveApiRateLimitsMutation = useMutation({
    mutationFn: async (data: ApiRateLimitsSettings) => {
      const response = await apiRequest('PUT', '/api/v1/admin/api-rate-limits', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.securitySettings.saved'), description: t('admin.security.apiRateLimitsSaved') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/api-rate-limits'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.toasts.settingsSaveError'), variant: "destructive" });
    }
  });
  
  const clearApiRateLimitsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/api-rate-limits/clear');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.securitySettings.locksCleared'), description: t('admin.security.clearApiRateLimits') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/api-rate-limits'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), variant: "destructive" });
    }
  });
  
  const handleSaveApiRateLimits = () => {
    saveApiRateLimitsMutation.mutate(apiRateLimits);
  };
  
  const updateApiRateLimit = (key: keyof ApiRateLimitsSettings, field: keyof ApiRateLimitItem, value: number | boolean) => {
    setApiRateLimits(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };
  
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

  const [clamavEnabled, setClamavEnabled] = useState(false);
  const [clamavHost, setClamavHost] = useState('localhost');
  const [clamavPort, setClamavPort] = useState(3310);
  const [clamavTimeout, setClamavTimeout] = useState(30);
  const [clamavMaxFileSize, setClamavMaxFileSize] = useState(25);
  const [clamavTestResult, setClamavTestResult] = useState<ClamAVTestResult | null>(null);
  
  const [showScanLogs, setShowScanLogs] = useState(false);
  const [scanLogFilter, setScanLogFilter] = useState<string>('all');
  const [scanLogOffset, setScanLogOffset] = useState(0);

  const { data: clamavConfig, isLoading: isLoadingClamav } = useQuery<ClamAVConfig>({
    queryKey: ['/api/v1/admin/clamav'],
  });
  
  const { data: scanLogs, isLoading: isLoadingScanLogs, refetch: refetchScanLogs } = useQuery<ClamavScanLogsResponse>({
    queryKey: ['/api/v1/admin/clamav/scan-logs', { status: scanLogFilter === 'all' ? undefined : scanLogFilter, offset: scanLogOffset, limit: 20 }],
    enabled: showScanLogs,
  });
  
  const { data: scanStats } = useQuery<ClamavScanStats>({
    queryKey: ['/api/v1/admin/clamav/stats'],
    enabled: showScanLogs,
  });

  useEffect(() => {
    if (clamavConfig) {
      setClamavEnabled(clamavConfig.enabled);
      setClamavHost(clamavConfig.host);
      setClamavPort(clamavConfig.port);
      setClamavTimeout(Math.round(clamavConfig.timeout / 1000));
      setClamavMaxFileSize(Math.round(clamavConfig.maxFileSize / 1024 / 1024));
    }
  }, [clamavConfig]);

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
  
  const [deprovisionEnabled, setDeprovisionEnabled] = useState(false);
  const [deprovisionUsername, setDeprovisionUsername] = useState('');
  const [deprovisionPassword, setDeprovisionPassword] = useState('');
  const [showDeprovisionPassword, setShowDeprovisionPassword] = useState(false);
  
  const { data: deprovisionSettings, isLoading: isLoadingDeprovision } = useQuery<DeprovisionSettings>({
    queryKey: ['/api/v1/admin/deprovision-settings'],
  });
  
  useEffect(() => {
    if (deprovisionSettings) {
      setDeprovisionEnabled(deprovisionSettings.enabled);
      setDeprovisionUsername(deprovisionSettings.username);
    }
  }, [deprovisionSettings]);
  
  const saveDeprovisionMutation = useMutation({
    mutationFn: async (data: { enabled: boolean; username: string; password?: string }) => {
      const response = await apiRequest('PUT', '/api/v1/admin/deprovision-settings', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.securitySettings.saved'), description: t('admin.securitySettings.deprovisionSaved') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/deprovision-settings'] });
      setDeprovisionPassword('');
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
              {securityData?.ssoNote && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/30 dark:border-blue-800">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                    <p className="text-sm text-blue-800 dark:text-blue-300">{securityData.ssoNote}</p>
                  </div>
                </div>
              )}

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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-attempts">{t('admin.security.maxAttempts')}</Label>
                  <Select value={maxAttempts.toString()} onValueChange={(v) => setMaxAttempts(parseInt(v))} disabled={!rateLimitEnabled}>
                    <SelectTrigger id="max-attempts" data-testid="select-max-attempts"><SelectValue /></SelectTrigger>
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
                  <Select value={windowMinutes.toString()} onValueChange={(v) => setWindowMinutes(parseInt(v))} disabled={!rateLimitEnabled}>
                    <SelectTrigger id="window-minutes" data-testid="select-window-minutes"><SelectValue /></SelectTrigger>
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
                  <Select value={cooldownMinutes.toString()} onValueChange={(v) => setCooldownMinutes(parseInt(v))} disabled={!rateLimitEnabled}>
                    <SelectTrigger id="cooldown-minutes" data-testid="select-cooldown-minutes"><SelectValue /></SelectTrigger>
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

              <div className="flex justify-between pt-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={!securityData?.stats?.lockedAccounts} data-testid="button-clear-rate-limits">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      {t('admin.security.clearAllLocks')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('admin.security.clearLocksTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>{t('admin.security.clearLocksDescription')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => clearRateLimitsMutation.mutate()} className="polly-button-primary">{t('admin.security.clearLocks')}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button onClick={handleSaveRateLimit} disabled={saveRateLimitMutation.isPending} className="polly-button-primary" data-testid="button-save-rate-limit">
                  {saveRateLimitMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('common.saving')}</> : t('admin.security.saveRateLimit')}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            {t('admin.security.apiRateLimits')}
          </CardTitle>
          <CardDescription>{t('admin.security.apiRateLimitsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingApiRateLimits ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {([
                  { key: 'registration', label: t('admin.security.registrationLimit'), description: t('admin.security.registrationLimitDescription') },
                  { key: 'passwordReset', label: t('admin.security.passwordResetLimit'), description: t('admin.security.passwordResetLimitDescription') },
                  { key: 'pollCreation', label: t('admin.security.pollCreationLimit'), description: t('admin.security.pollCreationLimitDescription') },
                  { key: 'voting', label: t('admin.security.votingLimit'), description: t('admin.security.votingLimitDescription') },
                  { key: 'email', label: t('admin.security.emailLimit'), description: t('admin.security.emailLimitDescription') },
                  { key: 'apiGeneral', label: t('admin.security.apiGeneralLimit'), description: t('admin.security.apiGeneralLimitDescription') },
                ] as const).map(({ key, label, description }) => (
                  <div key={key} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{label}</p>
                        <p className="text-sm text-muted-foreground">{description}</p>
                      </div>
                      <Switch 
                        checked={apiRateLimits[key].enabled}
                        onCheckedChange={(checked) => updateApiRateLimit(key, 'enabled', checked)}
                        data-testid={`switch-${key}-enabled`}
                      />
                    </div>
                    <div className={`grid grid-cols-2 gap-4 ${!apiRateLimits[key].enabled ? 'opacity-50' : ''}`}>
                      <div className="space-y-2">
                        <Label>{t('admin.security.maxRequestsLabel')}</Label>
                        <Input 
                          type="number" 
                          value={apiRateLimits[key].maxRequests}
                          onChange={(e) => updateApiRateLimit(key, 'maxRequests', parseInt(e.target.value) || 1)}
                          disabled={!apiRateLimits[key].enabled}
                          min={1}
                          max={1000}
                          data-testid={`input-${key}-max-requests`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('admin.security.timeWindowSeconds')}</Label>
                        <Input 
                          type="number" 
                          value={apiRateLimits[key].windowSeconds}
                          onChange={(e) => updateApiRateLimit(key, 'windowSeconds', parseInt(e.target.value) || 1)}
                          disabled={!apiRateLimits[key].enabled}
                          min={1}
                          max={86400}
                          data-testid={`input-${key}-window-seconds`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => clearApiRateLimitsMutation.mutate()} disabled={clearApiRateLimitsMutation.isPending} data-testid="button-clear-api-rate-limits">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {t('admin.security.clearApiRateLimits')}
                </Button>

                <Button onClick={handleSaveApiRateLimits} disabled={saveApiRateLimitsMutation.isPending} className="polly-button-primary" data-testid="button-save-api-rate-limits">
                  {saveApiRateLimitsMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('common.saving')}</> : t('admin.security.saveApiRateLimits')}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/30 dark:border-blue-800">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                  <p className="text-sm text-blue-800 dark:text-blue-300">{t('admin.security.virusScanInfo')}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t('admin.security.enableVirusScanner')}</p>
                  <p className="text-sm text-muted-foreground">{t('admin.security.scanAllUploads')}</p>
                </div>
                <Switch checked={clamavEnabled} onCheckedChange={setClamavEnabled} data-testid="switch-clamav-enabled" />
              </div>

              <div className={`grid grid-cols-2 gap-4 ${!clamavEnabled ? 'opacity-50' : ''}`}>
                <div className="space-y-2">
                  <Label htmlFor="clamav-host">ClamAV Host</Label>
                  <Input id="clamav-host" value={clamavHost} onChange={(e) => setClamavHost(e.target.value)} disabled={!clamavEnabled} placeholder="localhost" data-testid="input-clamav-host" />
                  <p className="text-xs text-muted-foreground">{t('admin.security.clamdServerAddress')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clamav-port">{t('admin.security.port')}</Label>
                  <Input id="clamav-port" type="number" value={clamavPort} onChange={(e) => setClamavPort(parseInt(e.target.value) || 3310)} disabled={!clamavEnabled} placeholder="3310" data-testid="input-clamav-port" />
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => testClamavMutation.mutate()} disabled={!clamavEnabled || testClamavMutation.isPending} data-testid="button-test-clamav">
                  {testClamavMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('admin.security.testing')}</> : <><RefreshCw className="w-4 h-4 mr-2" />{t('admin.security.testConnection')}</>}
                </Button>

                <Button onClick={handleSaveClamav} disabled={saveClamavMutation.isPending} className="polly-button-primary" data-testid="button-save-clamav">
                  {saveClamavMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('common.saving')}</> : t('admin.security.saveClamav')}
                </Button>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t('admin.security.scanLogs')}</p>
                    <p className="text-sm text-muted-foreground">{t('admin.security.scanLogsDescription')}</p>
                  </div>
                  <Button variant="outline" onClick={() => setShowScanLogs(!showScanLogs)} data-testid="button-view-scan-logs">
                    <FileText className="w-4 h-4 mr-2" />
                    {t('admin.security.viewScanLogs')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Timer className="w-5 h-5 mr-2" />
            {t('admin.dataRetention.title')}
          </CardTitle>
          <CardDescription>{t('admin.security.dataRetentionDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex space-x-1 bg-muted p-1 rounded-lg">
            <button
              onClick={() => setUserTypeTab('guest')}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${userTypeTab === 'guest' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              data-testid="tab-guest-users"
            >
              <UserX className="w-4 h-4" />
              <span>{t('admin.security.guestUsers')}</span>
              <Badge variant="secondary" className="ml-1 text-xs">{t('admin.security.anonymous')}</Badge>
            </button>
            <button
              onClick={() => setUserTypeTab('kitahub')}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${userTypeTab === 'kitahub' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              data-testid="tab-kitahub-users"
            >
              <Building2 className="w-4 h-4" />
              <span>{t('admin.security.ssoUsers')}</span>
              <Badge variant="secondary" className="ml-1 text-xs bg-polly-orange/10 text-polly-orange">{t('admin.security.authenticated')}</Badge>
            </button>
          </div>

          {userTypeTab === 'guest' && (
            <div className="space-y-4" data-testid="guest-retention-settings">
              <AlertBanner variant="info">
                <p className="text-sm"><strong>{t('admin.security.guestUsers')}</strong> {t('admin.security.guestUsersNote')}</p>
              </AlertBanner>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t('admin.dataRetention.deleteInactiveGuestPolls')}</p>
                  <p className="text-sm text-muted-foreground">{t('admin.dataRetention.anonymousPollsWithoutActivity')}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select defaultValue="30">
                    <SelectTrigger className="w-32" data-testid="select-guest-inactive-days"><SelectValue /></SelectTrigger>
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
            </div>
          )}

          {userTypeTab === 'kitahub' && (
            <div className="space-y-4" data-testid="kitahub-retention-settings">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800"><strong>{t('admin.security.ssoUsers')}</strong> {t('admin.dataRetention.ssoUsersNote')}</p>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t('admin.dataRetention.deleteInactiveUserPolls')}</p>
                  <p className="text-sm text-muted-foreground">{t('admin.dataRetention.pollsFromAuthenticatedUsers')}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select defaultValue="180">
                    <SelectTrigger className="w-32" data-testid="select-kitahub-inactive-days"><SelectValue /></SelectTrigger>
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
            </div>
          )}
        </CardContent>
      </Card>

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
          <CardDescription>{t('admin.deprovision.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingDeprovision ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t('admin.deprovision.enableIntegration')}</p>
                  <p className="text-sm text-muted-foreground">{t('admin.deprovision.receiveEvents')}</p>
                </div>
                <Switch checked={deprovisionEnabled} onCheckedChange={setDeprovisionEnabled} data-testid="switch-deprovision-enabled" />
              </div>

              <div className={`space-y-4 ${!deprovisionEnabled ? 'opacity-50' : ''}`}>
                <div className="space-y-2">
                  <Label htmlFor="deprovision-username">{t('admin.deprovision.username')}</Label>
                  <Input id="deprovision-username" value={deprovisionUsername} onChange={(e) => setDeprovisionUsername(e.target.value)} disabled={!deprovisionEnabled} data-testid="input-deprovision-username" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deprovision-password">{t('admin.deprovision.password')}</Label>
                  <div className="relative">
                    <Input id="deprovision-password" type={showDeprovisionPassword ? "text" : "password"} value={deprovisionPassword} onChange={(e) => setDeprovisionPassword(e.target.value)} disabled={!deprovisionEnabled} placeholder={deprovisionSettings?.hasPassword ? "••••••••••••" : t('admin.deprovision.enterPassword')} data-testid="input-deprovision-password" />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowDeprovisionPassword(!showDeprovisionPassword)}>
                      {showDeprovisionPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveDeprovision} disabled={saveDeprovisionMutation.isPending || !deprovisionEnabled} className="polly-button-primary" data-testid="button-save-deprovision">
                  {saveDeprovisionMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('common.saving')}</> : t('admin.deprovision.saveSettings')}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
