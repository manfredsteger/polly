import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CustomizationProvider } from "@/contexts/CustomizationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Layout from "@/components/Layout";
import Home from "@/pages/home";
import CreatePoll from "@/pages/create-poll";
import CreateSurvey from "@/pages/create-survey";
import CreateOrganization from "@/pages/create-organization";
import Poll from "@/pages/poll";
import PollSuccess from "@/pages/poll-success";
import VoteSuccess from "@/pages/vote-success";
import VoteEdit from "@/pages/vote-edit";
import Dashboard from "@/pages/dashboard";
import Admin from "@/pages/admin";
import Login from "@/pages/login";
import MyPolls from "@/pages/my-polls";
import Profile from "@/pages/profile";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import ConfirmEmail from "@/pages/confirm-email";
import NotFound from "@/pages/not-found";

function Router() {
  return (
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
