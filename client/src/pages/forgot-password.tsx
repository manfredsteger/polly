import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const parseErrorMessage = (error: any): string => {
    if (!error?.message) return t('forgotPassword.unknownError');
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

  const requestResetMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest('POST', '/api/v1/auth/request-password-reset', { email });
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
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
    if (!email) {
      toast({
        title: t('common.error'),
        description: t('forgotPassword.enterEmail'),
        variant: "destructive",
      });
      return;
    }
    requestResetMutation.mutate(email);
  };

  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold">{t('forgotPassword.emailSent')}</h2>
              <p className="text-muted-foreground">
                {t('forgotPassword.emailSentDescription')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('forgotPassword.checkSpam')}
              </p>
              <Button 
                className="w-full" 
                onClick={() => setLocation("/anmelden")}
                data-testid="button-back-to-login"
              >
                {t('forgotPassword.backToLogin')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => setLocation("/anmelden")}
          className="gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('forgotPassword.backToLogin')}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {t('auth.forgotPassword')}
            </CardTitle>
            <CardDescription>
              {t('forgotPassword.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">{t('auth.emailAddress')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('forgotPassword.emailPlaceholder')}
                  className="mt-1"
                  data-testid="input-email"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full polly-button-primary"
                disabled={requestResetMutation.isPending}
                data-testid="button-submit"
              >
                {requestResetMutation.isPending ? t('forgotPassword.sending') : t('forgotPassword.sendResetLink')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
