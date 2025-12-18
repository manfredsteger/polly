import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Mail, Calendar, Vote, ExternalLink, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PollSuccess() {
  const [location] = useLocation();
  const { toast } = useToast();
  const [pollData, setPollData] = useState<any>(null);

  useEffect(() => {
    // Scroll to top when page loads
    window.scrollTo(0, 0);
    
    // Get poll data from session storage (set during creation)
    const storedData = sessionStorage.getItem('poll-success-data');
    if (storedData) {
      setPollData(JSON.parse(storedData));
      // Clear it after using
      sessionStorage.removeItem('poll-success-data');
    }
  }, []);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Link kopiert!",
        description: `${label} wurde in die Zwischenablage kopiert.`,
      });
    } catch (err) {
      toast({
        title: "Fehler",
        description: "Link konnte nicht kopiert werden.",
        variant: "destructive",
      });
    }
  };

  if (!pollData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Keine Daten gefunden</CardTitle>
            <CardDescription>
              Es wurden keine Umfragedaten gefunden. Bitte erstellen Sie eine neue Umfrage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">Zur Startseite</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { poll, publicLink, adminLink, pollType } = pollData;
  const pollTypeText = pollType === 'schedule' ? 'Terminumfrage' : 'Umfrage';
  const fullPublicLink = `${window.location.origin}${publicLink}`;
  const fullAdminLink = `${window.location.origin}${adminLink}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {pollTypeText} erfolgreich erstellt!
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Ihre {pollTypeText} "{poll.title}" wurde erfolgreich erstellt und ist bereit für Teilnehmer.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Public Link Card */}
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20" data-testid="card-public-link">
            <CardHeader>
              <CardTitle className="flex items-center text-blue-700 dark:text-blue-300">
                {pollType === 'schedule' ? (
                  <Calendar className="w-5 h-5 mr-2" />
                ) : (
                  <Vote className="w-5 h-5 mr-2" />
                )}
                Öffentlicher Link
              </CardTitle>
              <CardDescription>
                Teilen Sie diesen Link mit allen Teilnehmern
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 mb-4">
                <p className="text-sm font-mono break-all text-gray-700 dark:text-gray-300">
                  {fullPublicLink}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => copyToClipboard(fullPublicLink, 'Öffentlicher Link')}
                  className="flex-1"
                  variant="outline"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Kopieren
                </Button>
                <Button
                  onClick={() => window.open(fullPublicLink, '_blank')}
                  variant="outline"
                  size="icon"
                  data-testid="button-open-public-link"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Admin Link Card */}
          <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/20" data-testid="card-admin-link">
            <CardHeader>
              <CardTitle className="flex items-center text-orange-700 dark:text-orange-300">
                <Mail className="w-5 h-5 mr-2" />
                Administratorlink
              </CardTitle>
              <CardDescription>
                Nur für Sie - zum Verwalten und Bearbeiten
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 mb-4">
                <p className="text-sm font-mono break-all text-gray-700 dark:text-gray-300">
                  {fullAdminLink}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => copyToClipboard(fullAdminLink, 'Administratorlink')}
                  className="flex-1"
                  variant="outline"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Kopieren
                </Button>
                <Button
                  onClick={() => window.open(fullAdminLink, '_blank')}
                  variant="outline"
                  size="icon"
                  data-testid="button-open-admin-link"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Email Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="w-5 h-5 mr-2" />
              E-Mail Benachrichtigung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-800 dark:text-yellow-200">
                <strong>Hinweis:</strong> Eine E-Mail mit beiden Links wird an <strong>{poll.creatorEmail}</strong> gesendet.
                Falls Sie keine E-Mail erhalten, speichern Sie diese Links bitte ab.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Nächste Schritte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-medium text-foreground">Link teilen</p>
                  <p className="text-sm text-muted-foreground">
                    Senden Sie den öffentlichen Link an alle Teilnehmer per E-Mail, WhatsApp oder anderen Kommunikationswegen.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-medium text-foreground">Ergebnisse verfolgen</p>
                  <p className="text-sm text-muted-foreground">
                    Nutzen Sie den Administratorlink, um die Abstimmungsergebnisse in Echtzeit zu verfolgen.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-medium text-foreground">Administratorlink sicher aufbewahren</p>
                  <p className="text-sm text-muted-foreground">
                    Speichern Sie den Administratorlink sicher ab - nur damit können Sie Ihre Umfrage verwalten.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8 justify-center">
          <Link href="/">
            <Button variant="outline" className="w-full sm:w-auto">
              Neue Umfrage erstellen
            </Button>
          </Link>
          <Button
            onClick={() => window.open(fullPublicLink, '_blank')}
            className="w-full sm:w-auto kita-button-primary"
          >
            Zur Abstimmung
          </Button>
        </div>
      </div>
    </div>
  );
}