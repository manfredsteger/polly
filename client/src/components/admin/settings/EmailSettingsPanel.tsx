import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  Mail,
  ArrowLeft,
  ChevronRight,
  CheckCircle
} from "lucide-react";

export function EmailSettingsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  
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
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          {t('admin.emailSettings.active')}
        </Badge>
      </div>

      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="w-5 h-5 mr-2" />
            {t('admin.emailSettings.smtpSettings')}
          </CardTitle>
          <CardDescription>{t('admin.emailSettings.smtpSettingsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="smtp-host">{t('admin.emailSettings.smtpHost')}</Label>
              <Input id="smtp-host" placeholder="smtp.example.com" data-testid="input-smtp-host" />
            </div>
            <div>
              <Label htmlFor="smtp-port">{t('admin.emailSettings.port')}</Label>
              <Input id="smtp-port" placeholder="587" data-testid="input-smtp-port" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="smtp-user">{t('admin.emailSettings.username')}</Label>
              <Input id="smtp-user" placeholder="user@example.com" data-testid="input-smtp-user" />
            </div>
            <div>
              <Label htmlFor="smtp-pass">{t('admin.emailSettings.password')}</Label>
              <Input id="smtp-pass" type="password" placeholder="••••••••" data-testid="input-smtp-pass" />
            </div>
          </div>
          
          <div>
            <Label htmlFor="from-email">{t('admin.emailSettings.senderEmail')}</Label>
            <Input id="from-email" placeholder="noreply@polly-poll.bayern.de" data-testid="input-from-email" />
          </div>

          <div>
            <Label htmlFor="from-name">{t('admin.emailSettings.senderName')}</Label>
            <Input id="from-name" placeholder="Polly System" data-testid="input-from-name" />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Switch id="smtp-tls" defaultChecked data-testid="switch-smtp-tls" />
            <Label htmlFor="smtp-tls">{t('admin.emailSettings.useTls')}</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" data-testid="button-test-email">
              {t('admin.emailSettings.testEmail')}
            </Button>
            <Button 
              className="polly-button-primary" 
              data-testid="button-save-email"
              onClick={() => toast({ title: t('admin.emailSettings.saved'), description: t('admin.emailSettings.emailSaved') })}
            >
              {t('admin.emailSettings.saveSettings')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
