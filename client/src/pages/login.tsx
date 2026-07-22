import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LogIn, UserPlus, KeyRound, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PasswordStrengthIndicator, usePasswordPolicy, validatePasswordWithPolicy } from '@/components/PasswordStrengthIndicator';

const PENDING_LOGIN_REDIRECT_KEY = 'polly-pending-login-redirect';


function isSafeRedirectPath(value: string | null): value is string {
  return !!value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/anmelden');
}

function readRedirectFromSearch(): string | null {
  const searchParams = new URLSearchParams(window.location.search);
  const redirect = searchParams.get('redirect') || searchParams.get('returnTo');
  return isSafeRedirectPath(redirect) ? redirect : null;
}

function useParseErrorMessage() {
  const { t } = useTranslation();
  
  return (rawError: string): string => {
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
      return t('auth.errors.invalidCredentials');
    }
    if (rawError.includes('403')) {
      return t('auth.errors.registrationDisabled');
    }
    if (rawError.includes('409')) {
      return t('auth.errors.userExists');
    }
    if (rawError.includes('500')) {
      return t('auth.errors.serverError');
    }
    
    return rawError;
  };
}

export default function Login() {
  const [location, navigate] = useLocation();
  const { login, register, authMethods, isAuthenticated, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  const parseErrorMessage = useParseErrorMessage();
  const [redirectUrl] = useState(() => {
    const redirectFromSearch = readRedirectFromSearch();
    if (redirectFromSearch) {
      sessionStorage.setItem(PENDING_LOGIN_REDIRECT_KEY, redirectFromSearch);
      return redirectFromSearch;
    }

    const storedRedirect = sessionStorage.getItem(PENDING_LOGIN_REDIRECT_KEY);
    return isSafeRedirectPath(storedRedirect) ? storedRedirect : '/';
  });

  const getEmailFromUrl = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const email = searchParams.get('email');
    return email ?? '';
  };

  const { data: passwordPolicy } = usePasswordPolicy();

  const [loginForm, setLoginForm] = useState({ usernameOrEmail: getEmailFromUrl(), password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: getEmailFromUrl(), name: '', password: '', confirmPassword: '' });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);

  const clearPendingRedirect = () => {
    sessionStorage.removeItem(PENDING_LOGIN_REDIRECT_KEY);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      const hasExplicitRedirect = redirectUrl !== '/';
      if (user.role === 'admin' && !hasExplicitRedirect) {
        clearPendingRedirect();
        navigate('/admin');
      } else {
        clearPendingRedirect();
        navigate(redirectUrl);
      }
    }
  }, [isAuthenticated, user, navigate, redirectUrl]);

  if (isAuthenticated && user) {
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const loggedInUser = await login(loginForm.usernameOrEmail, loginForm.password);
      const hasExplicitRedirect = redirectUrl !== '/';
      if (loggedInUser.role === 'admin' && !hasExplicitRedirect) {
        clearPendingRedirect();
        navigate('/admin');
      } else {
        clearPendingRedirect();
        navigate(redirectUrl);
      }
    } catch (err: any) {
      const rawError = err?.message || t('auth.loginError');
      setError(parseErrorMessage(rawError));
    } finally {
      setIsLoading(false);
    }
  };

  const isPasswordValid = validatePasswordWithPolicy(registerForm.password, passwordPolicy);
  const passwordsMatch = registerForm.password === registerForm.confirmPassword;
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const emailValid = isValidEmail(registerForm.email);
  const canRegister = isPasswordValid && passwordsMatch && 
    registerForm.username.length >= 3 && 
    emailValid && 
    registerForm.name.length > 0;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!emailValid) {
      setError(t('auth.errors.pleaseEnterValidEmail'));
      return;
    }

    if (!isPasswordValid) {
      setError(t('auth.errors.passwordRequirements'));
      return;
    }

    if (!passwordsMatch) {
      setError(t('errors.passwordMismatch'));
      return;
    }

    setIsLoading(true);

    try {
      await register(registerForm.username, registerForm.email, registerForm.name, registerForm.password);
      clearPendingRedirect();
      navigate(redirectUrl);
    } catch (err: any) {
      const rawError = err?.message || t('auth.registerError');
      setError(parseErrorMessage(rawError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeycloakLogin = () => {
    window.location.href = redirectUrl === '/' 
      ? '/api/v1/auth/keycloak'
      : `/api/v1/auth/keycloak?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Poll<span className="text-polly-orange">y</span></CardTitle>
          <CardDescription>
            {t('auth.loginDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="polly-alert-error rounded-lg p-4 flex items-start gap-3 mb-4">
              <AlertCircle className="polly-alert-icon h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {authMethods.showLoginForm !== false && authMethods.registrationEnabled ? (
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" data-testid="tab-login">
                  <LogIn className="h-4 w-4 mr-2" />
                  {t('auth.login')}
                </TabsTrigger>
                <TabsTrigger value="register" data-testid="tab-register">
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('auth.register')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">{t('auth.usernameOrEmail')}</Label>
                    <Input
                      id="login-username"
                      type="text"
                      value={loginForm.usernameOrEmail}
                      onChange={(e) => setLoginForm({ ...loginForm, usernameOrEmail: e.target.value })}
                      placeholder={t('auth.placeholders.email')}
                      required
                      data-testid="input-login-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">{t('auth.password')}</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showLoginPassword ? "text" : "password"}
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        placeholder="••••••••"
                        required
                        autoComplete="off"
                        className="pr-10"
                        data-testid="input-login-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                        aria-label={showLoginPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login-submit">
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                    {t('auth.login')}
                  </Button>
                  <div className="text-center mt-3">
                    <a 
                      href="/passwort-vergessen" 
                      className="text-sm text-muted-foreground hover:text-primary hover:underline"
                      data-testid="link-forgot-password"
                    >
                      {t('auth.forgotPassword')}
                    </a>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">{t('auth.fullName')}</Label>
                    <Input
                      id="register-name"
                      type="text"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      placeholder={t('auth.placeholders.name')}
                      required
                      data-testid="input-register-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-username">{t('auth.username')}</Label>
                    <Input
                      id="register-username"
                      type="text"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                      placeholder={t('auth.placeholders.username')}
                      required
                      minLength={3}
                      data-testid="input-register-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">{t('auth.emailAddress')}</Label>
                    <Input
                      id="register-email"
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      placeholder={t('auth.placeholders.email')}
                      required
                      data-testid="input-register-email"
                      className={registerForm.email.length > 0 && !emailValid ? "border-red-500" : ""}
                    />
                    {registerForm.email.length > 0 && !emailValid && (
                      <p className="text-sm text-red-500" data-testid="email-validation-error">
                        {t('auth.errors.pleaseEnterValidEmail')}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">{t('auth.password')}</Label>
                    <div className="relative">
                      <Input
                        id="register-password"
                        type={showRegisterPassword ? "text" : "password"}
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                        placeholder={t('auth.enterSecurePassword')}
                        required
                        autoComplete="off"
                        className="pr-10"
                        data-testid="input-register-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                        aria-label={showRegisterPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                      >
                        {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm">{t('auth.confirmPassword')}</Label>
                    <div className="relative">
                      <Input
                        id="register-confirm"
                        type={showRegisterConfirmPassword ? "text" : "password"}
                        value={registerForm.confirmPassword}
                        onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                        placeholder={t('auth.repeatPassword')}
                        required
                        autoComplete="off"
                        className="pr-10"
                        data-testid="input-register-confirm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterConfirmPassword(!showRegisterConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                        aria-label={showRegisterConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                      >
                        {showRegisterConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
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
                    {t('auth.register')}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          ) : authMethods.showLoginForm !== false ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-username">{t('auth.usernameOrEmail')}</Label>
                <Input
                  id="login-username"
                  type="text"
                  value={loginForm.usernameOrEmail}
                  onChange={(e) => setLoginForm({ ...loginForm, usernameOrEmail: e.target.value })}
                  placeholder={t('auth.placeholders.email')}
                  required
                  data-testid="input-login-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">{t('auth.password')}</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showLoginPassword ? "text" : "password"}
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    autoComplete="off"
                    className="pr-10"
                    data-testid="input-login-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showLoginPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login-submit">
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                {t('auth.login')}
              </Button>
              <div className="text-center mt-3">
                <a 
                  href="/passwort-vergessen" 
                  className="text-sm text-muted-foreground hover:text-primary hover:underline"
                  data-testid="link-forgot-password"
                >
                  {t('auth.forgotPassword')}
                </a>
              </div>
            </form>
          ) : null}

          {authMethods.keycloak && (
            <>
              {authMethods.showLoginForm !== false && (
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">{t('common.or')}</span>
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleKeycloakLogin}
                data-testid="button-keycloak-login"
              >
                <KeyRound className="h-4 w-4 mr-2" />
                {authMethods.ssoButtonLabel || t('auth.loginWithKeycloak')}
              </Button>
            </>
          )}
        </CardContent>
        <CardFooter className="text-center text-sm text-muted-foreground">
          <p className="w-full">
            {t('auth.noLoginRequired')}{' '}
            <a href="/" className="text-primary underline hover:no-underline" data-testid="link-home">
              {t('nav.home')}
            </a>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
