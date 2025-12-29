import { useLocation } from "wouter";
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
import { ArrowLeft, User, Mail, Building, Shield, Moon, Sun, Monitor, Calendar, Save, Key, ExternalLink, AlertCircle, Trash2, Clock } from "lucide-react";
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
  const { t } = useTranslation();

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

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['/api/v1/user/profile'],
    enabled: !!user,
  });

  const { data: authMethods } = useQuery<{ local: boolean; keycloak: boolean; keycloakAccountUrl?: string }>({
    queryKey: ['/api/v1/auth/methods'],
  });

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
    if (newPassword.length < 8) {
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
                    <span>{t('profile.memberSince')}: {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('de-DE') : '-'}</span>
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
                            date: new Date(profile.deletionRequestedAt).toLocaleDateString('de-DE', { 
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
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1"
                data-testid="input-new-password"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('profile.minCharacters')}</p>
            </div>
            <div>
              <Label htmlFor="confirmPassword">{t('profile.confirmNewPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1"
                data-testid="input-confirm-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handlePasswordChange}
              disabled={changePasswordMutation.isPending}
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
