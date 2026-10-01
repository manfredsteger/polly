import { useLocation } from "wouter";
import { PasswordStrengthIndicator, validatePasswordWithPolicy, usePasswordPolicy } from '@/components/PasswordStrengthIndicator';
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, User, Mail, Building, Shield, Moon, Sun, Monitor, Calendar, Save, Key, ExternalLink, AlertCircle, Trash2, Clock, ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import type { ThemePreference } from "@shared/schema";
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface UserProfile {
  id: number;
  username: string;
  email: string;
  name: string;
  organization: string | null;
  role: string;
  provider: string;
  themePreference: ThemePreference;
  createdAt: string;
  lastLoginAt: string | null;
  deletionRequestedAt: string | null;
}

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<ThemePreference>("system");

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [mfaSetupOpen, setMfaSetupOpen] = useState(false);
  const [mfaDisableOpen, setMfaDisableOpen] = useState(false);
  const [mfaQrDataUrl, setMfaQrDataUrl] = useState('');
  const [mfaManualKey, setMfaManualKey] = useState('');
  const [mfaSetupCode, setMfaSetupCode] = useState('');
  const [mfaDisableInput, setMfaDisableInput] = useState('');

  const { data: mfaStatus, refetch: refetchMfa } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/v1/auth/mfa/status'],
    enabled: !!user,
  });

  const mfaSetupInitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/v1/auth/mfa/setup-init');
      return res.json();
    },
    onSuccess: (data) => {
      setMfaQrDataUrl(data.qrCode ?? '');
      setMfaManualKey(data.secret ?? '');
      setMfaSetupCode('');
      setMfaSetupOpen(true);
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: parseErrorMessage(error), variant: 'destructive' });
    },
  });

  const mfaSetupConfirmMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest('POST', '/api/v1/auth/mfa/setup-confirm', { token });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t('profile.mfaActivated'), description: t('profile.mfaActivatedDescription') });
      setMfaSetupOpen(false);
      setMfaSetupCode('');
      refetchMfa();
    },
    onError: () => {
      toast({ title: t('common.error'), description: t('profile.mfaInvalidCode'), variant: 'destructive' });
    },
  });

  const mfaDisableMutation = useMutation({
    mutationFn: async (payload: { token?: string; password?: string }) => {
      const res = await apiRequest('POST', '/api/v1/auth/mfa/disable', payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t('profile.mfaDisabled'), description: t('profile.mfaDisabledDescription') });
      setMfaDisableOpen(false);
      setMfaDisableInput('');
      refetchMfa();
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: parseErrorMessage(error), variant: 'destructive' });
    },
  });

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['/api/v1/user/profile'],
    enabled: !!user,
  });

  const { data: authMethods } = useQuery<{ local: boolean; keycloak: boolean; keycloakAccountUrl?: string }>({
    queryKey: ['/api/v1/auth/methods'],
  });

  const { data: passwordPolicy } = usePasswordPolicy();

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setOrganization(profile.organization || "");
      setSelectedTheme(profile.themePreference);
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: { name?: string; organization?: string; themePreference?: ThemePreference }) => {
      const response = await apiRequest('PUT', '/api/v1/user/profile', updates);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('profile.profileUpdated'),
        description: t('profile.profileUpdatedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/user/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/auth/me'] });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('profile.profileUpdateError'),
        variant: "destructive",
      });
    },
  });

  const parseErrorMessage = (error: any): string => {
    if (!error?.message) return t('profile.unknownError');
    const msg = error.message;
    const colonIndex = msg.indexOf(': ');
    if (colonIndex > -1) {
      const jsonPart = msg.substring(colonIndex + 2);
      try {
        const parsed = JSON.parse(jsonPart);
        return parsed.error || parsed.message || msg;
      } catch {
        return jsonPart;
      }
    }
    return msg;
  };

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest('POST', '/api/v1/auth/change-password', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('profile.passwordChanged'),
        description: t('profile.passwordChangedDescription'),
      });
      setPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: parseErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const requestEmailChangeMutation = useMutation({
    mutationFn: async (data: { newEmail: string; password: string }) => {
      const response = await apiRequest('POST', '/api/v1/auth/request-email-change', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('profile.confirmationLinkSent'),
        description: t('profile.confirmationLinkDescription'),
      });
      setEmailDialogOpen(false);
      setNewEmail("");
      setEmailPassword("");
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: parseErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const requestDeletionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/auth/request-deletion');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('profile.deletionRequestedTitle'),
        description: t('profile.deletionRequestedDescription'),
      });
      setDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/v1/user/profile'] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: parseErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const cancelDeletionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/v1/auth/request-deletion');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('profile.deletionCancelledTitle'),
        description: t('profile.deletionCancelledDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/user/profile'] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: parseErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const handleThemeChange = (value: ThemePreference) => {
    setSelectedTheme(value);
    setTheme(value);
  };

  const handleSave = () => {
    updateProfileMutation.mutate({
      name,
      organization: organization || undefined,
      themePreference: selectedTheme,
    });
  };

  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: t('common.error'),
        description: t('profile.passwordMismatchError'),
        variant: "destructive",
      });
      return;
    }
    if (!validatePasswordWithPolicy(newPassword, passwordPolicy)) {
      toast({
        title: t('common.error'),
        description: t('profile.passwordTooShort'),
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleEmailChange = () => {
    if (!newEmail || !emailPassword) {
      toast({
        title: t('common.error'),
        description: t('profile.fillAllFields'),
        variant: "destructive",
      });
      return;
    }
    requestEmailChangeMutation.mutate({ newEmail, password: emailPassword });
  };

  const isLocalAccount = profile?.provider === 'local';

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return t('profile.roleAdmin');
      case 'manager':
        return t('profile.roleManager');
      default:
        return t('profile.roleUser');
    }
  };

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground mb-4">
              {t('profile.pleaseLogin')}
            </p>
            <Button className="w-full" onClick={() => setLocation("/anmelden")}>
              {t('nav.login')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Button
        variant="ghost"
        onClick={() => setLocation("/")}
        className="mb-6"
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t('profile.backToHome')}
      </Button>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('profile.myProfile')}</h1>
          <p className="text-muted-foreground mt-1">{t('profile.manageSettings')}</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {t('profile.personalData')}
                </CardTitle>
                <CardDescription>
                  {t('profile.basicAccountInfo')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="username" className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {t('profile.username')}
                    </Label>
                    <Input
                      id="username"
                      value={profile?.username || ""}
                      disabled
                      className="mt-1 bg-muted"
                      data-testid="input-username"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t('profile.cannotBeChanged')}</p>
                  </div>
                  <div>
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      {t('auth.email')}
                    </Label>
                    <Input
                      id="email"
                      value={profile?.email || ""}
                      disabled
                      className="mt-1 bg-muted"
                      data-testid="input-email"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t('profile.cannotBeChanged')}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="name">{t('auth.name')}</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1"
                      data-testid="input-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="organization" className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-muted-foreground" />
                      {t('profile.organization')}
                    </Label>
                    <Input
                      id="organization"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder={t('profile.organizationPlaceholder')}
                      className="mt-1"
                      data-testid="input-organization"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>{t('profile.role')}: {getRoleLabel(profile?.role || 'user')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{t('profile.memberSince')}: {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'en-US') : '-'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  {t('profile.security')}
                </CardTitle>
                <CardDescription>
                  {t('profile.securityDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLocalAccount ? (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{t('profile.changePassword')}</p>
                        <p className="text-sm text-muted-foreground">{t('profile.changePasswordDescription')}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => setPasswordDialogOpen(true)}
                        data-testid="button-change-password"
                      >
                        <Key className="w-4 h-4 mr-2" />
                        {t('profile.changePassword')}
                      </Button>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{t('profile.changeEmail')}</p>
                        <p className="text-sm text-muted-foreground">{t('profile.changeEmailDescription')}: {profile?.email}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => setEmailDialogOpen(true)}
                        data-testid="button-change-email"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        {t('profile.changeEmail')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">{t('profile.ssoAccount')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('profile.ssoAccountDescription')}
                        </p>
                      </div>
                    </div>
                    {authMethods?.keycloakAccountUrl && (
                      <Button 
                        variant="outline"
                        onClick={() => window.open(authMethods.keycloakAccountUrl, '_blank')}
                        data-testid="button-keycloak-account"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        {t('profile.manageAccount')}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {isLocalAccount && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" />
                    {t('profile.mfa')}
                  </CardTitle>
                  <CardDescription>{t('profile.mfaDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">
                        {mfaStatus?.enabled ? t('profile.mfaEnabled') : t('profile.mfaNotEnabled')}
                      </p>
                      <p className="text-sm text-muted-foreground">{t('profile.mfaDescription')}</p>
                    </div>
                    {mfaStatus?.enabled ? (
                      <Button
                        variant="outline"
                        onClick={() => { setMfaDisableInput(''); setMfaDisableOpen(true); }}
                        data-testid="button-mfa-disable"
                      >
                        <ShieldOff className="w-4 h-4 mr-2" />
                        {t('profile.mfaDisable')}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => mfaSetupInitMutation.mutate()}
                        disabled={mfaSetupInitMutation.isPending}
                        data-testid="button-mfa-setup"
                      >
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        {t('profile.mfaSetup')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* MFA Setup Dialog */}
            <Dialog open={mfaSetupOpen} onOpenChange={setMfaSetupOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t('profile.mfaSetup')}</DialogTitle>
                  <DialogDescription>{t('profile.mfaSetupStep1Description')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm font-medium">{t('profile.mfaSetupStep1')}</p>
                  {mfaQrDataUrl && (
                    <div className="flex justify-center p-4 bg-white rounded-lg border">
                      <img src={mfaQrDataUrl} alt="MFA QR Code" className="w-48 h-48" data-testid="mfa-setup-qr" />
                    </div>
                  )}
                  {mfaManualKey && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">{t('profile.mfaManualEntry')}</p>
                      <code className="block text-xs bg-muted px-3 py-2 rounded font-mono break-all">{mfaManualKey}</code>
                    </div>
                  )}
                  <p className="text-sm font-medium">{t('profile.mfaSetupStep2')}</p>
                  <p className="text-xs text-muted-foreground">{t('profile.mfaSetupStep2Description')}</p>
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={mfaSetupCode}
                    onChange={(e) => setMfaSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('profile.mfaCodePlaceholder')}
                    maxLength={6}
                    data-testid="input-mfa-setup-code"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setMfaSetupOpen(false)}>{t('common.cancel')}</Button>
                  <Button
                    onClick={() => mfaSetupConfirmMutation.mutate(mfaSetupCode)}
                    disabled={mfaSetupCode.length !== 6 || mfaSetupConfirmMutation.isPending}
                    data-testid="button-mfa-setup-confirm"
                  >
                    {mfaSetupConfirmMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t('profile.mfaConfirm')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* MFA Disable Dialog */}
            <Dialog open={mfaDisableOpen} onOpenChange={setMfaDisableOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t('profile.mfaDisable')}</DialogTitle>
                  <DialogDescription>{t('profile.mfaDisableConfirm')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={mfaDisableInput}
                    onChange={(e) => setMfaDisableInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('profile.mfaCodePlaceholder')}
                    maxLength={6}
                    data-testid="input-mfa-disable-code"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setMfaDisableOpen(false)}>{t('common.cancel')}</Button>
                  <Button
                    variant="destructive"
                    onClick={() => mfaDisableMutation.mutate({ token: mfaDisableInput })}
                    disabled={mfaDisableInput.length !== 6 || mfaDisableMutation.isPending}
                    data-testid="button-mfa-disable-confirm"
                  >
                    {mfaDisableMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t('profile.mfaDisable')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Moon className="w-5 h-5" />
                  {t('profile.appearance')}
                </CardTitle>
                <CardDescription>
                  {t('profile.appearanceDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Label>{t('profile.colorScheme')}</Label>
                  <Select value={selectedTheme} onValueChange={(value) => handleThemeChange(value as ThemePreference)}>
                    <SelectTrigger className="w-full md:w-[280px]" data-testid="select-theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        <div className="flex items-center gap-2">
                          <Sun className="w-4 h-4" />
                          <span>{t('profile.themeLight')}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="dark">
                        <div className="flex items-center gap-2">
                          <Moon className="w-4 h-4" />
                          <span>{t('profile.themeDark')}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="system">
                        <div className="flex items-center gap-2">
                          <Monitor className="w-4 h-4" />
                          <span>{t('profile.themeSystem')}</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {selectedTheme === 'system' 
                      ? t('profile.themeSystemDescription')
                      : selectedTheme === 'dark' 
                        ? t('profile.themeDarkDescription')
                        : t('profile.themeLightDescription')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="w-5 h-5" />
                  {t('profile.deleteAccountTitle')}
                </CardTitle>
                <CardDescription>
                  {t('profile.deleteAccountGdpr')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {profile?.deletionRequestedAt ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                      <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">{t('profile.deletionRequestSubmitted')}</p>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          {t('profile.deletionRequestDescription', { 
                            date: new Date(profile.deletionRequestedAt).toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'en-US', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          })}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={() => cancelDeletionMutation.mutate()}
                      disabled={cancelDeletionMutation.isPending}
                      data-testid="button-cancel-deletion"
                    >
                      {cancelDeletionMutation.isPending ? t('profile.cancelling') : t('profile.cancelDeletionRequest')}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{t('profile.deleteAccountAndData')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('profile.deleteAccountWarning')}
                      </p>
                    </div>
                    <Button 
                      variant="destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                      data-testid="button-request-deletion"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('profile.requestDeletion')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button 
                onClick={handleSave}
                disabled={updateProfileMutation.isPending}
                className="polly-button-primary"
                data-testid="button-save-profile"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateProfileMutation.isPending ? t('profile.saving') : t('profile.saveChanges')}
              </Button>
            </div>
          </>
        )}
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              {t('profile.requestDeletionDialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('profile.requestDeletionDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm font-medium text-destructive">{t('profile.whatWillBeDeleted')}</p>
              <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>{t('profile.deleteItem1')}</li>
                <li>{t('profile.deleteItem2')}</li>
                <li>{t('profile.deleteItem3')}</li>
                <li>{t('profile.deleteItem4')}</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('profile.deletionAdminInfo')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              variant="destructive"
              onClick={() => requestDeletionMutation.mutate()}
              disabled={requestDeletionMutation.isPending}
              data-testid="button-confirm-deletion"
            >
              {requestDeletionMutation.isPending ? t('profile.requesting') : t('profile.confirmDeletion')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.changePasswordDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('profile.changePasswordDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="currentPassword">{t('auth.currentPassword')}</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="off"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1"
                data-testid="input-current-password"
              />
            </div>
            <div>
              <Label htmlFor="newPassword">{t('auth.newPassword')}</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="off"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1"
                data-testid="input-new-password"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">{t('profile.confirmNewPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="off"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1"
                data-testid="input-confirm-password"
              />
            </div>
            <PasswordStrengthIndicator password={newPassword} confirmPassword={confirmPassword} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handlePasswordChange}
              disabled={
                changePasswordMutation.isPending ||
                !validatePasswordWithPolicy(newPassword, passwordPolicy) ||
                newPassword !== confirmPassword
              }
              className="polly-button-primary"
              data-testid="button-submit-password"
            >
              {changePasswordMutation.isPending ? t('profile.saving') : t('profile.changePassword')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.changeEmailDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('profile.changeEmailDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="newEmail">{t('profile.newEmailAddress')}</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="mt-1"
                placeholder={t('profile.newEmailPlaceholder')}
                data-testid="input-new-email"
              />
            </div>
            <div>
              <Label htmlFor="emailPassword">{t('profile.passwordForConfirmation')}</Label>
              <Input
                id="emailPassword"
                type="password"
                autoComplete="off"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                className="mt-1"
                data-testid="input-email-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleEmailChange}
              disabled={requestEmailChangeMutation.isPending}
              className="polly-button-primary"
              data-testid="button-submit-email"
            >
              {requestEmailChangeMutation.isPending ? t('profile.sending') : t('profile.sendConfirmationLink')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
