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

  const [verifiedType, setVerifiedType] = useState<'registration' | 'email-change' | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setStatus('error');
        setErrorMessage(t('confirmEmail.invalidLink'));
        return;
      }

      try {
        // First try registration verification (GET endpoint)
        const verifyResponse = await fetch(`/api/v1/auth/verify-email/${token}`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        
        if (verifyResponse.ok) {
          setVerifiedType('registration');
          setStatus('success');
          queryClient.invalidateQueries({ queryKey: ['/api/v1/auth/me'] });
          queryClient.invalidateQueries({ queryKey: ['/api/v1/user/profile'] });
          return;
        }

        // Parse error from registration verification
        let verifyError: string | null = null;
        try {
          const verifyErrorData = await verifyResponse.json();
          verifyError = verifyErrorData.error;
        } catch {
          // Ignore JSON parse errors
        }

        // Only try email change if registration verification returned 400 (invalid/expired token)
        // Don't fall back on network errors or server errors
        if (verifyResponse.status === 400) {
          const changeResponse = await apiRequest('POST', '/api/v1/auth/confirm-email-change', { token });
          if (changeResponse.ok) {
            setVerifiedType('email-change');
            setStatus('success');
            queryClient.invalidateQueries({ queryKey: ['/api/v1/user/profile'] });
            queryClient.invalidateQueries({ queryKey: ['/api/v1/auth/me'] });
            return;
          }

          // Both failed - show error from email change endpoint
          const errorData = await changeResponse.json().catch(() => ({}));
          setStatus('error');
          setErrorMessage(errorData.error || verifyError || t('confirmEmail.unknownError'));
        } else {
          // Server error or other issue - show registration verification error
          setStatus('error');
          setErrorMessage(verifyError || t('confirmEmail.unknownError'));
        }
      } catch (error: any) {
        setStatus('error');
        setErrorMessage(parseErrorMessage(error));
      }
    };

    verifyToken();
  }, [token, t]);

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
            <h2 className="text-2xl font-bold">
              {verifiedType === 'registration' 
                ? t('confirmEmail.emailVerified') 
                : t('confirmEmail.emailChanged')}
            </h2>
            <p className="text-muted-foreground">
              {verifiedType === 'registration'
                ? t('confirmEmail.emailVerifiedMessage')
                : t('confirmEmail.emailUpdated')}
            </p>
            <Button 
              className="w-full polly-button-primary" 
              onClick={() => setLocation(verifiedType === 'registration' ? "/" : "/profil")}
              data-testid="button-back-to-profile"
            >
              {verifiedType === 'registration'
                ? t('confirmEmail.goToHome')
                : t('confirmEmail.backToProfile')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
