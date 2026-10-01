import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Key, CheckCircle, AlertCircle } from "lucide-react";
import { PasswordStrengthIndicator, usePasswordPolicy, validatePasswordWithPolicy } from '@/components/PasswordStrengthIndicator';

export default function ResetPassword() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/passwort-zuruecksetzen/:token");
  const { toast } = useToast();
  const { logout } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = params?.token;
  const { data: passwordPolicy } = usePasswordPolicy();

  useEffect(() => {
    if (!token) {
      setError(t('resetPassword.invalidToken'));
    }
  }, [token, t]);

  const parseErrorMessage = (error: any): string => {
    if (!error?.message) return t('resetPassword.unknownError');
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

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { token: string; newPassword: string }) => {
      const response = await apiRequest('POST', '/api/v1/auth/reset-password', data);
      return response.json();
    },
    onSuccess: async () => {
      try {
        await logout();
      } catch (logoutError) {
        console.warn('Logout after password reset failed:', logoutError);
      }
      setCompleted(true);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: parseErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: t('common.error'),
        description: t('resetPassword.passwordsDontMatch'),
        variant: "destructive",
      });
      return;
    }

    if (!validatePasswordWithPolicy(newPassword, passwordPolicy)) {
      toast({
        title: t('common.error'),
        description: t('resetPassword.requirementsNotMet'),
        variant: "destructive",
      });
      return;
    }

    if (!token) {
      toast({
        title: t('common.error'),
        description: t('resetPassword.invalidToken'),
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({ token, newPassword });
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
              <h2 className="text-2xl font-bold">{t('resetPassword.invalidLink')}</h2>
              <p className="text-muted-foreground">{error}</p>
              <Button 
                className="w-full" 
                onClick={() => setLocation("/passwort-vergessen")}
                data-testid="button-request-new"
              >
                {t('resetPassword.requestNewLink')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold">{t('resetPassword.passwordChanged')}</h2>
              <p className="text-muted-foreground">
                {t('resetPassword.passwordResetSuccess')}
              </p>
              <Button 
                className="w-full polly-button-primary" 
                onClick={() => setLocation("/anmelden")}
                data-testid="button-login"
              >
                {t('resetPassword.goToLogin')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            {t('resetPassword.setNewPassword')}
          </CardTitle>
          <CardDescription>
            {t('resetPassword.setNewPasswordDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="newPassword">{t('resetPassword.newPassword')}</Label>
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
              <Label htmlFor="confirmPassword">{t('resetPassword.confirmPassword')}</Label>
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
            <Button 
              type="submit" 
              className="w-full polly-button-primary"
              disabled={resetPasswordMutation.isPending || !validatePasswordWithPolicy(newPassword, passwordPolicy) || newPassword !== confirmPassword}
              data-testid="button-submit"
            >
              {resetPasswordMutation.isPending ? t('resetPassword.saving') : t('resetPassword.savePassword')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
