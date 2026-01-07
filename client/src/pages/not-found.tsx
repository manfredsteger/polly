import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-lg mx-4 border-border">
        <CardContent className="pt-8 pb-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-destructive/10 dark:bg-destructive/20 flex items-center justify-center">
                <AlertCircle className="h-10 w-10 text-destructive" />
              </div>
            </div>
            
            <h1 className="text-6xl font-bold text-foreground mb-2">404</h1>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t('notFound.title', 'Seite nicht gefunden')}
            </h2>

            <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
              {t('notFound.description', 'Die gesuchte Seite existiert nicht oder wurde verschoben.')}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="gap-2"
                data-testid="button-go-back"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('notFound.goBack', 'Zurück')}
              </Button>
              <Button asChild className="gap-2 polly-button-primary w-full sm:w-auto" data-testid="button-go-home">
                <Link href="/">
                  <Home className="h-4 w-4" />
                  {t('notFound.goHome', 'Zur Startseite')}
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
