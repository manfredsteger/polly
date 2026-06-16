import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Edit, ArrowLeft, Copy, Link2, ExternalLink, CheckCircle2, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function VoteSuccess() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [voteData, setVoteData] = useState<any>(null);
  const [showLinks, setShowLinks] = useState(false);

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
            <CardTitle>{t('voteSuccess.noDataTitle')}</CardTitle>
            <CardDescription>
              {t('voteSuccess.noDataDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">{t('voteSuccess.backToHome')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { poll, publicToken, voterName, voterEditToken } = voteData;
  const publicLink = `${window.location.origin}/poll/${publicToken}`;
  const resultsLink = `${window.location.origin}/poll/${publicToken}#results`;
  const editLink = voterEditToken ? `${window.location.origin}/edit/${voterEditToken}` : null;

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: t('voteSuccess.toasts.copied'),
        description: successMessage,
      });
    } catch (err) {
      toast({
        title: t('voteSuccess.toasts.error'),
        description: t('voteSuccess.toasts.textNotCopied'),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <div className="text-center mb-8">
          <CheckCircle2 className="mx-auto mb-5 h-12 w-12 text-green-600 dark:text-green-400" strokeWidth={2.2} />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('voteSuccess.thankYouTitle')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {t('voteSuccess.thankYouDesc', { title: poll.title })}
          </p>
          {voteData.voterEmail && (
            <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <p>{t('voteSuccess.checkSpamHint')}</p>
            </div>
          )}
        </div>

        {voterName && (
          <Card className="mb-8 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 shadow-sm">
            <CardContent className="py-8">
              <p className="text-center text-blue-700 dark:text-blue-300 font-medium text-2xl">
                {t('voteSuccess.votedAs')}: <strong>{voterName}</strong>
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="mt-8 border border-blue-500/40 bg-gradient-to-br from-blue-950/80 via-slate-900/95 to-slate-950 text-white shadow-[0_18px_60px_rgba(15,23,42,0.35)]">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-2xl text-blue-200">
              <Link2 className="h-5 w-5 text-blue-300" />
              {t('voteSuccess.inviteTitle')}
            </CardTitle>
            <CardDescription className="text-base text-blue-100/75">
              {t('voteSuccess.inviteDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row">
              <Input
                value={publicLink}
                readOnly
                className="h-14 rounded-2xl border border-blue-400/20 bg-white/10 text-lg font-medium text-blue-50 placeholder:text-blue-100/40"
              />
              <Button
                className="h-12 rounded-xl border border-blue-300/20 bg-blue-500 px-6 text-base font-medium whitespace-nowrap text-white shadow-sm hover:bg-blue-400"
                onClick={() => copyToClipboard(publicLink, t('voteSuccess.toasts.linkCopied'))}
              >
                <Copy className="w-4 h-4 mr-2" />
                {t('common.copy')}
              </Button>
            </div>
            {editLink && (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  className="px-0 text-sm text-blue-100/70 hover:bg-transparent hover:text-blue-50"
                  onClick={() => setShowLinks((prev) => !prev)}
                >
                  {showLinks ? t('voteSuccess.hideLinks') : t('voteSuccess.showLinks')}
                </Button>
                {showLinks && (
                  <div className="rounded-xl border border-blue-400/20 bg-black/15 p-4">
                    <label className="text-sm font-medium text-blue-100/70">
                      {t('voteSuccess.editVoteLink')}
                    </label>
                    <div className="mt-2 flex items-center space-x-2">
                      <Input
                        value={editLink}
                        readOnly
                        className="border border-blue-400/20 bg-white/10 font-mono text-sm text-blue-50"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-blue-300/20 bg-white/5 text-blue-50 hover:bg-white/10 hover:text-blue-50"
                        onClick={() => copyToClipboard(editLink, t('voteSuccess.toasts.editLinkCopied'))}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 flex-wrap justify-center">
          <Button
            onClick={() => window.open(resultsLink, '_blank')}
            className="flex items-center justify-center whitespace-nowrap polly-button-primary"
          >
            <BarChart3 className="w-4 h-4 mr-2 shrink-0" />
            {t('voteSuccess.viewResults')}
          </Button>
          <Button
            onClick={() => window.open(publicLink, '_blank')}
            variant="outline"
            className="flex items-center justify-center whitespace-nowrap border-slate-300 bg-white/90 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <ExternalLink className="w-4 h-4 mr-2 shrink-0" />
            {t('voteSuccess.goToPoll')}
          </Button>
          {editLink && (
            <Button
              onClick={() => window.open(editLink, '_blank')}
              variant="outline"
              className="flex items-center justify-center whitespace-nowrap polly-button-neutral"
            >
              <Edit className="w-4 h-4 mr-2 shrink-0" />
              {t('voteSuccess.editVote')}
            </Button>
          )}
        </div>

        {/* Back to Home */}
        <div className="text-center mt-8">
          <Link href="/">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('voteSuccess.backToHome')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
