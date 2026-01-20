import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useTranslation, Trans } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Mail, Calendar, Vote, ExternalLink, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PollSuccess() {
  const { t } = useTranslation();
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
        title: t('pollSuccess.toasts.linkCopied'),
        description: t('pollSuccess.toasts.linkCopiedDesc', { label }),
      });
    } catch (err) {
      toast({
        title: t('pollSuccess.toasts.error'),
        description: t('pollSuccess.toasts.linkNotCopied'),
        variant: "destructive",
      });
    }
  };

  if (!pollData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('pollSuccess.noDataTitle')}</CardTitle>
            <CardDescription>
              {t('pollSuccess.noDataDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">{t('pollSuccess.backToHome')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { poll, publicLink, adminLink, pollType } = pollData;
  const pollTypeText = pollType === 'schedule' ? t('pollSuccess.schedulePoll') : t('pollSuccess.survey');
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
            {t('pollSuccess.successTitle', { type: pollTypeText })}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {t('pollSuccess.successDesc', { type: pollTypeText, title: poll.title })}
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
                {t('pollSuccess.publicLink')}
              </CardTitle>
              <CardDescription>
                {t('pollSuccess.publicLinkDesc')}
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
                  onClick={() => copyToClipboard(fullPublicLink, t('pollSuccess.publicLink'))}
                  className="flex-1"
                  variant="outline"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {t('pollSuccess.copy')}
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
                {t('pollSuccess.adminLink')}
              </CardTitle>
              <CardDescription>
                {t('pollSuccess.adminLinkDesc')}
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
                  onClick={() => copyToClipboard(fullAdminLink, t('pollSuccess.adminLink'))}
                  className="flex-1"
                  variant="outline"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {t('pollSuccess.copy')}
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
              {t('pollSuccess.emailNotification')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-800 dark:text-yellow-200">
                <Trans 
                  i18nKey="pollSuccess.emailNotificationHint" 
                  values={{ email: poll.creatorEmail }}
                  components={{ strong: <strong /> }}
                />
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>{t('pollSuccess.nextSteps')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-medium text-foreground">{t('pollSuccess.step1Title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('pollSuccess.step1Desc')}
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-medium text-foreground">{t('pollSuccess.step2Title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('pollSuccess.step2Desc')}
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-medium text-foreground">{t('pollSuccess.step3Title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('pollSuccess.step3Desc')}
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
              {t('pollSuccess.createNewPoll')}
            </Button>
          </Link>
          <Button
            onClick={() => window.open(fullPublicLink, '_blank')}
            className="w-full sm:w-auto polly-button-primary"
          >
            {t('pollSuccess.goToVoting')}
          </Button>
        </div>
      </div>
    </div>
  );
}