import { lazy, Suspense, useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CustomizationProvider } from "@/contexts/CustomizationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Layout from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";

const CreatePoll = lazy(() => import("@/pages/create-poll"));
const CreateSurvey = lazy(() => import("@/pages/create-survey"));
const CreateOrganization = lazy(() => import("@/pages/create-organization"));
const Poll = lazy(() => import("@/pages/poll"));
const PollSuccess = lazy(() => import("@/pages/poll-success"));
const VoteSuccess = lazy(() => import("@/pages/vote-success"));
const VoteEdit = lazy(() => import("@/pages/vote-edit"));
const Admin = lazy(() => import("@/pages/admin"));
const Login = lazy(() => import("@/pages/login"));
const MyPolls = lazy(() => import("@/pages/my-polls"));
const Profile = lazy(() => import("@/pages/profile"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const ConfirmEmail = lazy(() => import("@/pages/confirm-email"));

function PageLoader() {
  return (
    <div className="container mx-auto py-8 px-4">
      <Skeleton className="h-8 w-64 mb-4" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/create-poll" component={CreatePoll} />
        <Route path="/create-survey" component={CreateSurvey} />
        <Route path="/create-organization" component={CreateOrganization} />
        <Route path="/poll/:token" component={Poll} />
        <Route path="/admin/:token" component={Poll} />
        <Route path="/success" component={PollSuccess} />
        <Route path="/vote-success" component={VoteSuccess} />
        <Route path="/edit/:editToken" component={VoteEdit} />
        <Route path="/admin" component={Admin} />
        <Route path="/anmelden" component={Login} />
        <Route path="/meine-umfragen" component={MyPolls} />
        <Route path="/profil" component={Profile} />
        <Route path="/passwort-vergessen" component={ForgotPassword} />
        <Route path="/passwort-zuruecksetzen/:token" component={ResetPassword} />
        <Route path="/email-bestaetigen/:token" component={ConfirmEmail} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function ForcePasswordChangeGuard({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user?.isInitialAdmin) return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError(t('forcePassword.passwordsMismatch'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('forcePassword.passwordTooShort'));
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/v1/auth/change-password', { currentPassword, newPassword });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t('forcePassword.error'));
        return;
      }
      qc.invalidateQueries({ queryKey: ['/api/v1/auth/me'] });
    } catch {
      setError(t('forcePassword.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {children}
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md [&>button:last-child]:hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              <DialogTitle>{t('forcePassword.title')}</DialogTitle>
            </div>
            <DialogDescription>
              {t('forcePassword.description')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="force-current">{t('forcePassword.currentPassword')}</Label>
              <Input id="force-current" type="password" autoComplete="off" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="force-new">{t('forcePassword.newPassword')}</Label>
              <Input id="force-new" type="password" autoComplete="off" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="force-confirm">{t('forcePassword.confirmPassword')}</Label>
              <Input id="force-confirm" type="password" autoComplete="off" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => logout()}>{t('forcePassword.logout')}</Button>
              <Button type="submit" disabled={loading}>{loading ? t('forcePassword.changing') : t('forcePassword.submit')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomizationProvider>
        <AuthProvider>
          <ThemeProvider>
            <TooltipProvider>
              <ForcePasswordChangeGuard>
                <Layout>
                  <Toaster />
                  <Router />
                </Layout>
              </ForcePasswordChangeGuard>
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
      </CustomizationProvider>
    </QueryClientProvider>
  );
}

export default App;
