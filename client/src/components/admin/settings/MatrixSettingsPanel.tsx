import { useTranslation } from 'react-i18next';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare,
  ArrowLeft,
  ChevronRight,
  Clock,
  Users,
  Bell,
  Bot,
  BarChart3
} from "lucide-react";

export function MatrixSettingsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();

  const features = [
    { icon: Bot, labelKey: 'admin.matrix.comingSoon.feature1' },
    { icon: Users, labelKey: 'admin.matrix.comingSoon.feature2' },
    { icon: Bell, labelKey: 'admin.matrix.comingSoon.feature3' },
    { icon: BarChart3, labelKey: 'admin.matrix.comingSoon.feature4' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('admin.matrix.backToSettings')}
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">{t('admin.matrix.title')}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.matrix.title')}</h2>
          <p className="text-muted-foreground">{t('admin.matrix.description')}</p>
        </div>
        <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-400 dark:border-amber-600">
          <Clock className="w-3 h-3 mr-1" />
          {t('admin.matrix.comingSoon.badge')}
        </Badge>
      </div>

      <Card className="polly-card overflow-hidden">
        <CardContent className="p-0">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 dark:from-purple-500/10 dark:to-blue-500/10" />

            <div className="relative px-8 py-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/40 dark:to-blue-900/40 mb-6">
                <MessageSquare className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>

              <h3 className="text-xl font-semibold text-foreground mb-3">
                {t('admin.matrix.comingSoon.title')}
              </h3>

              <p className="text-muted-foreground max-w-md mx-auto leading-relaxed mb-8">
                {t('admin.matrix.comingSoon.description')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto mb-8">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 dark:bg-muted/30 text-left"
                  >
                    <feature.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground">{t(feature.labelKey)}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                {t('admin.matrix.comingSoon.timeline')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
