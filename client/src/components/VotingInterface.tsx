import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Check, X, HelpCircle, Calendar, Clock, Mail, AlertTriangle, ListChecks, LogIn, User, Trash2 } from "lucide-react";
import type { PollWithOptions } from "@shared/schema";
import { SimpleImageVoting } from "./SimpleImageVoting";
import { OrganizationSlotVoting } from "./OrganizationSlotVoting";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveVoting } from "@/hooks/useLiveVoting";

interface SlotBookingInfo {
  optionId: number;
  comment?: string;
}

interface VotingInterfaceProps {
  poll: PollWithOptions;
  isAdminAccess?: boolean;
}

type VoteResponse = 'yes' | 'maybe' | 'no';

interface MyVotesResponse {
  hasVoted: boolean;
  votes: Array<{
    optionId: number;
    response: string;
    voterName: string;
    voterEmail: string;
    comment?: string;
    voterEditToken?: string;
  }>;
  allowVoteEdit: boolean;
  allowVoteWithdrawal: boolean;
  voterKey: string;
  voterSource: 'user' | 'device';
}

export function VotingInterface({ poll, isAdminAccess = false }: VotingInterfaceProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated } = useAuth();
  
  const { data: myVotesData, isLoading: isLoadingMyVotes } = useQuery<MyVotesResponse>({
    queryKey: ['/api/v1/polls', poll.publicToken, 'my-votes'],
    queryFn: async () => {
      const response = await fetch(`/api/v1/polls/${poll.publicToken}/my-votes`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch my votes');
      return response.json();
    },
    staleTime: 30000,
  });

  const hasAlreadyVoted = myVotesData?.hasVoted ?? false;
  const canEdit = poll.allowVoteEdit;
  const showAlreadyVotedMessage = hasAlreadyVoted && !canEdit;
  
  const [voterName, setVoterName] = useState("");
  const [voterEmail, setVoterEmail] = useState("");
  const [votes, setVotes] = useState<Record<number, VoteResponse>>({});
  const [orgaBookings, setOrgaBookings] = useState<SlotBookingInfo[]>([]);
  const [hasOrgaChanges, setHasOrgaChanges] = useState(false);
  const [showSelfVote, setShowSelfVote] = useState(false);
  const [duplicateEmailError, setDuplicateEmailError] = useState<string | null>(null);
  const [emailRequiresLogin, setEmailRequiresLogin] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isUserEmailLocked, setIsUserEmailLocked] = useState(false);

  const { sendVoteInProgress, sendVoteSubmitted, updateVoterName, isConnected } = useLiveVoting({
    pollToken: poll.publicToken,
    voterName: voterName || undefined,
  });

  // Calculate current signups from poll.votes for organization polls
  const currentSignups = useMemo(() => {
    if (poll.type !== 'organization') return {};
    
    const signups: Record<number, { count: number; maxCapacity: number; names: string[] }> = {};
    
    // Initialize all options with their maxCapacity
    poll.options.forEach(option => {
      signups[option.id] = {
        count: 0,
        maxCapacity: option.maxCapacity || 1,
        names: []
      };
    });
    
    // Count 'yes' votes (signups) per option
    poll.votes?.forEach(vote => {
      if (vote.response === 'yes' && signups[vote.optionId]) {
        signups[vote.optionId].count++;
        if (vote.voterName) {
          signups[vote.optionId].names.push(vote.voterName);
        }
      }
    });
    
    return signups;
  }, [poll.type, poll.options, poll.votes]);

  useEffect(() => {
    if (voterName && isConnected) {
      updateVoterName(voterName);
    }
  }, [voterName, isConnected, updateVoterName]);

  // Pre-fill user email and name if logged in (both for regular users and admins)
  useEffect(() => {
    if (isAuthenticated && user) {
      setVoterEmail(user.email);
      setVoterName(user.name);
      setIsUserEmailLocked(true);
      setEmailRequiresLogin(false);
    }
  }, [isAuthenticated, user]);

  // Pre-fill votes from existing data when editing is allowed
  useEffect(() => {
    if (myVotesData?.hasVoted && canEdit && myVotesData.votes.length > 0) {
      // Pre-fill voter info
      const firstVote = myVotesData.votes[0];
      if (firstVote.voterName && !voterName) {
        setVoterName(firstVote.voterName);
      }
      if (firstVote.voterEmail && !voterEmail) {
        setVoterEmail(firstVote.voterEmail);
      }
      
      // Pre-fill vote responses for schedule/survey polls
      if (poll.type !== 'organization') {
        const existingVotes: Record<number, VoteResponse> = {};
        myVotesData.votes.forEach(v => {
          if (v.response === 'yes' || v.response === 'maybe' || v.response === 'no') {
            existingVotes[v.optionId] = v.response as VoteResponse;
          }
        });
        if (Object.keys(existingVotes).length > 0) {
          setVotes(existingVotes);
        }
      }
    }
  }, [myVotesData, canEdit, poll.type, voterName, voterEmail]);

  // Check if email belongs to a registered user
  const checkEmailRegistration = async (email: string) => {
    if (!email.trim()) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return;
    
    // Skip check if user is logged in and using their own email
    if (isAuthenticated && user && user.email.toLowerCase() === email.toLowerCase().trim()) {
      setEmailRequiresLogin(false);
      return;
    }
    
    setIsCheckingEmail(true);
    try {
      const response = await apiRequest("POST", "/api/v1/auth/check-email", { email: email.trim() });
      const result = await response.json();
      
      if (result.requiresLogin) {
        setEmailRequiresLogin(true);
        // Scroll to top to show the alert
        if (containerRef.current) {
          containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        setEmailRequiresLogin(false);
      }
    } catch (error) {
      console.error('Error checking email:', error);
      setEmailRequiresLogin(false);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const voteMutation = useMutation({
    mutationFn: async (voteData: any) => {
      const response = await apiRequest("POST", `/api/v1/polls/${poll.publicToken}/vote`, voteData);
      return response.json();
    },
    onError: (error) => {
      console.error('Vote error:', error);
      
      // Clear any previous duplicate email error
      setDuplicateEmailError(null);
      
      // Try to parse the error message
      let errorMessage = "Ihre Stimme konnte nicht gespeichert werden.";
      let isDuplicateEmail = false;
      let requiresLogin = false;
      
      if (error instanceof Error && error.message) {
        try {
          // Extract JSON from error message (format: "400: {json}")
          const match = error.message.match(/\d+:\s*(.+)/);
          if (match && match[1]) {
            const errorData = JSON.parse(match[1]);
            if (errorData.errorCode === 'DUPLICATE_EMAIL_VOTE') {
              errorMessage = errorData.error;
              isDuplicateEmail = true;
              setDuplicateEmailError(voterEmail);
            } else if (errorData.errorCode === 'REQUIRES_LOGIN') {
              errorMessage = errorData.error;
              requiresLogin = true;
              setEmailRequiresLogin(true);
            } else if (errorData.errorCode === 'EMAIL_MISMATCH') {
              errorMessage = errorData.error;
            } else if (errorData.errorCode === 'ALREADY_VOTED') {
              errorMessage = errorData.error;
              // Show toast with already voted message
              toast({
                title: "Bereits abgestimmt",
                description: errorMessage,
                variant: "default",
              });
              return; // Don't show second toast
            } else if (errorData.errorCode === 'USE_EDIT_LINK') {
              errorMessage = errorData.error;
              isDuplicateEmail = true;
              setDuplicateEmailError(voterEmail);
            } else if (errorData.error) {
              errorMessage = errorData.error;
            }
          }
        } catch (parseError) {
          // If we can't parse the error, use the original message
          console.error('Error parsing error message:', parseError);
        }
      }
      
      // Auto-scroll to top on error
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
      toast({
        title: "Fehler",
        description: errorMessage,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Clear duplicate email error on success
      setDuplicateEmailError(null);
    },
  });

  const resendEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/v1/polls/${poll.publicToken}/resend-email`, {
        email: duplicateEmailError
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "E-Mail versendet",
          description: "Eine neue E-Mail mit dem Link zum Ändern Ihrer Stimme wurde versendet.",
          variant: "default",
        });
      } else if (data.errorCode === 'EMAIL_BLOCKED_BY_SPAM_FILTER') {
        // Handle spam filter blocking without providing direct access
        toast({
          title: "E-Mail blockiert",
          description: "E-Mail wurde vom Spam-Filter blockiert. Bitte kontaktieren Sie den Administrator oder versuchen Sie es später erneut.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Die E-Mail konnte nicht versendet werden.",
        variant: "destructive",
      });
    },
  });

  const withdrawVoteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/v1/polls/${poll.publicToken}/vote`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Stimme zurückgezogen",
        description: "Ihre Stimme wurde erfolgreich entfernt.",
        variant: "default",
      });
      // Reset form state
      setVotes({});
      setOrgaBookings([]);
      setHasOrgaChanges(false);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/v1/polls', poll.publicToken] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/polls', poll.publicToken, 'my-votes'] });
    },
    onError: (error) => {
      let errorMessage = "Ihre Stimme konnte nicht zurückgezogen werden.";
      if (error instanceof Error && error.message) {
        try {
          const match = error.message.match(/\d+:\s*(.+)/);
          if (match && match[1]) {
            const errorData = JSON.parse(match[1]);
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          }
        } catch (parseError) {
          console.error('Error parsing error message:', parseError);
        }
      }
      toast({
        title: "Fehler",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleVote = (optionId: number, response: VoteResponse) => {
    setVotes(prev => ({ ...prev, [optionId]: response }));
    if (voterName && isConnected) {
      sendVoteInProgress(String(optionId), response);
    }
  };

  const handleOrgaBookingChange = (bookings: SlotBookingInfo[]) => {
    const prevBookings = orgaBookings;
    setOrgaBookings(bookings);
    setHasOrgaChanges(true);
    
    if (voterName && isConnected) {
      const prevIds = new Set(prevBookings.map(b => b.optionId));
      const newIds = new Set(bookings.map(b => b.optionId));
      
      bookings.forEach(b => {
        if (!prevIds.has(b.optionId)) {
          sendVoteInProgress(String(b.optionId), 'yes');
        }
      });
      
      prevBookings.forEach(b => {
        if (!newIds.has(b.optionId)) {
          sendVoteInProgress(String(b.optionId), null);
        }
      });
    }
  };

  const handleSubmitVotes = async () => {
    // Block submission if email requires login
    if (emailRequiresLogin) {
      toast({
        title: "Anmeldung erforderlich",
        description: "Bitte melden Sie sich an, um mit dieser E-Mail-Adresse abzustimmen.",
        variant: "destructive",
      });
      return;
    }

    if (!voterName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie Ihren Namen ein.",
        variant: "destructive",
      });
      return;
    }

    if (!voterEmail.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie Ihre E-Mail-Adresse ein.",
        variant: "destructive",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(voterEmail)) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
        variant: "destructive",
      });
      return;
    }

    // For organization polls, check bookings; for others, check votes
    if (poll.type === 'organization') {
      if (orgaBookings.length === 0) {
        toast({
          title: "Fehler",
          description: "Bitte tragen Sie sich für mindestens einen Slot ein.",
          variant: "destructive",
        });
        return;
      }
    } else {
      const votesToSubmit = Object.entries(votes);
      if (votesToSubmit.length === 0) {
        toast({
          title: "Fehler",
          description: "Bitte stimmen Sie für mindestens eine Option ab.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      if (poll.type === 'organization') {
        // For organization polls: Submit slot bookings
        let lastVoterEditToken: string | undefined;
        for (const booking of orgaBookings) {
          const result = await voteMutation.mutateAsync({
            pollId: poll.id,
            optionId: booking.optionId,
            voterName: voterName.trim(),
            voterEmail: voterEmail.trim(),
            response: 'yes',
            comment: booking.comment?.trim() || undefined,
          });
          // Capture the edit token from the response
          if (result && typeof result === 'object' && 'voterEditToken' in result) {
            lastVoterEditToken = result.voterEditToken;
          }
        }
        
        // Reset unsaved changes state
        setHasOrgaChanges(false);
        
        const successData = {
          poll: {
            title: poll.title,
            type: poll.type
          },
          pollType: poll.type,
          publicToken: poll.publicToken,
          voterName: voterName.trim(),
          voterEmail: voterEmail.trim(),
          voterEditToken: lastVoterEditToken,
          allowVoteWithdrawal: poll.allowVoteWithdrawal
        };
        sessionStorage.setItem('vote-success-data', JSON.stringify(successData));
      } else if (poll.type === 'survey') {
        // For surveys: Use bulk vote endpoint to ensure atomicity
        const votesToSubmit = Object.entries(votes);
        const bulkVoteData = {
          voterName: voterName.trim(),
          voterEmail: voterEmail.trim(),
          votes: votesToSubmit.map(([optionId, response]) => ({
            optionId: parseInt(optionId),
            response
          }))
        };
        
        const response = await apiRequest("POST", `/api/v1/polls/${poll.publicToken}/vote-bulk`, bulkVoteData);
        const result = await response.json();
        
        // Store vote success data for success page including edit token
        const successData = {
          poll: {
            title: poll.title,
            type: poll.type
          },
          pollType: poll.type,
          publicToken: poll.publicToken,
          voterName: voterName.trim(),
          voterEmail: voterEmail.trim(),
          voterEditToken: result.voterEditToken, // Include the edit token from bulk vote response
          allowVoteWithdrawal: poll.allowVoteWithdrawal
        };
        sessionStorage.setItem('vote-success-data', JSON.stringify(successData));
      } else {
        // For schedule polls: Submit votes one by one (allows multiple votes per email on different options)
        const votesToSubmit = Object.entries(votes);
        for (const [optionId, response] of votesToSubmit) {
          await voteMutation.mutateAsync({
            pollId: poll.id,
            optionId: parseInt(optionId),
            voterName: voterName.trim(),
            voterEmail: voterEmail.trim(),
            response,
          });
        }
        
        // For schedule polls: Store success data without edit token (they can vote multiple times)
        const successData = {
          poll: {
            title: poll.title,
            type: poll.type
          },
          pollType: poll.type,
          publicToken: poll.publicToken,
          voterName: voterName.trim(),
          voterEmail: voterEmail.trim(),
          allowVoteWithdrawal: poll.allowVoteWithdrawal
        };
        sessionStorage.setItem('vote-success-data', JSON.stringify(successData));
      }
      
      // Notify live voting system that vote was submitted
      if (isConnected) {
        sendVoteSubmitted();
      }
      
      // Redirect to vote success page
      setLocation("/vote-success");
    } catch (error) {
      console.error('Voting failed:', error);
      
      // Parse error response for better error handling
      let errorMessage = "Ihre Stimme konnte nicht gespeichert werden.";
      let errorCode = "";
      
      if (error instanceof Error && error.message) {
        try {
          const match = error.message.match(/\d+:\s*(.+)/);
          if (match && match[1]) {
            const errorData = JSON.parse(match[1]);
            errorMessage = errorData.error || errorMessage;
            errorCode = errorData.errorCode || "";
          }
        } catch (parseError) {
          // Use original error message if parsing fails
          errorMessage = error.message;
        }
      }
      
      // Handle specific error codes
      if (errorCode === 'DUPLICATE_EMAIL_VOTE' || errorCode === 'USE_EDIT_LINK') {
        setDuplicateEmailError(voterEmail.trim());
      } else if (errorCode === 'REQUIRES_LOGIN') {
        setEmailRequiresLogin(true);
      } else if (errorCode === 'ALREADY_VOTED') {
        // User has already voted - show info toast instead of error
        toast({
          title: "Bereits abgestimmt",
          description: errorMessage,
          variant: "default",
        });
        return;
      }
      
      // Auto-scroll to top on error
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
      toast({
        title: "Fehler",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const getVoteIcon = (response: VoteResponse) => {
    switch (response) {
      case 'yes':
        return <Check className="w-4 h-4" />;
      case 'maybe':
        return <HelpCircle className="w-4 h-4" />;
      case 'no':
        return <X className="w-4 h-4" />;
    }
  };

  const getVoteClass = (response: VoteResponse, isSelected: boolean) => {
    const base = "px-3 py-2 rounded-md border transition-colors";
    if (!isSelected) return `${base} border-border hover:bg-muted`;
    
    switch (response) {
      case 'yes':
        return `${base} vote-yes border-green-300`;
      case 'maybe':
        return `${base} vote-maybe border-yellow-300`;
      case 'no':
        return `${base} vote-no border-red-300`;
    }
  };

  const isPollExpired = poll.expiresAt && new Date() > new Date(poll.expiresAt);
  const canVote = poll.isActive && !isPollExpired;

  if (isLoadingMyVotes) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (showAlreadyVotedMessage) {
    const canWithdraw = poll.allowVoteWithdrawal && myVotesData?.allowVoteWithdrawal;
    return (
      <div ref={containerRef} className="space-y-6">
        <Alert className="border-green-200 bg-green-50" data-testid="alert-already-voted">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <div className="space-y-2">
              <p className="font-medium">Sie haben bereits abgestimmt!</p>
              <p className="text-sm">
                Ihre Stimme wurde erfolgreich gespeichert. Bei dieser Umfrage kann die Stimme nicht geändert werden.
              </p>
              {myVotesData?.votes && myVotesData.votes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-green-200">
                  <p className="text-sm font-medium mb-2">Ihre Antworten:</p>
                  <div className="space-y-1">
                    {myVotesData.votes.map(vote => {
                      const option = poll.options.find(o => o.id === vote.optionId);
                      return (
                        <div key={vote.optionId} className="text-sm flex items-center gap-2">
                          {vote.response === 'yes' && <Check className="w-4 h-4 text-green-600" />}
                          {vote.response === 'maybe' && <HelpCircle className="w-4 h-4 text-yellow-600" />}
                          {vote.response === 'no' && <X className="w-4 h-4 text-red-600" />}
                          <span>{option?.text || (option?.startTime ? new Date(option.startTime).toLocaleString('de-DE') : `Option ${vote.optionId}`)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {canWithdraw && (
                <div className="mt-4 pt-3 border-t border-green-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => withdrawVoteMutation.mutate()}
                    disabled={withdrawVoteMutation.isPending}
                    className="kita-button-danger-outline"
                    data-testid="button-withdraw-vote"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {withdrawVoteMutation.isPending ? 'Wird entfernt...' : 'Stimme zurückziehen'}
                  </Button>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Voter Information */}
      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Ihre Angaben</span>
            {isAdminAccess && (
              <Badge className="kita-badge-admin">
                Admin
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAdminAccess && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                Sie sind der Ersteller dieser Umfrage. Ihre Daten sind bereits vorausgefüllt. 
                Sie können optional auch selbst abstimmen.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSelfVote(!showSelfVote)}
                className="mt-2"
              >
                {showSelfVote ? 'Abstimmung verbergen' : 'Selbst abstimmen'}
              </Button>
            </div>
          )}
          
          {(showSelfVote || !isAdminAccess) && (
            <>
              <div>
                <Label htmlFor="voterName">Name *</Label>
                <Input
                  id="voterName"
                  value={voterName}
                  onChange={(e) => setVoterName(e.target.value)}
                  placeholder="Ihr Name"
                  className="mt-1"
                  disabled={!canVote}
                  data-testid="input-voter-name"
                />
              </div>
              <div>
                <Label htmlFor="voterEmail" className="flex items-center gap-2">
                  E-Mail *
                  {isUserEmailLocked && (
                    <Badge className="text-xs kita-badge-user">
                      <User className="w-3 h-3 mr-1" />
                      Angemeldet
                    </Badge>
                  )}
                </Label>
                <Input
                  id="voterEmail"
                  type="email"
                  value={voterEmail}
                  onChange={(e) => {
                    setVoterEmail(e.target.value);
                    setEmailRequiresLogin(false);
                  }}
                  onBlur={(e) => checkEmailRegistration(e.target.value)}
                  placeholder="ihre.email@beispiel.de"
                  className={`mt-1 ${emailRequiresLogin ? 'border-orange-500 focus:border-orange-500' : ''}`}
                  disabled={!canVote || isUserEmailLocked}
                  data-testid="input-voter-email"
                />
                {isCheckingEmail && (
                  <p className="text-xs text-muted-foreground mt-1">E-Mail wird überprüft...</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Login Required Alert - for registered email addresses */}
      {emailRequiresLogin && (
        <Alert className="border-orange-200 bg-orange-50" data-testid="alert-login-required">
          <LogIn className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <div className="space-y-3">
              <p>
                <strong>Anmeldung erforderlich</strong>
              </p>
              <p>
                Die E-Mail-Adresse <code className="bg-orange-100 px-1 py-0.5 rounded text-sm">{voterEmail}</code> 
                {' '}gehört zu einem registrierten Konto. Bitte melden Sie sich an, um mit dieser E-Mail-Adresse abzustimmen.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link href={`/anmelden?redirect=${encodeURIComponent(`/poll/${poll.publicToken}`)}`}>
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Jetzt anmelden
                  </Button>
                </Link>
                <span className="text-sm text-orange-700 self-center">
                  oder eine andere E-Mail-Adresse verwenden
                </span>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Duplicate Email Alert */}
      {duplicateEmailError && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <div className="space-y-3">
              <p>
                <strong>Diese E-Mail-Adresse wurde bereits verwendet.</strong>
              </p>
              <p>
                Die E-Mail-Adresse <code className="bg-amber-100 px-1 py-0.5 rounded text-sm">{duplicateEmailError}</code> 
                {' '}hat bereits bei dieser Umfrage abgestimmt. Falls Sie Ihre Stimme ändern möchten, können Sie:
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resendEmailMutation.mutate()}
                  disabled={resendEmailMutation.isPending}
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {resendEmailMutation.isPending ? 'Sende...' : 'E-Mail zum Ändern senden'}
                </Button>
                <span className="text-sm text-amber-700 self-center">
                  oder eine andere E-Mail-Adresse verwenden
                </span>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}



      {/* Voting Options */}
      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{poll.type === 'organization' ? 'Verfügbare Slots' : 'Abstimmungsoptionen'}</span>
            {!canVote && (
              <Badge variant="secondary">
                {isPollExpired ? 'Abgelaufen' : 'Inaktiv'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!canVote && (
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                {poll.type === 'organization' 
                  ? 'Diese Orga ist ' + (isPollExpired ? 'abgelaufen' : 'nicht aktiv') + ' und Eintragungen sind nicht mehr möglich.'
                  : 'Diese Umfrage ist ' + (isPollExpired ? 'abgelaufen' : 'nicht aktiv') + ' und kann nicht mehr beantwortet werden.'
                }
              </p>
            </div>
          )}
          
          {poll.type === 'organization' ? (
            canVote && (showSelfVote || !isAdminAccess) ? (
              <OrganizationSlotVoting
                options={poll.options}
                allowMultipleSlots={poll.allowMultipleSlots ?? true}
                onBookingChange={handleOrgaBookingChange}
                existingBookings={orgaBookings}
                disabled={!canVote}
                currentSignups={currentSignups}
              />
            ) : (
              <OrganizationSlotVoting
                options={poll.options}
                allowMultipleSlots={poll.allowMultipleSlots ?? true}
                onBookingChange={() => {}}
                existingBookings={[]}
                disabled={true}
                adminPreview={true}
                currentSignups={currentSignups}
              />
            )
          ) : (
            canVote && (showSelfVote || !isAdminAccess) ? (
              <SimpleImageVoting
                options={poll.options}
                onVote={(optionId, response) => handleVote(parseInt(optionId), response)}
                existingVotes={Object.fromEntries(
                  Object.entries(votes).map(([id, response]) => [id, response])
                )}
                disabled={!canVote}
                allowMaybe={poll.allowMaybe ?? true}
              />
            ) : (
              <SimpleImageVoting
                options={poll.options}
                onVote={() => {}}
                existingVotes={{}}
                disabled={true}
                adminPreview={true}
                allowMaybe={poll.allowMaybe ?? true}
              />
            )
          )}

          {canVote && (showSelfVote || !isAdminAccess) && (
            <div className="mt-6 pt-6 border-t border-border flex flex-col items-center">
              {poll.type === 'organization' ? (
                <>
                  {orgaBookings.length === 0 && !hasAlreadyVoted && (
                    <p className="text-sm text-muted-foreground mb-3 text-center">
                      Bitte wählen Sie mindestens einen Slot aus
                    </p>
                  )}
                  {hasOrgaChanges && orgaBookings.length > 0 && (
                    <p className="text-sm text-red-600 mb-3 text-center font-medium">
                      Sie haben ungespeicherte Änderungen
                    </p>
                  )}
                  <div className="flex gap-3 items-center">
                    <Button
                      onClick={handleSubmitVotes}
                      className={`px-8 ${
                        orgaBookings.length === 0 
                          ? 'bg-gray-400 hover:bg-gray-500 text-white cursor-not-allowed' 
                          : hasOrgaChanges 
                            ? 'kita-button-organization' 
                            : 'kita-button-organization'
                      }`}
                      disabled={voteMutation.isPending || !voterName.trim() || emailRequiresLogin || isCheckingEmail || orgaBookings.length === 0}
                      data-testid="button-submit-vote"
                    >
                      {voteMutation.isPending ? "Speichere..." : orgaBookings.length > 0 ? "Eintragen" : "Slot auswählen"}
                    </Button>
                    {hasAlreadyVoted && poll.allowVoteWithdrawal && (
                      <Button
                        variant="outline"
                        onClick={() => withdrawVoteMutation.mutate()}
                        disabled={withdrawVoteMutation.isPending}
                        className="px-8 kita-button-danger-outline"
                        data-testid="button-withdraw-vote-editable"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {withdrawVoteMutation.isPending ? 'Wird entfernt...' : 'Zurückziehen'}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-3 items-center w-full">
                    <Button
                      onClick={handleSubmitVotes}
                      className={`flex-1 ${
                        poll.type === 'survey' ? 'kita-button-survey' : 'kita-button-schedule'
                      }`}
                      disabled={voteMutation.isPending || !voterName.trim() || emailRequiresLogin || isCheckingEmail || Object.keys(votes).length === 0}
                      data-testid="button-submit-vote"
                    >
                      {voteMutation.isPending ? "Speichere..." : "Abstimmung abgeben"}
                    </Button>
                    {hasAlreadyVoted && poll.allowVoteWithdrawal && (
                      <Button
                        variant="outline"
                        onClick={() => withdrawVoteMutation.mutate()}
                        disabled={withdrawVoteMutation.isPending}
                        className="px-6 kita-button-danger-outline"
                        data-testid="button-withdraw-vote-editable"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {withdrawVoteMutation.isPending ? 'Wird entfernt...' : 'Zurückziehen'}
                      </Button>
                    )}
                  </div>
                </>
              )}
              {emailRequiresLogin && (
                <p className="text-sm text-orange-600 mt-2 text-center">
                  Bitte melden Sie sich an, um mit dieser E-Mail abzustimmen.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
