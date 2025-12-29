import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, BarChart3, Edit, ExternalLink, ArrowLeft, Copy, Link as LinkIcon, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function VoteSuccess() {
  const { t } = useTranslation();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [voteData, setVoteData] = useState<any>(null);

  // All hooks must be called before any early returns
  const withdrawVoteMutation = useMutation({
    mutationFn: async () => {
      if (!voteData?.publicToken) throw new Error('No poll token');
      const response = await apiRequest("DELETE", `/api/v1/polls/${voteData.publicToken}/vote`, {
        voterEditToken: voteData.voterEditToken,
        voterEmail: voteData.voterEmail
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('voteSuccess.toasts.voteWithdrawn'),
        description: t('voteSuccess.toasts.voteWithdrawnDesc'),
      });
      if (voteData?.publicToken) {
        navigate(`/poll/${voteData.publicToken}`);
      }
    },
    onError: () => {
      toast({
        title: t('voteSuccess.toasts.error'),
        description: t('voteSuccess.toasts.voteNotWithdrawn'),
        variant: "destructive",
      });
    },
  });

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

  const { poll, pollType, publicToken, voterName, voterEditToken } = voteData;
  const pollTypeText = pollType === 'schedule' ? t('voteSuccess.schedulePoll') : t('voteSuccess.survey');
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
            {t('voteSuccess.thankYouTitle')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {t('voteSuccess.thankYouDesc', { title: poll.title })}
          </p>
        </div>

        {/* Voter Info */}
        {voterName && (
          <Card className="mb-6 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <p className="text-blue-700 dark:text-blue-300 font-medium">
                  {t('voteSuccess.votedAs')}: <strong>{voterName}</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('voteSuccess.nextStepsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-medium text-foreground">{t('voteSuccess.step1Title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('voteSuccess.step1Desc')}
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-medium text-foreground">{t('voteSuccess.step2Title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('voteSuccess.step2Desc')}
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-medium text-foreground">{t('voteSuccess.step3Title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('voteSuccess.step3Desc', { type: pollTypeText })}
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
            className="flex items-center justify-center polly-button-primary"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            {t('voteSuccess.viewResults')}
          </Button>
          
          {editLink && (
            <Button
              onClick={() => window.open(editLink, '_blank')}
              variant="outline"
              className="flex items-center justify-center polly-button-neutral"
            >
              <Edit className="w-4 h-4 mr-2" />
              {t('voteSuccess.editVote')}
            </Button>
          )}
          
          {canWithdraw && (
            <Button
              onClick={() => withdrawVoteMutation.mutate()}
              disabled={withdrawVoteMutation.isPending}
              className="flex items-center justify-center polly-button-danger"
              data-testid="button-withdraw-vote"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {withdrawVoteMutation.isPending ? t('voteSuccess.withdrawing') : t('voteSuccess.withdrawVote')}
            </Button>
          )}
        </div>

        {/* Survey Links Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <LinkIcon className="w-5 h-5 mr-2" />
              {t('voteSuccess.pollLinks')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('voteSuccess.viewPoll')}
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
                  onClick={() => copyToClipboard(publicLink, t('voteSuccess.toasts.linkCopied'))}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('voteSuccess.viewResultsLink')}
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
                  onClick={() => copyToClipboard(resultsLink, t('voteSuccess.toasts.resultLinkCopied'))}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {editLink && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('voteSuccess.editVoteLink')}
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
                    onClick={() => copyToClipboard(editLink, t('voteSuccess.toasts.editLinkCopied'))}
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
              {t('voteSuccess.backToHome')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
