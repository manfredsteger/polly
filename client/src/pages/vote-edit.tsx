import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle, Edit3, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Vote } from "@shared/schema";

interface SecurePollOption {
  id: number;
  text: string;
  imageUrl: string | null;
  altText?: string | null;
  startTime: string | null;
  endTime: string | null;
  order: number;
}

interface SecurePoll {
  id: string;
  title: string;
  description: string | null;
  type: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  options: SecurePollOption[];
}

interface VoterEditData {
  poll: SecurePoll;
  votes: Vote[];
  voterName: string;
  voterEmail: string;
  allowVoteWithdrawal?: boolean;
}

export default function VoteEditPage() {
  const { t, i18n } = useTranslation();
  const { editToken } = useParams<{ editToken: string }>();
  const [, setLocation] = useLocation();
  const [currentVotes, setCurrentVotes] = useState<Record<number, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: voterData, isLoading, error } = useQuery<VoterEditData>({
    queryKey: [`/api/v1/votes/edit/${editToken}`],
    enabled: !!editToken,
  });

  const updateVotesMutation = useMutation({
    mutationFn: (votes: { optionId: number; response: string }[]) =>
      apiRequest("PUT", `/api/v1/votes/edit/${editToken}`, { votes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/v1/votes/edit/${editToken}`] });
      toast({
        title: t('voting.voteUpdated'),
        description: t('voteEdit.responsesChanged'),
      });
      setHasChanges(false);
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('voteEdit.updateError'),
        variant: "destructive",
      });
    },
  });

  const withdrawVoteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/v1/votes/edit/${editToken}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('voting.voteWithdrawn'),
        description: t('voteEdit.voteRemoved'),
      });
      setLocation('/');
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('voteEdit.withdrawError'),
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (voterData?.votes) {
      const votesMap: Record<number, string> = {};
      voterData.votes.forEach(vote => {
        votesMap[vote.optionId] = vote.response;
      });
      setCurrentVotes(votesMap);
    }
  }, [voterData]);

  const handleVoteChange = (optionId: number, response: string) => {
    const newVotes = { ...currentVotes, [optionId]: response };
    setCurrentVotes(newVotes);
    
    // Check if there are changes from original votes
    const hasAnyChanges = voterData?.votes.some(vote => 
      newVotes[vote.optionId] !== vote.response
    ) || false;
    setHasChanges(hasAnyChanges);
  };

  const handleSaveChanges = () => {
    if (!voterData || !hasChanges) return;

    const updatedVotes = voterData.votes.map(vote => ({
      optionId: vote.optionId,
      response: currentVotes[vote.optionId]
    }));

    updateVotesMutation.mutate(updatedVotes);
  };

  const handleGoBack = () => {
    setLocation('/');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>{t('voteEdit.loadingVote')}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !voterData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="flex items-center justify-center py-8 text-center">
            <div>
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">{t('voteEdit.voteNotFound')}</h2>
              <p className="text-gray-600 mb-4">
                {t('voteEdit.invalidLink')}
              </p>
              <Button onClick={() => setLocation('/')}>
                {t('voteEdit.toHomepage')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { poll, votes, voterName, voterEmail } = voterData;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Edit3 className="h-5 w-5 text-blue-600" />
              <Badge variant="outline">{t('voting.editYourVote')}</Badge>
            </div>
            <CardTitle className="text-2xl">{poll.title}</CardTitle>
            {poll.description && (
              <CardDescription className="text-base">
                {poll.description}
              </CardDescription>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
              <span>{t('voteEdit.votedAs')}: <strong>{voterName}</strong></span>
              <span>•</span>
              <span>{voterEmail}</span>
            </div>
          </CardHeader>
        </Card>

        {/* Voting Options */}
        <div className="space-y-4 mb-6">
          {poll.options.map((option) => {
            const currentResponse = currentVotes[option.id];
            
            return (
              <Card key={option.id} className="transition-all hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-lg mb-2">{option.text}</h3>
                      {option.startTime && option.endTime && (
                        <p className="text-sm text-gray-600 mb-3">
                          {new Date(option.startTime).toLocaleString(i18n.language === 'de' ? 'de-DE' : 'en-US')} - {new Date(option.endTime).toLocaleString(i18n.language === 'de' ? 'de-DE' : 'en-US')}
                        </p>
                      )}
                      
                      <div className="flex gap-2">
                        {(['yes', 'maybe', 'no'] as const).map((response) => (
                          <Button
                            key={response}
                            variant={currentResponse === response ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleVoteChange(option.id, response)}
                            className={`
                              ${response === 'yes' ? 'hover:bg-green-600 hover:text-white' : ''}
                              ${response === 'maybe' ? 'hover:bg-yellow-600 hover:text-white' : ''}
                              ${response === 'no' ? 'hover:bg-red-600 hover:text-white' : ''}
                              ${currentResponse === response && response === 'yes' ? 'bg-green-600 text-white' : ''}
                              ${currentResponse === response && response === 'maybe' ? 'bg-yellow-600 text-white' : ''}
                              ${currentResponse === response && response === 'no' ? 'bg-red-600 text-white' : ''}
                            `}
                          >
                            {response === 'yes' ? t('common.yes') : response === 'maybe' ? t('common.maybe') : t('common.no')}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center flex-wrap">
          <Button
            onClick={handleSaveChanges}
            disabled={!hasChanges || updateVotesMutation.isPending}
            className="polly-button-primary"
          >
            {updateVotesMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('common.saving')}
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                {t('voteEdit.saveChanges')}
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={handleGoBack}
            className="polly-button-neutral"
          >
            {t('voteEdit.toHomepage')}
          </Button>
          
          {voterData?.allowVoteWithdrawal && (
            <Button
              variant="destructive"
              onClick={() => withdrawVoteMutation.mutate()}
              disabled={withdrawVoteMutation.isPending}
              className="polly-button-danger"
              data-testid="button-withdraw-vote"
            >
              {withdrawVoteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('voteEdit.withdrawing')}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('voting.withdrawVote')}
                </>
              )}
            </Button>
          )}
        </div>

        {hasChanges && (
          <p className="text-center text-sm text-orange-600 mt-4">
            {t('voteEdit.unsavedChanges')}
          </p>
        )}
      </div>
    </div>
  );
}