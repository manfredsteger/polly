import { useState, useEffect, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Key, CheckCircle, AlertCircle, Check, X } from "lucide-react";

interface PasswordRequirement {
  label: string;
  met: boolean;
}

function PasswordStrengthIndicator({ password, confirmPassword }: { password: string; confirmPassword: string }) {
  const { t } = useTranslation();
  const requirements: PasswordRequirement[] = useMemo(() => [
    { label: t('resetPassword.minChars'), met: password.length >= 8 },
    { label: t('resetPassword.uppercase'), met: /[A-Z]/.test(password) },
    { label: t('resetPassword.lowercase'), met: /[a-z]/.test(password) },
    { label: t('resetPassword.number'), met: /[0-9]/.test(password) },
    { label: t('resetPassword.specialChar'), met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) },
  ], [password, t]);

  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const allRequirementsMet = requirements.every(r => r.met);
  
  const strengthPercentage = (requirements.filter(r => r.met).length / requirements.length) * 100;
  
  const getStrengthColor = () => {
    if (strengthPercentage < 40) return 'bg-red-500';
    if (strengthPercentage < 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthLabel = () => {
    if (strengthPercentage < 40) return t('resetPassword.weak');
    if (strengthPercentage < 80) return t('resetPassword.medium');
    return t('resetPassword.strong');
  };

  if (password.length === 0) return null;

  return (
    <div className="space-y-3 mt-2 p-3 bg-muted/50 rounded-lg border" data-testid="password-strength-indicator">
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{t('resetPassword.passwordStrength')}</span>
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
      </div>
      
      {confirmPassword.length > 0 && (
        <div className={`flex items-center gap-2 text-xs pt-2 border-t ${passwordsMatch ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
          {passwordsMatch ? (
            <Check className="h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <X className="h-3.5 w-3.5 flex-shrink-0" />
          )}
          <span>{passwordsMatch ? t('resetPassword.passwordsMatch') : t('resetPassword.passwordsDontMatch')}</span>
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

export default function ResetPassword() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/passwort-zuruecksetzen/:token");
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = params?.token;

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
    onSuccess: () => {
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

    if (!validatePassword(newPassword)) {
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
              disabled={resetPasswordMutation.isPending || !validatePassword(newPassword) || newPassword !== confirmPassword}
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
