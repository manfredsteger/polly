import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Database,
  Lock,
  ArrowLeft,
  ChevronRight,
  CheckCircle
} from "lucide-react";

export function DatabaseSettingsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('admin.database.backToSettings')}
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">{t('admin.database.postgresDatabase')}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.database.databaseConfig')}</h2>
          <p className="text-muted-foreground">{t('admin.database.databaseProvider')}</p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          {t('admin.database.connected')}
        </Badge>
      </div>

      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="w-5 h-5 mr-2" />
            {t('admin.database.connectionStatus')}
          </CardTitle>
          <CardDescription>{t('admin.database.connectionStatusDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">{t('admin.database.host')}</p>
              <p className="font-mono text-sm">Neon PostgreSQL</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">{t('admin.database.status')}</p>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm">{t('admin.database.activeStatus')}</span>
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">{t('admin.database.orm')}</p>
              <p className="font-mono text-sm">Drizzle ORM</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">{t('admin.database.ssl')}</p>
              <p className="text-sm flex items-center">
                <Lock className="w-3 h-3 mr-1 text-green-600" />
                {t('admin.database.encrypted')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertBanner variant="warning" data-testid="alert-database-info">
        <div>
          <p className="font-medium">{t('admin.database.note')}</p>
          <p className="text-sm opacity-90">
            {t('admin.database.databaseNote')}
          </p>
        </div>
      </AlertBanner>
    </div>
  );
}
