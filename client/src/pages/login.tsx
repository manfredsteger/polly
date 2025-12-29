import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LogIn, UserPlus, KeyRound, AlertCircle, Loader2, Check, X } from 'lucide-react';

interface PasswordRequirement {
  label: string;
  met: boolean;
}

function PasswordStrengthIndicator({ password, confirmPassword }: { password: string; confirmPassword: string }) {
  const requirements: PasswordRequirement[] = useMemo(() => [
    { label: 'Mindestens 8 Zeichen', met: password.length >= 8 },
    { label: 'Mindestens ein Großbuchstabe', met: /[A-Z]/.test(password) },
    { label: 'Mindestens ein Kleinbuchstabe', met: /[a-z]/.test(password) },
    { label: 'Mindestens eine Zahl', met: /[0-9]/.test(password) },
    { label: 'Mindestens ein Sonderzeichen (!@#$%^&*...)', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) },
  ], [password]);

  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const allRequirementsMet = requirements.every(r => r.met);
  
  const strengthPercentage = (requirements.filter(r => r.met).length / requirements.length) * 100;
  
  const getStrengthColor = () => {
    if (strengthPercentage < 40) return 'bg-red-500';
    if (strengthPercentage < 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthLabel = () => {
    if (strengthPercentage < 40) return 'Schwach';
    if (strengthPercentage < 80) return 'Mittel';
    return 'Stark';
  };

  if (password.length === 0) return null;

  return (
    <div className="space-y-3 mt-2 p-3 bg-muted/50 rounded-lg border" data-testid="password-strength-indicator">
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Passwortstärke</span>
          <span className={`font-medium ${strengthPercentage === 100 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
            {getStrengthLabel()}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${getStrengthColor()}`}
            style={{ width: `${strengthPercentage}%` }}
          />
        </div>
      </div>
      
      <div className="space-y-1.5">
        {requirements.map((req, index) => (
          <div 
            key={index} 
            className={`flex items-center gap-2 text-xs ${req.met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
            data-testid={`password-requirement-${index}`}
          >
            {req.met ? (
              <Check className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
            )}
            <span>{req.label}</span>
          </div>
        ))}
        
        {confirmPassword.length > 0 && (
          <div 
            className={`flex items-center gap-2 text-xs ${passwordsMatch ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}
            data-testid="password-match-indicator"
          >
            {passwordsMatch ? (
              <Check className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            <span>Passwörter stimmen überein</span>
          </div>
        )}
      </div>

      {allRequirementsMet && passwordsMatch && (
        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 font-medium pt-1 border-t border-green-200 dark:border-green-800">
          <Check className="h-4 w-4" />
          <span>Passwort erfüllt alle Anforderungen</span>
        </div>
      )}
    </div>
  );
}

function validatePassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)
  );
}

function parseErrorMessage(rawError: string): string {
  try {
    const jsonMatch = rawError.match(/\d+:\s*(.+)/);
    if (jsonMatch) {
      const jsonPart = jsonMatch[1];
      const parsed = JSON.parse(jsonPart);
      if (parsed.error) {
        return parsed.error;
      }
    }
  } catch {
  }
  
  if (rawError.includes('401')) {
    return 'Benutzername oder Passwort ist falsch. Bitte überprüfen Sie Ihre Eingaben.';
  }
  if (rawError.includes('403')) {
    return 'Der Zugang wurde verweigert. Die Registrierung ist möglicherweise deaktiviert.';
  }
  if (rawError.includes('409')) {
    return 'Ein Benutzer mit diesem Namen oder dieser E-Mail existiert bereits.';
  }
  if (rawError.includes('500')) {
    return 'Ein Serverfehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
  }
  
  return rawError;
}

export default function Login() {
  const [location, navigate] = useLocation();
  const { login, register, authMethods, isAuthenticated, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get email from URL params for pre-filling
  const getEmailFromUrl = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const email = searchParams.get('email');
    return email ? decodeURIComponent(email) : '';
  };

  const [loginForm, setLoginForm] = useState({ usernameOrEmail: getEmailFromUrl(), password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: getEmailFromUrl(), name: '', password: '', confirmPassword: '' });

  // Get redirect URL from query params
  const getRedirectUrl = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const redirect = searchParams.get('redirect') || searchParams.get('returnTo');
    return redirect ? decodeURIComponent(redirect) : '/meine-umfragen';
  };

  // Scroll to top on mount to prevent auto-focus scroll issues
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Admins direkt zum Admin-Bereich weiterleiten (außer expliziter Redirect)
      const searchParams = new URLSearchParams(window.location.search);
      const hasExplicitRedirect = searchParams.get('redirect') || searchParams.get('returnTo');
      if (user.role === 'admin' && !hasExplicitRedirect) {
        navigate('/admin');
      } else {
        navigate(getRedirectUrl());
      }
    }
  }, [isAuthenticated, user, navigate]);

  if (isAuthenticated && user) {
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const loggedInUser = await login(loginForm.usernameOrEmail, loginForm.password);
      // Admins direkt zum Admin-Bereich weiterleiten (außer expliziter Redirect)
      const searchParams = new URLSearchParams(window.location.search);
      const hasExplicitRedirect = searchParams.get('redirect') || searchParams.get('returnTo');
      if (loggedInUser.role === 'admin' && !hasExplicitRedirect) {
        navigate('/admin');
      } else {
        navigate(getRedirectUrl());
      }
    } catch (err: any) {
      const rawError = err?.message || 'Anmeldung fehlgeschlagen';
      setError(parseErrorMessage(rawError));
    } finally {
      setIsLoading(false);
    }
  };

  const isPasswordValid = validatePassword(registerForm.password);
  const passwordsMatch = registerForm.password === registerForm.confirmPassword;
  const canRegister = isPasswordValid && passwordsMatch && 
    registerForm.username.length >= 3 && 
    registerForm.email.length > 0 && 
    registerForm.name.length > 0;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError('Bitte erfüllen Sie alle Passwort-Anforderungen');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    setIsLoading(true);

    try {
      await register(registerForm.username, registerForm.email, registerForm.name, registerForm.password);
      navigate(getRedirectUrl());
    } catch (err: any) {
      const rawError = err?.message || 'Registrierung fehlgeschlagen';
      setError(parseErrorMessage(rawError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeycloakLogin = () => {
    window.location.href = '/api/v1/auth/keycloak';
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Poll<span className="text-polly-orange">y</span></CardTitle>
          <CardDescription>
            Melden Sie sich an, um Ihre Umfragen zu verwalten
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="polly-alert-error rounded-lg p-4 flex items-start gap-3 mb-4">
              <AlertCircle className="polly-alert-icon h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {authMethods.registrationEnabled ? (
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" data-testid="tab-login">
                  <LogIn className="h-4 w-4 mr-2" />
                  Anmelden
                </TabsTrigger>
                <TabsTrigger value="register" data-testid="tab-register">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Registrieren
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Benutzername oder E-Mail</Label>
                    <Input
                      id="login-username"
                      type="text"
                      value={loginForm.usernameOrEmail}
                      onChange={(e) => setLoginForm({ ...loginForm, usernameOrEmail: e.target.value })}
                      placeholder="max@example.de"
                      required
                      data-testid="input-login-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Passwort</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      placeholder="••••••••"
                      required
                      data-testid="input-login-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login-submit">
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                    Anmelden
                  </Button>
                  <div className="text-center mt-3">
                    <a 
                      href="/passwort-vergessen" 
                      className="text-sm text-muted-foreground hover:text-primary hover:underline"
                      data-testid="link-forgot-password"
                    >
                      Passwort vergessen?
                    </a>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Vollständiger Name</Label>
                    <Input
                      id="register-name"
                      type="text"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      placeholder="Max Mustermann"
                      required
                      data-testid="input-register-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Benutzername</Label>
                    <Input
                      id="register-username"
                      type="text"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                      placeholder="max123"
                      required
                      minLength={3}
                      data-testid="input-register-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">E-Mail-Adresse</Label>
                    <Input
                      id="register-email"
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      placeholder="max@example.de"
                      required
                      data-testid="input-register-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Passwort</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      placeholder="Sicheres Passwort eingeben"
                      required
                      data-testid="input-register-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm">Passwort bestätigen</Label>
                    <Input
                      id="register-confirm"
                      type="password"
                      value={registerForm.confirmPassword}
                      onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                      placeholder="Passwort wiederholen"
                      required
                      data-testid="input-register-confirm"
                    />
                  </div>
                  
                  <PasswordStrengthIndicator 
                    password={registerForm.password} 
                    confirmPassword={registerForm.confirmPassword} 
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || !canRegister} 
                    data-testid="button-register-submit"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                    Registrieren
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-username">Benutzername oder E-Mail</Label>
                <Input
                  id="login-username"
                  type="text"
                  value={loginForm.usernameOrEmail}
                  onChange={(e) => setLoginForm({ ...loginForm, usernameOrEmail: e.target.value })}
                  placeholder="max@example.de"
                  required
                  data-testid="input-login-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Passwort</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  data-testid="input-login-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login-submit">
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                Anmelden
              </Button>
              <div className="text-center mt-3">
                <a 
                  href="/passwort-vergessen" 
                  className="text-sm text-muted-foreground hover:text-primary hover:underline"
                  data-testid="link-forgot-password"
                >
                  Passwort vergessen?
                </a>
              </div>
            </form>
          )}

          {authMethods.keycloak && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">oder</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleKeycloakLogin}
                data-testid="button-keycloak-login"
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Mit Keycloak anmelden
              </Button>
            </>
          )}
        </CardContent>
        <CardFooter className="text-center text-sm text-muted-foreground">
          <p className="w-full">
            Sie können auch ohne Anmeldung Umfragen erstellen und abstimmen.{' '}
            <a href="/" className="text-primary hover:underline" data-testid="link-home">
              Zur Startseite
            </a>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
