import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Mail,
  ArrowLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Info,
  AlertTriangle,
  Loader2
} from "lucide-react";

interface SmtpConfig {
  configured: boolean;
  host: string;
  port: number;
  user: string;
  hasPassword: boolean;
  secure: boolean;
  fromEmail: string;
  fromName: string;
}

export function EmailSettingsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);

  const { data: config, isLoading, isError } = useQuery<SmtpConfig>({
    queryKey: ['/api/v1/smtp-config'],
  });

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await apiRequest('POST', '/api/v1/smtp-test');
      const result = await res.json();
      if (result.success) {
        toast({ title: t('admin.emailSettings.testEmail'), description: t('admin.emailSettings.testSuccess') });
      } else {
        toast({ title: t('admin.emailSettings.testFailed'), description: result.error || t('admin.emailSettings.testError'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('admin.emailSettings.testFailed'), description: t('admin.emailSettings.testError'), variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('admin.emailSettings.backToSettings')}
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">{t('admin.emailSettings.emailSending')}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.emailSettings.emailConfig')}</h2>
          <p className="text-muted-foreground">{t('admin.emailSettings.smtpDescription')}</p>
        </div>
        {isLoading ? (
          <Skeleton className="h-6 w-16" />
        ) : config?.configured ? (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            {t('admin.emailSettings.active')}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
            <XCircle className="w-3 h-3 mr-1" />
            {t('admin.emailSettings.inactive')}
          </Badge>
        )}
      </div>

      {!isLoading && isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t('admin.emailSettings.testError')}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && !config?.configured && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t('admin.emailSettings.notConfigured')}</AlertDescription>
        </Alert>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>{t('admin.emailSettings.envHint')}</AlertDescription>
      </Alert>

      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="w-5 h-5 mr-2" />
            {t('admin.emailSettings.smtpSettings')}
          </CardTitle>
          <CardDescription>{t('admin.emailSettings.smtpSettingsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtp-host">{t('admin.emailSettings.smtpHost')}</Label>
                  <Input id="smtp-host" value={config?.host || ''} readOnly className="bg-muted" data-testid="input-smtp-host" />
                </div>
                <div>
                  <Label htmlFor="smtp-port">{t('admin.emailSettings.port')}</Label>
                  <Input id="smtp-port" value={config?.port || ''} readOnly className="bg-muted" data-testid="input-smtp-port" />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtp-user">{t('admin.emailSettings.username')}</Label>
                  <Input id="smtp-user" value={config?.user || ''} readOnly className="bg-muted" data-testid="input-smtp-user" />
                </div>
                <div>
                  <Label htmlFor="smtp-pass">{t('admin.emailSettings.password')}</Label>
                  <Input id="smtp-pass" type="password" value={config?.hasPassword ? '••••••••' : ''} readOnly className="bg-muted" data-testid="input-smtp-pass" />
                </div>
              </div>
              
              <div>
                <Label htmlFor="from-email">{t('admin.emailSettings.senderEmail')}</Label>
                <Input id="from-email" value={config?.fromEmail || ''} readOnly className="bg-muted" data-testid="input-from-email" />
              </div>

              <div>
                <Label htmlFor="from-name">{t('admin.emailSettings.senderName')}</Label>
                <Input id="from-name" value={config?.fromName || ''} readOnly className="bg-muted" data-testid="input-from-name" />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Switch id="smtp-tls" checked={config?.secure ?? false} disabled data-testid="switch-smtp-tls" />
                <Label htmlFor="smtp-tls">{t('admin.emailSettings.useTls')}</Label>
              </div>

              {config?.configured && (
                <div className="flex justify-end pt-4">
                  <Button 
                    variant="outline" 
                    data-testid="button-test-email"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('admin.emailSettings.testing')}
                      </>
                    ) : (
                      t('admin.emailSettings.testEmail')
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
