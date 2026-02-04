import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CustomizationProvider } from "@/contexts/CustomizationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Layout from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";

const CreatePoll = lazy(() => import("@/pages/create-poll"));
const CreateSurvey = lazy(() => import("@/pages/create-survey"));
const CreateOrganization = lazy(() => import("@/pages/create-organization"));
const Poll = lazy(() => import("@/pages/poll"));
const PollSuccess = lazy(() => import("@/pages/poll-success"));
const VoteSuccess = lazy(() => import("@/pages/vote-success"));
const VoteEdit = lazy(() => import("@/pages/vote-edit"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
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
        <Route path="/dashboard" component={Dashboard} />
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomizationProvider>
        <AuthProvider>
          <ThemeProvider>
            <TooltipProvider>
              <Layout>
                <Toaster />
                <Router />
              </Layout>
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
      </CustomizationProvider>
    </QueryClientProvider>
  );
}

export default App;
