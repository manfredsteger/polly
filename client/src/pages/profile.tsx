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

  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<ThemePreference>("system");

  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Email change state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  // Account deletion state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['/api/v1/user/profile'],
    enabled: !!user,
  });

  // Get Keycloak account URL for OIDC users
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
        title: "Profil aktualisiert",
        description: "Ihre Änderungen wurden gespeichert.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/user/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/auth/me'] });
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Profil konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  const parseErrorMessage = (error: any): string => {
    if (!error?.message) return "Ein unbekannter Fehler ist aufgetreten.";
    const msg = error.message;
    // Parse error format "400: {json}" or just use message directly
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
        title: "Passwort geändert",
        description: "Ihr Passwort wurde erfolgreich geändert.",
      });
      setPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
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
        title: "Bestätigungslink gesendet",
        description: "Bitte überprüfen Sie Ihre neue E-Mail-Adresse für den Bestätigungslink.",
      });
      setEmailDialogOpen(false);
      setNewEmail("");
      setEmailPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
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
        title: "Löschantrag übermittelt",
        description: "Ein Administrator wird Ihren Antrag bearbeiten.",
      });
      setDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/v1/user/profile'] });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
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
        title: "Löschantrag zurückgezogen",
        description: "Ihr Konto wird nicht mehr gelöscht.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/user/profile'] });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
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
        title: "Fehler",
        description: "Die Passwörter stimmen nicht überein.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: "Fehler",
        description: "Das Passwort muss mindestens 8 Zeichen lang sein.",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleEmailChange = () => {
    if (!newEmail || !emailPassword) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Felder aus.",
        variant: "destructive",
      });
      return;
    }
    requestEmailChangeMutation.mutate({ newEmail, password: emailPassword });
  };

  const isLocalAccount = profile?.provider === 'local';

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
              Bitte melden Sie sich an, um Ihr Profil zu sehen.
            </p>
            <Button className="w-full" onClick={() => setLocation("/anmelden")}>
              Anmelden
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
        Zurück zur Startseite
      </Button>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mein Profil</h1>
          <p className="text-muted-foreground mt-1">Verwalten Sie Ihre persönlichen Einstellungen</p>
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
                  Persönliche Daten
                </CardTitle>
                <CardDescription>
                  Ihre grundlegenden Kontoinformationen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="username" className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      Benutzername
                    </Label>
                    <Input
                      id="username"
                      value={profile?.username || ""}
                      disabled
                      className="mt-1 bg-muted"
                      data-testid="input-username"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Kann nicht geändert werden</p>
                  </div>
                  <div>
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      E-Mail
                    </Label>
                    <Input
                      id="email"
                      value={profile?.email || ""}
                      disabled
                      className="mt-1 bg-muted"
                      data-testid="input-email"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Kann nicht geändert werden</p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="name">Name</Label>
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
                      Organisation
                    </Label>
                    <Input
                      id="organization"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="z.B. Mein Team"
                      className="mt-1"
                      data-testid="input-organization"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>Rolle: {profile?.role === 'admin' ? 'Administrator' : profile?.role === 'manager' ? 'Manager' : 'Benutzer'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Mitglied seit: {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('de-DE') : '-'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Sicherheit
                </CardTitle>
                <CardDescription>
                  Passwort und E-Mail-Adresse verwalten
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLocalAccount ? (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Passwort ändern</p>
                        <p className="text-sm text-muted-foreground">Vergeben Sie ein neues Passwort für Ihr Konto</p>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => setPasswordDialogOpen(true)}
                        data-testid="button-change-password"
                      >
                        <Key className="w-4 h-4 mr-2" />
                        Passwort ändern
                      </Button>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">E-Mail-Adresse ändern</p>
                        <p className="text-sm text-muted-foreground">Aktuelle E-Mail: {profile?.email}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => setEmailDialogOpen(true)}
                        data-testid="button-change-email"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        E-Mail ändern
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">Single Sign-On Konto</p>
                        <p className="text-sm text-muted-foreground">
                          Ihr Konto wird über einen externen Identitätsanbieter (Keycloak) verwaltet. 
                          Passwort- und E-Mail-Änderungen erfolgen über Ihr Organisationskonto.
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
                        Konto verwalten
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
                  Darstellung
                </CardTitle>
                <CardDescription>
                  Wählen Sie Ihr bevorzugtes Farbschema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Label>Farbschema</Label>
                  <Select value={selectedTheme} onValueChange={(value) => handleThemeChange(value as ThemePreference)}>
                    <SelectTrigger className="w-full md:w-[280px]" data-testid="select-theme">
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
                  <p className="text-sm text-muted-foreground">
                    {selectedTheme === 'system' 
                      ? 'Folgt Ihren Systemeinstellungen' 
                      : selectedTheme === 'dark' 
                        ? 'Dunkles Farbschema für Ihre Augen'
                        : 'Helles Farbschema für klare Lesbarkeit'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* GDPR Account Deletion Card */}
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="w-5 h-5" />
                  Konto löschen
                </CardTitle>
                <CardDescription>
                  Gemäß DSGVO Art. 17 haben Sie das Recht auf Löschung Ihrer personenbezogenen Daten.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {profile?.deletionRequestedAt ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                      <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">Löschantrag eingereicht</p>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Ihr Löschantrag wurde am {new Date(profile.deletionRequestedAt).toLocaleDateString('de-DE', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })} Uhr eingereicht und wartet auf Bearbeitung durch einen Administrator.
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={() => cancelDeletionMutation.mutate()}
                      disabled={cancelDeletionMutation.isPending}
                      data-testid="button-cancel-deletion"
                    >
                      {cancelDeletionMutation.isPending ? "Zurückziehen..." : "Löschantrag zurückziehen"}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Konto und alle Daten löschen</p>
                      <p className="text-sm text-muted-foreground">
                        Diese Aktion kann nicht rückgängig gemacht werden. Alle Ihre persönlichen Daten werden gelöscht.
                      </p>
                    </div>
                    <Button 
                      variant="destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                      data-testid="button-request-deletion"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Löschung beantragen
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
                {updateProfileMutation.isPending ? "Speichern..." : "Änderungen speichern"}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* GDPR Deletion Request Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Konto löschen beantragen
            </DialogTitle>
            <DialogDescription>
              Sie sind dabei, die Löschung Ihres Kontos zu beantragen. Diese Aktion ist unwiderruflich.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm font-medium text-destructive">Was wird gelöscht:</p>
              <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Ihr Benutzerkonto und Profildaten</li>
                <li>Alle von Ihnen erstellten Umfragen</li>
                <li>Alle Ihre abgegebenen Stimmen</li>
                <li>Alle E-Mail-Bestätigungen und Tokens</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              Ein Administrator wird Ihren Antrag prüfen und Ihre Daten gemäß DSGVO Art. 17 löschen.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              variant="destructive"
              onClick={() => requestDeletionMutation.mutate()}
              disabled={requestDeletionMutation.isPending}
              data-testid="button-confirm-deletion"
            >
              {requestDeletionMutation.isPending ? "Beantragen..." : "Löschung unwiderruflich beantragen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Passwort ändern</DialogTitle>
            <DialogDescription>
              Geben Sie Ihr aktuelles Passwort und das neue Passwort ein.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
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
              <Label htmlFor="newPassword">Neues Passwort</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1"
                data-testid="input-new-password"
              />
              <p className="text-xs text-muted-foreground mt-1">Mindestens 8 Zeichen</p>
            </div>
            <div>
              <Label htmlFor="confirmPassword">Neues Passwort bestätigen</Label>
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
              Abbrechen
            </Button>
            <Button 
              onClick={handlePasswordChange}
              disabled={changePasswordMutation.isPending}
              className="polly-button-primary"
              data-testid="button-submit-password"
            >
              {changePasswordMutation.isPending ? "Speichern..." : "Passwort ändern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Change Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>E-Mail-Adresse ändern</DialogTitle>
            <DialogDescription>
              Geben Sie Ihre neue E-Mail-Adresse und Ihr Passwort zur Bestätigung ein. 
              Sie erhalten einen Bestätigungslink an die neue Adresse.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="newEmail">Neue E-Mail-Adresse</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="mt-1"
                placeholder="neue.email@beispiel.de"
                data-testid="input-new-email"
              />
            </div>
            <div>
              <Label htmlFor="emailPassword">Passwort zur Bestätigung</Label>
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
              Abbrechen
            </Button>
            <Button 
              onClick={handleEmailChange}
              disabled={requestEmailChangeMutation.isPending}
              className="polly-button-primary"
              data-testid="button-submit-email"
            >
              {requestEmailChangeMutation.isPending ? "Senden..." : "Bestätigungslink senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
