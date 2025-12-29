import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function ConfirmEmail() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/email-bestaetigen/:token");
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>("");

  const token = params?.token;

  const parseErrorMessage = (error: any): string => {
    if (!error?.message) return t('confirmEmail.unknownError');
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

  const confirmEmailMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await apiRequest('POST', '/api/v1/auth/confirm-email-change', { token });
      return response.json();
    },
    onSuccess: () => {
      setStatus('success');
      queryClient.invalidateQueries({ queryKey: ['/api/v1/user/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/auth/me'] });
    },
    onError: (error: any) => {
      setStatus('error');
      setErrorMessage(parseErrorMessage(error));
    },
  });

  useEffect(() => {
    if (token) {
      confirmEmailMutation.mutate(token);
    } else {
      setStatus('error');
      setErrorMessage(t('confirmEmail.invalidLink'));
    }
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Loader2 className="w-16 h-16 text-primary mx-auto animate-spin" />
              <h2 className="text-2xl font-bold">{t('confirmEmail.confirming')}</h2>
              <p className="text-muted-foreground">
                {t('confirmEmail.pleaseWait')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
              <h2 className="text-2xl font-bold">{t('confirmEmail.confirmationFailed')}</h2>
              <p className="text-muted-foreground">{errorMessage}</p>
              <Button 
                className="w-full" 
                onClick={() => setLocation("/profil")}
                data-testid="button-back-to-profile"
              >
                {t('confirmEmail.backToProfile')}
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
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">{t('confirmEmail.emailChanged')}</h2>
            <p className="text-muted-foreground">
              {t('confirmEmail.emailUpdated')}
            </p>
            <Button 
              className="w-full polly-button-primary" 
              onClick={() => setLocation("/profil")}
              data-testid="button-back-to-profile"
            >
              {t('confirmEmail.backToProfile')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
