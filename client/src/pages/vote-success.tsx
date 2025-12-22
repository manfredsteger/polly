import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, BarChart3, Edit, ExternalLink, ArrowLeft, Copy, Link as LinkIcon, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function VoteSuccess() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [voteData, setVoteData] = useState<any>(null);

  useEffect(() => {
    // Scroll to top when page loads
    window.scrollTo(0, 0);
    
    // Get vote data from session storage (set after voting)
    const storedData = sessionStorage.getItem('vote-success-data');
    if (storedData) {
      setVoteData(JSON.parse(storedData));
      // Clear it after using
      sessionStorage.removeItem('vote-success-data');
    }
  }, []);

  if (!voteData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Keine Daten gefunden</CardTitle>
            <CardDescription>
              Es wurden keine Abstimmungsdaten gefunden.
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

  const { poll, pollType, publicToken, voterName, voterEditToken } = voteData;
  const pollTypeText = pollType === 'schedule' ? 'Terminumfrage' : 'Umfrage';
  const publicLink = `${window.location.origin}/poll/${publicToken}`;
  const resultsLink = `${window.location.origin}/poll/${publicToken}#results`;
  const editLink = voterEditToken ? `${window.location.origin}/edit/${voterEditToken}` : null;

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Erfolgreich kopiert!",
        description: successMessage,
      });
    } catch (err) {
      toast({
        title: "Fehler",
        description: "Text konnte nicht kopiert werden.",
        variant: "destructive",
      });
    }
  };

  const withdrawVoteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/v1/polls/${publicToken}/vote`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Stimme zurückgezogen",
        description: "Ihre Stimme wurde erfolgreich entfernt.",
      });
      navigate(`/poll/${publicToken}`);
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Ihre Stimme konnte nicht zurückgezogen werden.",
        variant: "destructive",
      });
    },
  });

  const canWithdraw = voteData?.allowVoteWithdrawal;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-2xl mx-auto py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Vielen Dank für Ihre Stimme!
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Ihre Antwort für "{poll.title}" wurde erfolgreich gespeichert.
          </p>
        </div>

        {/* Voter Info */}
        {voterName && (
          <Card className="mb-6 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <p className="text-blue-700 dark:text-blue-300 font-medium">
                  Abgestimmt als: <strong>{voterName}</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Was passiert als Nächstes?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-medium text-foreground">Ergebnisse verfolgen</p>
                  <p className="text-sm text-muted-foreground">
                    Sie können die aktuellen Abstimmungsergebnisse jederzeit einsehen und verfolgen, wie andere abstimmen.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-medium text-foreground">Stimme ändern</p>
                  <p className="text-sm text-muted-foreground">
                    Falls Sie Ihre Meinung ändern, können Sie Ihre Stimme jederzeit über den gleichen Link anpassen.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-medium text-foreground">Andere einladen</p>
                  <p className="text-sm text-muted-foreground">
                    Teilen Sie den Link mit weiteren Personen, die an dieser {pollTypeText} teilnehmen sollen.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
          <Button
            onClick={() => window.open(resultsLink, '_blank')}
            className="flex items-center justify-center kita-button-primary"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Ergebnisse ansehen
          </Button>
          
          {editLink && (
            <Button
              onClick={() => window.open(editLink, '_blank')}
              variant="outline"
              className="flex items-center justify-center kita-button-neutral"
            >
              <Edit className="w-4 h-4 mr-2" />
              Stimme bearbeiten
            </Button>
          )}
          
          {canWithdraw && (
            <Button
              onClick={() => withdrawVoteMutation.mutate()}
              disabled={withdrawVoteMutation.isPending}
              className="flex items-center justify-center kita-button-danger"
              data-testid="button-withdraw-vote"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {withdrawVoteMutation.isPending ? 'Wird entfernt...' : 'Stimme zurückziehen'}
            </Button>
          )}
        </div>

        {/* Survey Links Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <LinkIcon className="w-5 h-5 mr-2" />
              Links zur Umfrage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Umfrage ansehen
              </label>
              <div className="flex items-center space-x-2 mt-1">
                <Input
                  value={publicLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(publicLink, 'Link kopiert!')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Ergebnisse ansehen
              </label>
              <div className="flex items-center space-x-2 mt-1">
                <Input
                  value={resultsLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(resultsLink, 'Ergebnis-Link kopiert!')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {editLink && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Stimme bearbeiten (Nur für Sie)
                </label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    value={editLink}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(editLink, 'Bearbeitungs-Link kopiert!')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-8">
          <Link href="/">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zur Startseite
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
