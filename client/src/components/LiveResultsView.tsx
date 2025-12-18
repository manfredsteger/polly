import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Maximize2, 
  Minimize2, 
  Check, 
  X, 
  HelpCircle, 
  Radio, 
  Wifi,
  WifiOff,
  RefreshCw,
  Eye,
  Clock,
  User,
  Trophy
} from 'lucide-react';
import { useLiveVoting } from '@/hooks/useLiveVoting';
import type { PollWithOptions, PollResults } from '@shared/schema';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn, formatScheduleOptionText } from '@/lib/utils';

function FormattedOptionText({ text }: { text: string }) {
  const parsed = formatScheduleOptionText(text);
  if (parsed) {
    return <><span className="font-bold">{parsed.date}</span> {parsed.time}</>;
  }
  return <>{text}</>;
}

interface LiveResultsViewProps {
  poll: PollWithOptions;
  publicToken: string;
  isAdminAccess?: boolean;
}

export function LiveResultsView({ poll, publicToken, isAdminAccess = false }: LiveResultsViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const queryClient = useQueryClient();

  // Results endpoint uses the generic route that handles both admin and public tokens
  const resultsEndpoint = `/api/v1/polls/${publicToken}/results`;

  const pollEndpoint = isAdminAccess
    ? `/api/v1/polls/admin/${publicToken}`
    : `/api/v1/polls/public/${publicToken}`;

  const { data: results, refetch: refetchResults } = useQuery<PollResults>({
    queryKey: [resultsEndpoint],
    refetchInterval: isFullscreen ? 5000 : 15000,
  });

  const handleResultsRefresh = useCallback(() => {
    refetchResults();
    queryClient.invalidateQueries({ queryKey: [pollEndpoint] });
  }, [refetchResults, queryClient, pollEndpoint]);

  const handleVoteFinalized = useCallback((voterName: string) => {
    console.log(`[LiveResults] Vote finalized by ${voterName}`);
    setTimeout(() => {
      refetchResults();
      queryClient.invalidateQueries({ queryKey: [pollEndpoint] });
    }, 500);
  }, [refetchResults, queryClient, pollEndpoint]);

  const {
    isConnected,
    activeVoters,
    liveVotes,
    viewerCount,
    reconnect,
  } = useLiveVoting({
    pollToken: publicToken,
    isPresenter: true,
    onResultsRefresh: handleResultsRefresh,
    onVoteFinalized: handleVoteFinalized,
  });

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(console.error);
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(console.error);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, toggleFullscreen]);

  const getTypeLabel = () => {
    switch (poll.type) {
      case 'schedule': return 'Terminumfrage';
      case 'survey': return 'Umfrage';
      case 'organization': return 'Orga-Liste';
      default: return 'Umfrage';
    }
  };

  const containerClasses = cn(
    'transition-all duration-300',
    isFullscreen && 'fixed inset-0 z-50 bg-background p-8 overflow-auto'
  );

  const getVoteIcon = (response: 'yes' | 'no' | 'maybe' | null | undefined, isLive = false) => {
    const iconClasses = cn('w-5 h-5', isLive && 'opacity-50');
    switch (response) {
      case 'yes': return <Check className={cn(iconClasses, 'text-green-500')} />;
      case 'no': return <X className={cn(iconClasses, 'text-red-500')} />;
      case 'maybe': return <HelpCircle className={cn(iconClasses, 'text-yellow-500')} />;
      default: return <span className="w-5 h-5" />;
    }
  };

  // Presence-only voters (on the page but haven't selected anything yet AND haven't submitted votes)
  const presenceOnlyVoters = useMemo(() => {
    const liveVoterIds = new Set(Object.keys(liveVotes));
    // Also exclude voters who have already submitted (finalized) votes
    const submittedVoterNames = new Set(
      results?.votes?.map(v => v.voterName.toLowerCase()) || []
    );
    return activeVoters.filter(v => 
      !liveVoterIds.has(v.id) && 
      !submittedVoterNames.has(v.name.toLowerCase())
    );
  }, [activeVoters, liveVotes, results?.votes]);

  // Voters actively selecting (in-progress votes)
  const allLiveVotersWithVotes = useMemo(() => {
    return Object.entries(liveVotes).map(([id, data]) => ({
      id,
      name: data.voterName,
      votes: data.votes,
      isLive: true,
    }));
  }, [liveVotes]);

  const uniqueSubmittedVoters = useMemo(() => {
    if (!results?.votes || results.votes.length === 0) return [];
    
    const voterMap = new Map<string, Record<number, string>>();
    
    results.votes.forEach(vote => {
      const key = vote.voterName;
      if (!voterMap.has(key)) {
        voterMap.set(key, {});
      }
      voterMap.get(key)![vote.optionId] = vote.response;
    });
    
    return Array.from(voterMap.entries()).map(([name, votes]) => ({
      name,
      votes,
    }));
  }, [results?.votes]);

  // Calculate the winning option(s)
  const winningOptionIds = useMemo(() => {
    if (!results?.stats || results.stats.length === 0) return new Set<number>();
    
    let maxScore = -1;
    const winners: number[] = [];
    
    results.stats.forEach(stat => {
      // For organization polls, only count yes votes
      // For others, count yes + 0.5*maybe
      const score = poll.type === 'organization' 
        ? stat.yesCount 
        : stat.yesCount + (stat.maybeCount * 0.5);
      
      if (score > maxScore && score > 0) {
        maxScore = score;
        winners.length = 0;
        winners.push(stat.optionId);
      } else if (score === maxScore && score > 0) {
        winners.push(stat.optionId);
      }
    });
    
    return new Set(winners);
  }, [results?.stats, poll.type]);

  return (
    <div className={containerClasses}>
      <Card className={cn('kita-card', isFullscreen && 'h-full flex flex-col')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <Radio className={cn('w-5 h-5', isConnected ? 'text-green-500 animate-pulse' : 'text-muted-foreground')} />
              Live-Abstimmung
            </CardTitle>
            <Badge variant="outline" className="flex items-center gap-1">
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-green-500" />
                  Verbunden
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-red-500" />
                  Getrennt
                </>
              )}
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {viewerCount} Zuschauer
            </Badge>
            {activeVoters.length > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1 bg-amber-500/20 text-amber-600">
                <Clock className="w-3 h-3" />
                {activeVoters.length} stimmen gerade ab
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchResults()} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {!isConnected && (
              <Button variant="outline" size="sm" onClick={reconnect}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Neu verbinden
              </Button>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={toggleFullscreen} data-testid="button-fullscreen">
                    {isFullscreen ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isFullscreen ? 'Vollbild beenden (Esc)' : 'Vollbild für Präsentation (Strg+F)'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>

        <CardContent className={cn('space-y-6', isFullscreen && 'flex-1 overflow-auto')}>
          <div className={cn(
            'text-center mb-6',
            isFullscreen && 'text-2xl'
          )}>
            <h2 className={cn('font-bold', isFullscreen ? 'text-3xl mb-2' : 'text-xl mb-1')}>
              {poll.title}
            </h2>
            <Badge variant="secondary">{getTypeLabel()}</Badge>
            {poll.description && (
              <p className={cn('text-muted-foreground mt-2', isFullscreen && 'text-lg')}>
                {poll.description}
              </p>
            )}
          </div>

          <div className={cn(
            'overflow-x-auto',
            isFullscreen && 'px-4'
          )}>
            <table className={cn(
              'w-full border-collapse table-auto',
              isFullscreen && 'text-base'
            )}>
              <thead>
                <tr className="border-b border-border">
                  <th className={cn(
                    'text-left font-medium text-muted-foreground p-3',
                    isFullscreen && 'p-4'
                  )}>
                    Teilnehmer
                  </th>
                  {poll.options.map(option => {
                    const isWinner = winningOptionIds.has(option.id);
                    return (
                      <th 
                        key={option.id} 
                        className={cn(
                          'text-center font-medium p-3 min-w-[120px] transition-all duration-500',
                          isFullscreen && 'p-4 min-w-[180px]',
                          isWinner && 'bg-green-500/20 border-x-2 border-t-2 border-green-500/50'
                        )}
                      >
                        <div className="flex flex-col items-center gap-1">
                          {isWinner && (
                            <Trophy className={cn('text-green-600 animate-pulse', isFullscreen ? 'w-5 h-5' : 'w-4 h-4')} />
                          )}
                          <div 
                            className={cn(
                              isFullscreen ? 'text-sm whitespace-normal leading-tight' : 'truncate max-w-[150px] text-xs'
                            )} 
                            title={option.text}
                          >
                            <FormattedOptionText text={option.text} />
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Presence-only voters: on page but no selections yet */}
                {presenceOnlyVoters.map(voter => (
                  <tr 
                    key={`presence-${voter.id}`} 
                    className="border-b border-border/30 opacity-40"
                  >
                    <td className={cn(
                      'p-3 font-medium',
                      isFullscreen && 'p-4'
                    )}>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-400" />
                        <span className="text-muted-foreground italic">{voter.name}</span>
                        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20">
                          betrachtet...
                        </Badge>
                      </div>
                    </td>
                    {poll.options.map(option => (
                      <td 
                        key={option.id} 
                        className={cn(
                          'text-center p-3',
                          isFullscreen && 'p-4',
                          winningOptionIds.has(option.id) && 'bg-green-500/5 border-x border-green-500/30'
                        )}
                      >
                        <span className="text-muted-foreground/30">—</span>
                      </td>
                    ))}
                  </tr>
                ))}

                {/* In-progress voters: actively selecting options */}
                {allLiveVotersWithVotes.map(voter => (
                  <tr 
                    key={voter.id} 
                    className="border-b border-border/50 bg-amber-500/5"
                  >
                    <td className={cn(
                      'p-3 font-medium',
                      isFullscreen && 'p-4'
                    )}>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                        <span className="text-muted-foreground italic">{voter.name}</span>
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                          stimmt ab...
                        </Badge>
                      </div>
                    </td>
                    {poll.options.map(option => {
                      const response = voter.votes[String(option.id)];
                      const isWinner = winningOptionIds.has(option.id);
                      return (
                        <td 
                          key={option.id} 
                          className={cn(
                            'text-center p-3 transition-all duration-300',
                            isFullscreen && 'p-4',
                            response === 'yes' && 'bg-green-500/10',
                            response === 'no' && 'bg-red-500/10',
                            response === 'maybe' && 'bg-yellow-500/10',
                            isWinner && !response && 'bg-green-500/5 border-x border-green-500/30'
                          )}
                        >
                          <div className="flex justify-center opacity-60">
                            {getVoteIcon(response, true)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Finalized voters: submitted votes */}
                {uniqueSubmittedVoters.map((voter, idx) => (
                  <tr key={`submitted-${idx}`} className="border-b border-border/50">
                    <td className={cn(
                      'p-3 font-medium',
                      isFullscreen && 'p-4'
                    )}>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        {voter.name}
                      </div>
                    </td>
                    {poll.options.map(opt => {
                      const response = voter.votes[opt.id] as 'yes' | 'no' | 'maybe' | undefined;
                      const isWinner = winningOptionIds.has(opt.id);
                      return (
                        <td 
                          key={opt.id} 
                          className={cn(
                            'text-center p-3 transition-all duration-300',
                            isFullscreen && 'p-4',
                            response === 'yes' && 'bg-green-500/20',
                            response === 'no' && 'bg-red-500/20',
                            response === 'maybe' && 'bg-yellow-500/20',
                            isWinner && !response && 'bg-green-500/5 border-x border-green-500/30'
                          )}
                        >
                          <div className="flex justify-center">
                            {getVoteIcon(response)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {allLiveVotersWithVotes.length === 0 && uniqueSubmittedVoters.length === 0 && presenceOnlyVoters.length === 0 && (
                  <tr>
                    <td 
                      colSpan={poll.options.length + 1} 
                      className={cn('text-center p-8 text-muted-foreground', isFullscreen && 'p-12')}
                    >
                      Noch keine Stimmen abgegeben. Warten auf Teilnehmer...
                    </td>
                  </tr>
                )}

                {/* Summary row with winner highlighting */}
                {results?.stats && (
                  <tr className="bg-muted/50 font-semibold border-t-2 border-border">
                    <td className={cn('p-3', isFullscreen && 'p-4')}>
                      Gesamt ({uniqueSubmittedVoters.length} Stimmen)
                    </td>
                    {results.stats.map(stat => {
                      const isWinner = winningOptionIds.has(stat.optionId);
                      return (
                        <td 
                          key={stat.optionId} 
                          className={cn(
                            'text-center p-3 transition-all duration-500',
                            isFullscreen && 'p-4',
                            isWinner && 'bg-green-500/30 border-x-2 border-b-2 border-green-500/50'
                          )}
                        >
                          <div className="flex justify-center items-center gap-2">
                            {isWinner && <Trophy className="w-4 h-4 text-green-600" />}
                            <span className="text-green-600 flex items-center gap-1">
                              <Check className="w-4 h-4" />
                              {stat.yesCount}
                            </span>
                            {poll.type !== 'organization' && (
                              <>
                                <span className="text-yellow-600 flex items-center gap-1">
                                  <HelpCircle className="w-4 h-4" />
                                  {stat.maybeCount}
                                </span>
                                <span className="text-red-600 flex items-center gap-1">
                                  <X className="w-4 h-4" />
                                  {stat.noCount}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {isFullscreen && (
            <div className="fixed bottom-4 right-4 flex items-center gap-4 text-sm text-muted-foreground bg-background/80 px-4 py-2 rounded-lg border">
              <span>Drücken Sie <kbd className="px-2 py-1 bg-muted rounded text-xs">Esc</kbd> zum Beenden</span>
              <span className="text-xs">|</span>
              <span className="flex items-center gap-1">
                <Radio className={cn('w-3 h-3', isConnected ? 'text-green-500' : 'text-red-500')} />
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
