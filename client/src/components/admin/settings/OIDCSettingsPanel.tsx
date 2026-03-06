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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Key,
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
  AlertTriangle
} from "lucide-react";

interface OidcConfig {
  configured: boolean;
  enabled: boolean;
  issuerUrl: string;
  clientId: string;
  hasClientSecret: boolean;
  callbackUrl: string;
}

export function OIDCSettingsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTesting, setIsTesting] = useState(false);
  
  const { data: authMethods } = useQuery<{ local: boolean; keycloak: boolean; registrationEnabled: boolean }>({
    queryKey: ['/api/v1/auth/methods'],
  });

  const { data: oidcConfig, isLoading: configLoading, isError: configError } = useQuery<OidcConfig>({
    queryKey: ['/api/v1/oidc-config'],
  });
  
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean>(true);
  
  useEffect(() => {
    if (authMethods) {
      setRegistrationEnabled(authMethods.registrationEnabled);
    }
  }, [authMethods]);
  
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

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await apiRequest('POST', '/api/v1/oidc-test');
      const result = await res.json();
      if (result.success) {
        toast({ title: t('admin.oidc.testConnection'), description: t('admin.oidc.testSuccess') });
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
