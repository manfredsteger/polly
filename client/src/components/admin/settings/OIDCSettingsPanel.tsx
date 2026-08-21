import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CustomizationSettings } from "@shared/schema";
import { 
  Key,
  KeyRound,
  ArrowLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Building2,
  Loader2,
  UserPlus,
  UserX,
  Info,
  AlertTriangle,
  ShieldCheck
} from "lucide-react";

interface OidcConfig {
  configured: boolean;
  enabled: boolean;
  issuerUrl: string;
  clientId: string;
  hasClientSecret: boolean;
  callbackUrl: string;
}

const DEFAULT_POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

export function OIDCSettingsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTesting, setIsTesting] = useState(false);

  const { data: authMethods } = useQuery<{ local: boolean; keycloak: boolean; registrationEnabled: boolean; ssoButtonLabel?: string }>({
    queryKey: ['/api/v1/auth/methods'],
  });

  const { data: oidcConfig, isLoading: configLoading, isError: configError } = useQuery<OidcConfig>({
    queryKey: ['/api/v1/oidc-config'],
  });
  
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean>(true);
  const [ssoButtonLabel, setSsoButtonLabel] = useState<string>('');
  const [policyMinLength, setPolicyMinLength] = useState<number>(DEFAULT_POLICY.minLength);
  const [policyUppercase, setPolicyUppercase] = useState<boolean>(DEFAULT_POLICY.requireUppercase);
  const [policyLowercase, setPolicyLowercase] = useState<boolean>(DEFAULT_POLICY.requireLowercase);
  const [policyNumbers, setPolicyNumbers] = useState<boolean>(DEFAULT_POLICY.requireNumbers);
  const [policySpecial, setPolicySpecial] = useState<boolean>(DEFAULT_POLICY.requireSpecialChars);
  const [adminMfaRequired, setAdminMfaRequired] = useState<boolean>(false);
  const [showMfaConfirmDialog, setShowMfaConfirmDialog] = useState(false);
  const [mfaCoverage, setMfaCoverage] = useState<{ total: number; withMfa: number; withoutMfa: number; adminsMissingMfa: string[] } | null>(null);
  const [allowGuestPollCreation, setAllowGuestPollCreation] = useState<boolean>(true);
  const [allowGuestVoting, setAllowGuestVoting] = useState<boolean>(true);

  useEffect(() => {
    if (authMethods) {
      setRegistrationEnabled(authMethods.registrationEnabled);
    }
  }, [authMethods]);

  const { data: settings } = useQuery<any[]>({
    queryKey: ['/api/v1/admin/settings'],
  });

  const { data: customization } = useQuery<CustomizationSettings>({
    queryKey: ['/api/v1/admin/customization'],
  });

  useEffect(() => {
    if (customization?.passwordPolicy) {
      const p = customization.passwordPolicy;
      setPolicyMinLength(p.minLength ?? DEFAULT_POLICY.minLength);
      setPolicyUppercase(p.requireUppercase ?? DEFAULT_POLICY.requireUppercase);
      setPolicyLowercase(p.requireLowercase ?? DEFAULT_POLICY.requireLowercase);
      setPolicyNumbers(p.requireNumbers ?? DEFAULT_POLICY.requireNumbers);
      setPolicySpecial(p.requireSpecialChars ?? DEFAULT_POLICY.requireSpecialChars);
    }
    if (customization?.mfa) {
      setAdminMfaRequired(customization.mfa.adminMfaRequired ?? false);
    }
    if (customization?.guestAccess) {
      setAllowGuestPollCreation(customization.guestAccess.allowGuestPollCreation ?? true);
      setAllowGuestVoting(customization.guestAccess.allowGuestVoting ?? true);
    }
  }, [customization]);

  const ssoLabelFromDb = settings?.find((s: any) => s.key === 'oidc_button_label')?.value;
  const ssoLabelIsFromEnv = !ssoLabelFromDb && !!authMethods?.ssoButtonLabel;

  useEffect(() => {
    if (settings) {
      if (ssoLabelFromDb) {
        setSsoButtonLabel(typeof ssoLabelFromDb === 'string' ? ssoLabelFromDb : '');
      } else if (authMethods?.ssoButtonLabel) {
        setSsoButtonLabel(authMethods.ssoButtonLabel);
      }
    }
  }, [settings, authMethods, ssoLabelFromDb]);
  
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
      setRegistrationEnabled(!registrationEnabled);
    }
  });
  
  const handleRegistrationToggle = (enabled: boolean) => {
    setRegistrationEnabled(enabled);
    saveRegistrationMutation.mutate(enabled);
  };

  const saveSsoLabelMutation = useMutation({
    mutationFn: async (label: string) => {
      const res = await apiRequest('POST', '/api/v1/admin/settings', {
        key: 'oidc_button_label',
        value: label,
        description: t('admin.oidc.ssoButtonLabelSettingDescription')
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/auth/methods'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/settings'] });
      toast({ 
        title: t('admin.oidc.ssoLabelSaved'),
        description: t('admin.oidc.ssoLabelSavedDescription')
      });
    },
    onError: () => {
      toast({ 
        title: t('errors.generic'), 
        description: t('admin.oidc.saveError'),
        variant: "destructive"
      });
    }
  });

  const handleSaveSsoLabel = () => {
    saveSsoLabelMutation.mutate(ssoButtonLabel.trim());
  };

  const savePolicyMutation = useMutation({
    mutationFn: async (policy: typeof DEFAULT_POLICY) => {
      const res = await apiRequest('PUT', '/api/v1/admin/customization', { passwordPolicy: policy });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/customization'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/auth/password-policy'] });
      toast({
        title: t('admin.auth.passwordPolicySaved'),
        description: t('admin.auth.passwordPolicySavedDescription'),
      });
    },
    onError: () => {
      toast({
        title: t('errors.generic'),
        description: t('admin.auth.passwordPolicySaveError'),
        variant: 'destructive',
      });
    },
  });

  const handleSavePolicy = () => {
    savePolicyMutation.mutate({
      minLength: policyMinLength,
      requireUppercase: policyUppercase,
      requireLowercase: policyLowercase,
      requireNumbers: policyNumbers,
      requireSpecialChars: policySpecial,
    });
  };

  const saveMfaMutation = useMutation({
    mutationFn: async (mfa: { adminMfaRequired: boolean }) => {
      const res = await apiRequest('PUT', '/api/v1/admin/customization', { mfa });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/customization'] });
      toast({
        title: t('admin.auth.mfaPolicySaved'),
        description: t('admin.auth.mfaPolicySavedDescription'),
      });
    },
    onError: () => {
      toast({
        title: t('errors.generic'),
        description: t('admin.auth.mfaPolicySaveError'),
        variant: 'destructive',
      });
    },
  });

  const handleSaveMfa = () => {
    saveMfaMutation.mutate({ adminMfaRequired });
  };

  const handleMfaToggle = async (checked: boolean) => {
    if (checked) {
      // Fetch coverage then show the confirmation dialog.
      // adminMfaRequired is NOT set here — it only becomes true when the user
      // explicitly clicks the Confirm button, so Escape / backdrop-click /
      // Cancel all leave the policy disabled with no further action required.
      try {
        const res = await apiRequest('GET', '/api/v1/admin/mfa-coverage');
        const data = await res.json();
        setMfaCoverage(data);
      } catch {
        setMfaCoverage(null);
      }
      setShowMfaConfirmDialog(true);
    } else {
      setAdminMfaRequired(false);
    }
  };

  const saveGuestAccessMutation = useMutation({
    mutationFn: async (guestAccess: { allowGuestPollCreation: boolean; allowGuestVoting: boolean }) => {
      const res = await apiRequest('PUT', '/api/v1/admin/customization', { guestAccess });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/customization'] });
      toast({
        title: t('admin.auth.guestAccessSaved'),
        description: t('admin.auth.guestAccessSavedDescription'),
      });
    },
    onError: () => {
      toast({
        title: t('errors.generic'),
        description: t('admin.auth.guestAccessSaveError'),
        variant: 'destructive',
      });
    },
  });

  const handleSaveGuestAccess = () => {
    saveGuestAccessMutation.mutate({ allowGuestPollCreation, allowGuestVoting });
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await apiRequest('POST', '/api/v1/oidc-test');
      const result = await res.json();
      if (result.success) {
        toast({ title: t('admin.oidc.testConnection'), description: result.details || t('admin.oidc.testSuccess') });
      } else {
        toast({ title: t('admin.oidc.testFailed'), description: result.error || t('admin.oidc.testError'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('admin.oidc.testFailed'), description: t('admin.oidc.testError'), variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
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

      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Key className="w-5 h-5 mr-2" />
              {t('admin.oidc.keycloakSettings')}
            </div>
            {configLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : oidcConfig?.enabled ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle className="w-3 h-3 mr-1" />
                {t('admin.oidc.active')}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                <XCircle className="w-3 h-3 mr-1" />
                {t('admin.oidc.inactive')}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>{t('admin.oidc.keycloakDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!configLoading && configError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{t('admin.oidc.testError')}</AlertDescription>
            </Alert>
          )}

          {!configLoading && !configError && !oidcConfig?.configured && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{t('admin.oidc.notConfigured')}</AlertDescription>
            </Alert>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{t('admin.oidc.envHint')}</AlertDescription>
          </Alert>

          {configLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="keycloak-issuer">{t('admin.oidc.issuerUrl')}</Label>
                  <Input 
                    id="keycloak-issuer" 
                    value={oidcConfig?.issuerUrl || ''}
                    readOnly
                    className="bg-muted"
                    data-testid="input-keycloak-issuer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('admin.oidc.issuerUrlHint')}</p>
                </div>
                <div>
                  <Label htmlFor="keycloak-client">{t('admin.oidc.clientId')}</Label>
                  <Input 
                    id="keycloak-client" 
                    value={oidcConfig?.clientId || ''}
                    readOnly
                    className="bg-muted"
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
                    value={oidcConfig?.hasClientSecret ? '••••••••••••••••' : ''}
                    readOnly
                    className="bg-muted"
                    data-testid="input-keycloak-secret"
                  />
                </div>
                <div>
                  <Label htmlFor="keycloak-callback">{t('admin.oidc.callbackUrl')}</Label>
                  <Input 
                    id="keycloak-callback" 
                    value={oidcConfig?.callbackUrl || ''}
                    readOnly
                    className="bg-muted"
                    data-testid="input-keycloak-callback"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('admin.oidc.callbackUrlHint')}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Switch id="keycloak-enabled" checked={oidcConfig?.enabled ?? false} disabled data-testid="switch-keycloak-enabled" />
                <Label htmlFor="keycloak-enabled">{t('admin.oidc.enableOidc')}</Label>
              </div>

              {oidcConfig?.configured && (
                <div className="flex justify-end pt-4">
                  <Button 
                    variant="outline" 
                    data-testid="button-test-oidc"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('admin.oidc.testing')}
                      </>
                    ) : (
                      t('admin.oidc.testConnection')
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Key className="w-5 h-5 mr-2" />
            {t('admin.oidc.ssoButtonLabel')}
          </CardTitle>
          <CardDescription>{t('admin.oidc.ssoButtonLabelDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                id="sso-button-label"
                value={ssoButtonLabel}
                onChange={(e) => setSsoButtonLabel(e.target.value)}
                placeholder={t('admin.oidc.ssoButtonLabelPlaceholder')}
                data-testid="input-sso-button-label"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('admin.oidc.ssoButtonLabelHint')}
                {ssoLabelIsFromEnv && (
                  <span className="ml-1 text-amber-600 dark:text-amber-400">
                    ({t('admin.oidc.ssoLabelFromEnv')})
                  </span>
                )}
              </p>
            </div>
            <Button
              onClick={handleSaveSsoLabel}
              disabled={saveSsoLabelMutation.isPending}
              data-testid="button-save-sso-label"
            >
              {saveSsoLabelMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('admin.oidc.ssoLabelSave')
              )}
            </Button>
          </div>
          {ssoButtonLabel && (
            <div className="p-3 border rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-2">{t('admin.oidc.ssoLabelPreview')}</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 border rounded-md bg-background text-sm font-medium">
                <KeyRound className="h-4 w-4" />
                {ssoButtonLabel}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <ShieldCheck className="w-5 h-5 mr-2" />
              {t('admin.auth.passwordPolicy')}
            </div>
            {savePolicyMutation.isPending && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
          <CardDescription>{t('admin.auth.passwordPolicyDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="policy-min-length">{t('admin.auth.minLength')}</Label>
            <div className="flex items-center gap-3">
              <Input
                id="policy-min-length"
                type="number"
                min={8}
                max={128}
                value={policyMinLength}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 8 && v <= 128) setPolicyMinLength(v);
                }}
                className="w-24"
                data-testid="input-policy-min-length"
              />
              <p className="text-xs text-muted-foreground">{t('admin.auth.minLengthHint')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {[
              { id: 'policy-uppercase', key: 'requireUppercase', label: t('admin.auth.requireUppercase'), value: policyUppercase, setter: setPolicyUppercase },
              { id: 'policy-lowercase', key: 'requireLowercase', label: t('admin.auth.requireLowercase'), value: policyLowercase, setter: setPolicyLowercase },
              { id: 'policy-numbers', key: 'requireNumbers', label: t('admin.auth.requireNumbers'), value: policyNumbers, setter: setPolicyNumbers },
              { id: 'policy-special', key: 'requireSpecialChars', label: t('admin.auth.requireSpecialChars'), value: policySpecial, setter: setPolicySpecial },
            ].map(({ id, label, value, setter }) => (
              <div key={id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <Label htmlFor={id} className="cursor-pointer text-sm font-normal">{label}</Label>
                <Switch
                  id={id}
                  checked={value}
                  onCheckedChange={setter}
                  data-testid={`switch-${id}`}
                />
              </div>
            ))}
          </div>

          {policySpecial && (
            <p className="text-xs text-muted-foreground">{t('admin.auth.specialCharsSet')}</p>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{t('admin.auth.policyNote')}</AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button
              onClick={handleSavePolicy}
              disabled={savePolicyMutation.isPending}
              data-testid="button-save-password-policy"
            >
              {savePolicyMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('admin.auth.passwordPolicySaveBtn')
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <ShieldCheck className="w-5 h-5 mr-2" />
              {t('admin.auth.mfaPolicy')}
            </div>
            {saveMfaMutation.isPending && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
          <CardDescription>{t('admin.auth.mfaPolicyDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
            <div>
              <Label htmlFor="switch-admin-mfa-required" className="text-sm font-normal cursor-pointer">
                {t('admin.auth.adminMfaRequired')}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">{t('admin.auth.adminMfaRequiredDescription')}</p>
            </div>
            <Switch
              id="switch-admin-mfa-required"
              checked={adminMfaRequired}
              onCheckedChange={handleMfaToggle}
              data-testid="switch-admin-mfa-required"
            />
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{t('admin.auth.mfaPolicyNote')}</AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveMfa}
              disabled={saveMfaMutation.isPending}
              data-testid="button-save-mfa-policy"
            >
              {saveMfaMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('admin.auth.mfaPolicySaveBtn')
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showMfaConfirmDialog} onOpenChange={setShowMfaConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.auth.mfaCoverageDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {mfaCoverage !== null ? (
                mfaCoverage.withoutMfa === 0
                  ? t('admin.auth.mfaCoverageDialogBodyAllReady')
                  : t('admin.auth.mfaCoverageDialogBody', {
                      withoutMfa: mfaCoverage.withoutMfa,
                      total: mfaCoverage.total,
                    })
              ) : (
                t('admin.auth.mfaCoverageDialogTitle')
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setAdminMfaRequired(false);
                setShowMfaConfirmDialog(false);
              }}
            >
              {t('admin.auth.mfaCoverageDialogCancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Set state to true now that the user has explicitly confirmed,
                // then immediately persist — no second Save button press needed.
                setAdminMfaRequired(true);
                setShowMfaConfirmDialog(false);
                saveMfaMutation.mutate({ adminMfaRequired: true });
              }}
            >
              {t('admin.auth.mfaCoverageDialogConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <ShieldCheck className="w-5 h-5 mr-2" />
              {t('admin.auth.guestAccess')}
            </div>
            {saveGuestAccessMutation.isPending && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
          <CardDescription>{t('admin.auth.guestAccessDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
            <div>
              <Label htmlFor="switch-guest-poll-creation" className="text-sm font-normal cursor-pointer">
                {t('admin.auth.allowGuestPollCreation')}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">{t('admin.auth.allowGuestPollCreationDescription')}</p>
            </div>
            <Switch
              id="switch-guest-poll-creation"
              checked={allowGuestPollCreation}
              onCheckedChange={setAllowGuestPollCreation}
              data-testid="switch-guest-poll-creation"
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
            <div>
              <Label htmlFor="switch-guest-voting" className="text-sm font-normal cursor-pointer">
                {t('admin.auth.allowGuestVoting')}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">{t('admin.auth.allowGuestVotingDescription')}</p>
            </div>
            <Switch
              id="switch-guest-voting"
              checked={allowGuestVoting}
              onCheckedChange={setAllowGuestVoting}
              data-testid="switch-guest-voting"
            />
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{t('admin.auth.guestAccessNote')}</AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveGuestAccess}
              disabled={saveGuestAccessMutation.isPending}
              data-testid="button-save-guest-access"
            >
              {saveGuestAccessMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('admin.auth.guestAccessSaveBtn')
              )}
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
