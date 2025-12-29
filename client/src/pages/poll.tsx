import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { VotingInterface } from "@/components/VotingInterface";
import { ResultsChart } from "@/components/ResultsChart";
import { LiveResultsView } from "@/components/LiveResultsView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PollTypeBadge } from "@/components/ui/PollTypeBadge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Calendar, 
  Users, 
  User,
  Clock, 
  Share2, 
  Download, 
  QrCode,
  BarChart3,
  Settings,
  Mail,
  ListChecks,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  LogIn,
  ShieldAlert,
  StopCircle,
  MessageSquare,
  Search,
  X,
  Eye,
  EyeOff,
  BellRing,
  Radio,
  Lock
} from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { PollWithOptions, PollResults } from "@shared/schema";

const formatLocalDateTime = (dateStr: string | Date | null | undefined): string | undefined => {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return undefined;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const localToISOString = (dateStr: string | null | undefined): string | undefined => {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

export default function Poll() {
  const { t } = useTranslation();
  const { token } = useParams();
  const [location, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("vote");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [authError, setAuthError] = useState<{ type: 'unauthorized' | 'forbidden'; message: string } | null>(null);
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [endPollDialogOpen, setEndPollDialogOpen] = useState(false);
  const [endPollResultsPublic, setEndPollResultsPublic] = useState(true);
  const [endPollNotifyParticipants, setEndPollNotifyParticipants] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrCodeLoading, setQrCodeLoading] = useState(false);
  
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    isActive: true
  });
  const [editingOptions, setEditingOptions] = useState<Array<{
    id?: number;
    text: string;
    startTime?: string;
    endTime?: string;
    maxCapacity?: number;
    isNew?: boolean;
    isDeleted?: boolean;
  }>>([]);
  const [hasVotesWarningShown, setHasVotesWarningShown] = useState(false);
  
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteTab, setInviteTab] = useState<"email" | "matrix">("email");
  const [matrixSearch, setMatrixSearch] = useState("");
  
  // Reminder functionality
  const [reminderSending, setReminderSending] = useState(false);
  const [selectedMatrixUsers, setSelectedMatrixUsers] = useState<Array<{ userId: string; displayName: string | null }>>([]);
  const [matrixSearchResults, setMatrixSearchResults] = useState<Array<{ userId: string; displayName: string | null; avatarUrl: string | null }>>([]);
  const [isSearchingMatrix, setIsSearchingMatrix] = useState(false);
  
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (hash === 'results') {
      setActiveTab('results');
    }
  }, []);
  
  const isAdminAccess = location.startsWith('/admin/');
  const endpoint = isAdminAccess ? `/api/v1/polls/admin/${token}` : `/api/v1/polls/public/${token}`;

  const { data: poll, isLoading, error } = useQuery<PollWithOptions>({
    queryKey: [endpoint],
    enabled: !!token,
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 3;
    },
  });
  
  // Handle auth errors from query
  useEffect(() => {
    if (error && isAdminAccess) {
      const checkAuthError = async () => {
        const err = error as any;
        if (err.status === 401) {
          setAuthError({ type: 'unauthorized', message: t('pollView.loginRequiredMessage') });
        } else if (err.status === 403) {
          setAuthError({ type: 'forbidden', message: t('pollView.accessDeniedMessage') });
        }
      };
      checkAuthError();
    }
  }, [error, isAdminAccess, t]);

  const { data: results, error: resultsError } = useQuery<PollResults>({
    queryKey: [`/api/v1/polls/${token}/results`],
    enabled: !!token,
    refetchInterval: 5000,
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors (results are private)
      const errorMessage = error?.message || String(error);
      if (errorMessage.startsWith('403:')) {
        return false;
      }
      return failureCount < 3;
    },
  });
  
  // Check if results are private (403 error - message format is "403: {json}")
  const isResultsPrivate = resultsError && (resultsError?.message || '').startsWith('403:');
  
  useEffect(() => {
    if (poll) {
      setEditForm({
        title: poll.title,
        description: poll.description || "",
        isActive: poll.isActive
      });
      setEditingOptions(poll.options?.map(opt => ({
        id: opt.id,
        text: opt.text,
        startTime: formatLocalDateTime(opt.startTime),
        endTime: formatLocalDateTime(opt.endTime),
        maxCapacity: opt.maxCapacity ?? undefined,
      })) || []);
    }
  }, [poll]);
  
  const updatePollMutation = useMutation({
    mutationFn: async (updates: { title?: string; description?: string; isActive?: boolean; resultsPublic?: boolean }) => {
      const response = await apiRequest("PATCH", `/api/v1/polls/admin/${token}`, updates);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('pollView.toasts.saved'), description: t('pollView.toasts.changesSaved') });
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      setEditDialogOpen(false);
      setEndPollDialogOpen(false);
    },
    onError: () => {
      toast({ title: t('pollView.toasts.error'), description: t('pollView.toasts.changesNotSaved'), variant: "destructive" });
    },
  });

  const addOptionMutation = useMutation({
    mutationFn: async (option: { text: string; startTime?: string; endTime?: string; maxCapacity?: number }) => {
      const response = await apiRequest("POST", `/api/v1/polls/admin/${token}/options`, option);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
    },
  });

  const updateOptionMutation = useMutation({
    mutationFn: async ({ optionId, updates }: { optionId: number; updates: Record<string, any> }) => {
      const response = await apiRequest("PATCH", `/api/v1/polls/admin/${token}/options/${optionId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
    },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: async (optionId: number) => {
      const response = await apiRequest("DELETE", `/api/v1/polls/admin/${token}/options/${optionId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
    },
  });

  const handleSaveAllChanges = async () => {
    try {
      await updatePollMutation.mutateAsync(editForm);
      
      for (const option of editingOptions) {
        if (option.isNew && !option.isDeleted) {
          await addOptionMutation.mutateAsync({
            text: option.text,
            startTime: localToISOString(option.startTime),
            endTime: localToISOString(option.endTime),
            maxCapacity: option.maxCapacity,
          });
        } else if (option.isDeleted && option.id) {
          await deleteOptionMutation.mutateAsync(option.id);
        } else if (option.id && !option.isNew && !option.isDeleted) {
          const originalOption = poll?.options?.find(o => o.id === option.id);
          if (originalOption) {
            const updates: Record<string, any> = {};
            if (option.text !== originalOption.text) updates.text = option.text;
            const origStartTime = formatLocalDateTime(originalOption.startTime);
            const origEndTime = formatLocalDateTime(originalOption.endTime);
            if (option.startTime !== origStartTime) {
              updates.startTime = localToISOString(option.startTime);
            }
            if (option.endTime !== origEndTime) {
              updates.endTime = localToISOString(option.endTime);
            }
            if (option.maxCapacity !== (originalOption.maxCapacity ?? undefined)) {
              updates.maxCapacity = option.maxCapacity;
            }
            if (Object.keys(updates).length > 0) {
              await updateOptionMutation.mutateAsync({ optionId: option.id, updates });
            }
          }
        }
      }
      
      toast({ title: t('pollView.toasts.saved'), description: t('pollView.toasts.allChangesSaved') });
      setEditDialogOpen(false);
      setHasVotesWarningShown(false);
    } catch (error) {
      toast({ title: t('pollView.toasts.error'), description: t('pollView.toasts.someChangesNotSaved'), variant: "destructive" });
    }
  };

  const hasVotes = (poll?.votes?.length || 0) > 0;
  const uniqueVoters = new Set(poll?.votes?.map(v => v.voterEmail)).size;
  
  const sendInviteMutation = useMutation({
    mutationFn: async (data: { emails: string[]; customMessage?: string }) => {
      const response = await apiRequest("POST", `/api/v1/polls/${token}/invite`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('pollView.toasts.invitationsSent'), description: t('pollView.toasts.invitationsSentDesc') });
      setInviteDialogOpen(false);
      setInviteEmails("");
      setInviteMessage("");
    },
    onError: () => {
      toast({ title: t('pollView.toasts.error'), description: t('pollView.toasts.invitationsNotSent'), variant: "destructive" });
    },
  });

  // Matrix integration
  const { data: matrixStatus } = useQuery<{ enabled: boolean; searchEnabled: boolean }>({
    queryKey: ['/api/v1/matrix/status'],
  });

  const sendMatrixInviteMutation = useMutation({
    mutationFn: async (data: { userIds: string[]; customMessage?: string }) => {
      const response = await apiRequest("POST", `/api/v1/polls/${token}/invite/matrix`, data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: t('pollView.toasts.matrixInvitesSent'), 
        description: t('pollView.toasts.matrixInvitesSentDesc', { sent: data.sent }) + (data.failed > 0 ? ` ${t('pollView.toasts.matrixInvitesFailed', { failed: data.failed })}` : '')
      });
      setInviteDialogOpen(false);
      setSelectedMatrixUsers([]);
      setMatrixSearch("");
      setInviteMessage("");
    },
    onError: () => {
      toast({ title: t('pollView.toasts.error'), description: t('pollView.toasts.matrixInvitesNotSent'), variant: "destructive" });
    },
  });

  const searchMatrixUsers = async (term: string) => {
    if (!term || term.length < 2) {
      setMatrixSearchResults([]);
      return;
    }
    setIsSearchingMatrix(true);
    try {
      const response = await fetch(`/api/v1/matrix/users/search?q=${encodeURIComponent(term)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setMatrixSearchResults(data.results || []);
      }
    } catch (error) {
      console.error('Matrix search error:', error);
    } finally {
      setIsSearchingMatrix(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (matrixSearch) {
        searchMatrixUsers(matrixSearch);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [matrixSearch]);

  const handleAddMatrixUser = (user: { userId: string; displayName: string | null }) => {
    if (!selectedMatrixUsers.find(u => u.userId === user.userId)) {
      setSelectedMatrixUsers([...selectedMatrixUsers, user]);
    }
    setMatrixSearch("");
    setMatrixSearchResults([]);
  };

  const handleRemoveMatrixUser = (userId: string) => {
    setSelectedMatrixUsers(selectedMatrixUsers.filter(u => u.userId !== userId));
  };

  // Send reminder to all participants
  const handleSendReminder = async () => {
    if (!poll?.id) return;
    
    setReminderSending(true);
    try {
      const response = await apiRequest("POST", `/api/v1/polls/${poll.id}/send-reminder`);
      const result = await response.json();
      
      if (result.success) {
        toast({ 
          title: t('pollView.toasts.remindersSent'), 
          description: t('pollView.toasts.remindersSentDesc', { sent: result.sent })
        });
      } else {
        toast({ 
          title: t('pollView.toasts.error'), 
          description: result.error || t('pollView.toasts.remindersNotSent'), 
          variant: "destructive" 
        });
      }
    } catch (error: any) {
      let errorMessage = t('pollView.toasts.remindersNotSent');
      try {
        const errorData = await error?.json?.();
        if (errorData?.error) errorMessage = errorData.error;
      } catch {}
      toast({ title: t('pollView.toasts.error'), description: errorMessage, variant: "destructive" });
    } finally {
      setReminderSending(false);
    }
  };

  const handleSendMatrixInvites = () => {
    if (selectedMatrixUsers.length === 0) {
      toast({ title: t('pollView.toasts.error'), description: t('pollView.toasts.selectMatrixUser'), variant: "destructive" });
      return;
    }
    sendMatrixInviteMutation.mutate({ 
      userIds: selectedMatrixUsers.map(u => u.userId), 
      customMessage: inviteMessage || undefined 
    });
  };
  
  const handleCopyLink = async (link: string, type: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(type);
      toast({ title: t('pollView.toasts.copied'), description: t('pollView.toasts.linkCopied') });
      setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      toast({ title: t('pollView.toasts.error'), description: t('pollView.toasts.linkNotCopied'), variant: "destructive" });
    }
  };
  
  const fetchQrCode = async () => {
    if (!poll?.publicToken || qrCodeData) return;
    setQrCodeLoading(true);
    try {
      const response = await fetch(`/api/v1/polls/${poll.publicToken}/qr`);
      if (response.ok) {
        const data = await response.json();
        setQrCodeData(data.qrCode);
      }
    } catch (error) {
      console.error('Error fetching QR code:', error);
    } finally {
      setQrCodeLoading(false);
    }
  };
  
  useEffect(() => {
    if ((shareDialogOpen || activeTab === 'tools') && poll?.publicToken && !qrCodeData) {
      fetchQrCode();
    }
  }, [shareDialogOpen, activeTab, poll?.publicToken]);
  
  const handleSendInvites = () => {
    const emailList = inviteEmails.split(/[,;\n]/).map(e => e.trim()).filter(e => e && e.includes("@"));
    if (emailList.length === 0) {
      toast({ title: t('pollView.toasts.error'), description: t('pollView.toasts.enterValidEmail'), variant: "destructive" });
      return;
    }
    sendInviteMutation.mutate({ emails: emailList, customMessage: inviteMessage || undefined });
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="grid md:grid-cols-3 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  // Show auth error for admin access requiring login
  if (authError) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Card className="p-8">
          <CardContent className="pt-6">
            <div className="flex justify-center mb-4">
              {authError.type === 'unauthorized' ? (
                <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <LogIn className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <ShieldAlert className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-4">
              {authError.type === 'unauthorized' ? t('pollView.loginRequired') : t('pollView.accessDenied')}
            </h1>
            <p className="text-muted-foreground mb-6">
              {authError.message}
            </p>
            {authError.type === 'unauthorized' && !isAuthenticated && (
              <Link href={`/anmelden?returnTo=${encodeURIComponent(location)}`}>
                <Button className="polly-button-primary">
                  <LogIn className="w-4 h-4 mr-2" />
                  {t('pollView.loginNow')}
                </Button>
              </Link>
            )}
            {authError.type === 'forbidden' && (
              <Link href="/">
                <Button variant="outline">
                  {t('pollView.backToHome')}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Card className="p-8">
          <CardContent>
            <h1 className="text-2xl font-bold text-destructive mb-4">{t('pollView.pollNotFound')}</h1>
            <p className="text-muted-foreground">
              {t('pollView.pollNotFoundMessage')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPollExpired = poll.expiresAt && new Date() > new Date(poll.expiresAt);
  const pollTypeLabel = poll.type === 'schedule' ? t('pollView.schedulePoll') : poll.type === 'organization' ? t('pollView.orgaPoll') : t('pollView.surveyPoll');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <PollTypeBadge type={poll.type as 'schedule' | 'survey' | 'organization'} variant="solid" />
              <Badge className={poll.isActive && !isPollExpired ? 'polly-badge-active' : 'polly-badge-inactive'}>
                {poll.isActive && !isPollExpired ? t('pollView.active') : t('pollView.ended')}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{poll.title}</h1>
            {poll.description && (
              <p className="text-muted-foreground text-lg">{poll.description}</p>
            )}
          </div>
          
          {isAdminAccess && (
            <div className="flex space-x-2 ml-4">
              <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)} data-testid="button-edit-poll">
                <Settings className="w-4 h-4 mr-2" />
                {t('pollView.editPoll')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setInviteDialogOpen(true)} data-testid="button-invite">
                <Mail className="w-4 h-4 mr-2" />
                {t('pollView.inviteParticipants')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)} data-testid="button-share">
                <Share2 className="w-4 h-4 mr-2" />
                {t('pollView.share')}
              </Button>
            </div>
          )}
        </div>

        {/* Meta Information */}
        <div className="flex flex-wrap items-center text-sm text-muted-foreground mt-4 space-x-6">
          {poll.user && (
            <span className="flex items-center">
              <User className="w-4 h-4 mr-1" />
              {t('pollView.createdBy')}: {poll.user.name || poll.user.username}
            </span>
          )}
          <span className="flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            {t('pollView.created')}: {new Date(poll.createdAt).toLocaleDateString('de-DE')}
          </span>
          {poll.expiresAt && (
            <span className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              {t('pollView.expiresAt')}: {new Date(poll.expiresAt).toLocaleDateString('de-DE')}
            </span>
          )}
          {results && (
            <span className="flex items-center">
              <Users className="w-4 h-4 mr-1" />
              {results.participantCount} {t('pollView.participants')}
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="vote">{t('pollView.tabVote')}</TabsTrigger>
          <TabsTrigger value="results">{t('pollView.tabResults')}</TabsTrigger>
          <TabsTrigger value="live" className="flex items-center gap-1">
            <Radio className="w-3 h-3" />
            {t('pollView.tabLive')}
          </TabsTrigger>
          <TabsTrigger value="tools">{t('pollView.tabTools')}</TabsTrigger>
        </TabsList>

        <TabsContent value="vote" className="space-y-6">
          <VotingInterface poll={poll} isAdminAccess={isAdminAccess} />
        </TabsContent>

        <TabsContent value="live" className="space-y-6">
          <LiveResultsView 
            poll={poll} 
            publicToken={poll.publicToken}
            isAdminAccess={isAdminAccess}
          />
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {isResultsPrivate ? (
            <Card className="border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30">
              <CardContent className="p-8 text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <Lock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
                    {t('pollView.resultsNotVisible')}
                  </h3>
                  <p className="text-amber-700 dark:text-amber-300 mt-2">
                    {t('pollView.resultsPrivateMessage')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : results ? (
            <ResultsChart 
              results={results} 
              publicToken={poll.publicToken}
              isAdminAccess={isAdminAccess}
              onCapacityUpdate={isAdminAccess ? async (optionId, newCapacity) => {
                await updateOptionMutation.mutateAsync({ optionId, updates: { maxCapacity: newCapacity === null ? null : newCapacity } });
              } : undefined}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">{t('pollView.noResultsYet')}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tools" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Sharing Tools */}
            <Card className="polly-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Share2 className="w-5 h-5 mr-2 text-polly-blue" />
                  {t('pollView.share')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t('pollView.publicLink')}</label>
                  <div className="flex mt-1">
                    <Input
                      value={`${window.location.origin}/poll/${poll.publicToken}`}
                      readOnly
                      className="rounded-r-none"
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-l-none"
                      onClick={() => handleCopyLink(`${window.location.origin}/poll/${poll.publicToken}`, 'tools-public')}
                    >
                      {copiedLink === 'tools-public' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('pollView.qrCode')}</label>
                  <div className="flex justify-center p-4 bg-white rounded-lg border">
                    {qrCodeLoading ? (
                      <div className="flex items-center justify-center h-40 w-40">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : qrCodeData ? (
                      <img 
                        src={qrCodeData} 
                        alt={t('pollView.qrCodeAlt')} 
                        className="h-40 w-40"
                        data-testid="img-qr-code-tools"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-40 w-40 text-muted-foreground">
                        <QrCode className="h-12 w-12" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(`/api/v1/polls/${poll.publicToken}/qr/download?format=png`, '_blank')}
                      data-testid="button-download-png-tools"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      PNG
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(`/api/v1/polls/${poll.publicToken}/qr/download?format=svg`, '_blank')}
                      data-testid="button-download-svg-tools"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      SVG
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Export Tools */}
            <Card className="polly-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Download className="w-5 h-5 mr-2 text-green-600" />
                  {t('pollView.export')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => window.open(`/api/v1/polls/${poll.publicToken}/export/csv`, '_blank')}
                  data-testid="button-export-csv"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('pollView.exportCsv')}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => window.open(`/api/v1/polls/${poll.publicToken}/export/pdf`, '_blank')}
                  data-testid="button-export-pdf"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('pollView.exportPdf')}
                </Button>
                {poll.type === 'schedule' && (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => window.open(`/api/v1/polls/${poll.publicToken}/export/ics`, '_blank')}
                    data-testid="button-export-ics"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    {t('pollView.exportIcs')}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Admin Tools - only visible for poll owner or admin access */}
            {isAdminAccess && (
              <Card className="polly-card md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Settings className="w-5 h-5 mr-2 text-polly-orange" />
                    {t('pollView.management')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setEditDialogOpen(true)}
                      data-testid="button-edit-poll-tools"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      {t('pollView.editPoll')}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setInviteDialogOpen(true)}
                      data-testid="button-invite-tools"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      {t('pollView.inviteParticipants')}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={handleSendReminder}
                      disabled={reminderSending || !poll.votes?.length}
                      data-testid="button-send-reminder"
                    >
                      {reminderSending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <BellRing className="w-4 h-4 mr-2" />
                      )}
                      {t('pollView.remindParticipants')}
                    </Button>
                    {poll.isActive && (
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-destructive hover:text-destructive"
                        onClick={() => {
                          setEndPollResultsPublic(poll.resultsPublic !== false);
                          setEndPollNotifyParticipants(false);
                          setEndPollDialogOpen(true);
                        }}
                        disabled={updatePollMutation.isPending}
                        data-testid="button-end-poll"
                      >
                        <StopCircle className="w-4 h-4 mr-2" />
                        {t('pollView.endPoll')}
                      </Button>
                    )}
                    {!poll.isActive && (
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-green-600 hover:text-green-600"
                        onClick={() => {
                          updatePollMutation.mutate({ isActive: true });
                        }}
                        disabled={updatePollMutation.isPending}
                        data-testid="button-reactivate-poll"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {t('pollView.reactivatePoll')}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('pollView.adminLink')}: <code className="bg-muted px-1 py-0.5 rounded text-xs">{window.location.origin}/poll/{poll.adminToken}</code>
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) setHasVotesWarningShown(false);
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pollView.editDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('pollView.editDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          
          {hasVotes && !hasVotesWarningShown && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800 dark:text-amber-200">{t('pollView.hasVotesWarningTitle')}</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1" dangerouslySetInnerHTML={{ __html: t('pollView.hasVotesWarningMessage', { voters: uniqueVoters, votes: poll?.votes?.length }) }} />
                  <ul className="text-sm text-amber-700 dark:text-amber-300 mt-2 list-disc list-inside">
                    <li>{t('pollView.hasVotesWarningItem1')}</li>
                    <li>{t('pollView.hasVotesWarningItem2')}</li>
                  </ul>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50"
                    onClick={() => setHasVotesWarningShown(true)}
                  >
                    {t('pollView.understoodEdit')}
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {(!hasVotes || hasVotesWarningShown) && (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">{t('pollView.title')}</Label>
                  <Input
                    id="edit-title"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    data-testid="input-edit-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">{t('pollView.description')}</Label>
                  <Textarea
                    id="edit-description"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    data-testid="input-edit-description"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-active">{t('pollView.pollActive')}</Label>
                  <Switch
                    id="edit-active"
                    checked={editForm.isActive}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
                    data-testid="switch-edit-active"
                  />
                </div>
                
                {/* Options Management */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-medium">
                      {poll?.type === 'schedule' ? t('pollView.dates') : poll?.type === 'organization' ? t('pollView.slots') : t('pollView.options')}
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newOption = poll?.type === 'schedule' 
                          ? { text: '', startTime: '', endTime: '', isNew: true }
                          : poll?.type === 'organization'
                          ? { text: '', maxCapacity: undefined, isNew: true }
                          : { text: '', isNew: true };
                        setEditingOptions([...editingOptions, newOption]);
                      }}
                      data-testid="button-add-option"
                    >
                      + {poll?.type === 'schedule' ? t('pollView.addDate') : poll?.type === 'organization' ? t('pollView.addSlot') : t('pollView.addOption')}
                    </Button>
                  </div>
                  
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {editingOptions.filter(o => !o.isDeleted).map((option, index) => {
                      const optionVotes = option.id ? poll?.votes?.filter(v => v.optionId === option.id).length || 0 : 0;
                      
                      return (
                        <div key={option.id || `new-${index}`} className="flex items-start gap-2 p-3 border rounded-lg bg-muted/30">
                          <div className="flex-1 space-y-2">
                            {poll?.type === 'schedule' ? (
                              <>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs text-muted-foreground">{t('pollView.start')}</Label>
                                    <Input
                                      type="datetime-local"
                                      value={option.startTime || ''}
                                      onChange={(e) => {
                                        const updated = [...editingOptions];
                                        updated[index] = { ...updated[index], startTime: e.target.value };
                                        setEditingOptions(updated);
                                      }}
                                      className="text-sm"
                                      data-testid={`input-option-start-${index}`}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">{t('pollView.end')}</Label>
                                    <Input
                                      type="datetime-local"
                                      value={option.endTime || ''}
                                      onChange={(e) => {
                                        const updated = [...editingOptions];
                                        updated[index] = { ...updated[index], endTime: e.target.value };
                                        setEditingOptions(updated);
                                      }}
                                      className="text-sm"
                                      data-testid={`input-option-end-${index}`}
                                    />
                                  </div>
                                </div>
                                <Input
                                  placeholder={t('pollView.descriptionOptional')}
                                  value={option.text}
                                  onChange={(e) => {
                                    const updated = [...editingOptions];
                                    updated[index] = { ...updated[index], text: e.target.value };
                                    setEditingOptions(updated);
                                  }}
                                  className="text-sm"
                                  data-testid={`input-option-text-${index}`}
                                />
                              </>
                            ) : poll?.type === 'organization' ? (
                              <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2">
                                  <Input
                                    placeholder={t('pollView.slotName')}
                                    value={option.text}
                                    onChange={(e) => {
                                      const updated = [...editingOptions];
                                      updated[index] = { ...updated[index], text: e.target.value };
                                      setEditingOptions(updated);
                                    }}
                                    data-testid={`input-option-text-${index}`}
                                  />
                                </div>
                                <div>
                                  <Input
                                    type="number"
                                    placeholder={t('pollView.max')}
                                    min={1}
                                    value={option.maxCapacity || ''}
                                    onChange={(e) => {
                                      const updated = [...editingOptions];
                                      updated[index] = { ...updated[index], maxCapacity: e.target.value ? parseInt(e.target.value) : undefined };
                                      setEditingOptions(updated);
                                    }}
                                    data-testid={`input-option-capacity-${index}`}
                                  />
                                </div>
                              </div>
                            ) : (
                              <Input
                                placeholder={t('pollView.option')}
                                value={option.text}
                                onChange={(e) => {
                                  const updated = [...editingOptions];
                                  updated[index] = { ...updated[index], text: e.target.value };
                                  setEditingOptions(updated);
                                }}
                                data-testid={`input-option-text-${index}`}
                              />
                            )}
                            {optionVotes > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {optionVotes} {t('pollView.votesForOption')}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              const updated = [...editingOptions];
                              if (option.isNew) {
                                updated.splice(index, 1);
                              } else {
                                updated[index] = { ...updated[index], isDeleted: true };
                              }
                              setEditingOptions(updated);
                            }}
                            data-testid={`button-delete-option-${index}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                    
                    {editingOptions.filter(o => !o.isDeleted).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {t('pollView.noOptionsAvailable')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setEditDialogOpen(false);
                  setHasVotesWarningShown(false);
                  if (poll) {
                    setEditForm({
                      title: poll.title,
                      description: poll.description || "",
                      isActive: poll.isActive
                    });
                    setEditingOptions(poll.options?.map(opt => ({
                      id: opt.id,
                      text: opt.text,
                      startTime: formatLocalDateTime(opt.startTime),
                      endTime: formatLocalDateTime(opt.endTime),
                      maxCapacity: opt.maxCapacity ?? undefined,
                    })) || []);
                  }
                }}>
                  {t('common.cancel')}
                </Button>
                <Button 
                  onClick={handleSaveAllChanges}
                  disabled={updatePollMutation.isPending || addOptionMutation.isPending || deleteOptionMutation.isPending || updateOptionMutation.isPending}
                  data-testid="button-save-edit"
                >
                  {(updatePollMutation.isPending || addOptionMutation.isPending || deleteOptionMutation.isPending || updateOptionMutation.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {t('pollView.saveChanges')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('pollView.inviteDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('pollView.inviteDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          
          {matrixStatus?.enabled ? (
            <Tabs value={inviteTab} onValueChange={(v) => setInviteTab(v as "email" | "matrix")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email" data-testid="tab-invite-email">
                  <Mail className="w-4 h-4 mr-2" />
                  {t('pollView.emailTab')}
                </TabsTrigger>
                <TabsTrigger value="matrix" data-testid="tab-invite-matrix">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {t('pollView.matrixTab')}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="email" className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-emails">{t('pollView.emailAddresses')}</Label>
                  <Textarea
                    id="invite-emails"
                    value={inviteEmails}
                    onChange={(e) => setInviteEmails(e.target.value)}
                    placeholder="max@example.de, anna@example.de"
                    rows={4}
                    data-testid="input-invite-emails"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('pollView.emailAddressesHint')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-message-email">{t('pollView.customMessage')}</Label>
                  <Textarea
                    id="invite-message-email"
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder={t('pollView.customMessagePlaceholder')}
                    rows={2}
                    data-testid="input-invite-message"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    onClick={handleSendInvites}
                    disabled={sendInviteMutation.isPending || !inviteEmails.trim()}
                    data-testid="button-send-invites"
                  >
                    {sendInviteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Mail className="w-4 h-4 mr-2" />
                    {t('pollView.sendInvitations')}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="matrix" className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t('pollView.searchMatrixUsers')}</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={matrixSearch}
                      onChange={(e) => setMatrixSearch(e.target.value)}
                      placeholder={t('pollView.searchMatrixPlaceholder')}
                      className="pl-9"
                      data-testid="input-matrix-search"
                    />
                    {isSearchingMatrix && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {matrixSearchResults.length > 0 && (
                    <div className="border rounded-md max-h-40 overflow-y-auto">
                      {matrixSearchResults.map((user) => (
                        <button
                          key={user.userId}
                          onClick={() => handleAddMatrixUser(user)}
                          className="w-full flex items-center gap-3 p-2 hover:bg-muted text-left"
                          data-testid={`matrix-user-${user.userId}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {user.displayName || user.userId}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{user.userId}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {selectedMatrixUsers.length > 0 && (
                  <div className="space-y-2">
                    <Label>{t('pollView.selectedParticipants')} ({selectedMatrixUsers.length})</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedMatrixUsers.map((user) => (
                        <Badge 
                          key={user.userId} 
                          variant="secondary"
                          className="flex items-center gap-1 pr-1"
                        >
                          <span className="truncate max-w-[150px]">
                            {user.displayName || user.userId}
                          </span>
                          <button
                            onClick={() => handleRemoveMatrixUser(user.userId)}
                            className="ml-1 hover:bg-muted rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="invite-message-matrix">{t('pollView.customMessage')}</Label>
                  <Textarea
                    id="invite-message-matrix"
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder={t('pollView.customMessagePlaceholder')}
                    rows={2}
                    data-testid="input-invite-message-matrix"
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    onClick={handleSendMatrixInvites}
                    disabled={sendMatrixInviteMutation.isPending || selectedMatrixUsers.length === 0}
                    data-testid="button-send-matrix-invites"
                  >
                    {sendMatrixInviteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <MessageSquare className="w-4 h-4 mr-2" />
                    {t('pollView.sendChatInvitations')}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invite-emails">{t('pollView.emailAddresses')}</Label>
                <Textarea
                  id="invite-emails"
                  value={inviteEmails}
                  onChange={(e) => setInviteEmails(e.target.value)}
                  placeholder="max@example.de, anna@example.de"
                  rows={4}
                  data-testid="input-invite-emails"
                />
                <p className="text-xs text-muted-foreground">
                  {t('pollView.emailAddressesHint')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-message">{t('pollView.customMessage')}</Label>
                <Textarea
                  id="invite-message"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder={t('pollView.customMessagePlaceholder')}
                  rows={3}
                  data-testid="input-invite-message"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button 
                  onClick={handleSendInvites}
                  disabled={sendInviteMutation.isPending || !inviteEmails.trim()}
                  data-testid="button-send-invites"
                >
                  {sendInviteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Mail className="w-4 h-4 mr-2" />
                  {t('pollView.sendInvitations')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('pollView.shareDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('pollView.shareDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('pollView.publicLinkForParticipants')}</Label>
              <div className="flex">
                <Input
                  value={`${window.location.origin}/poll/${poll.publicToken}`}
                  readOnly
                  className="rounded-r-none"
                />
                <Button 
                  variant="outline" 
                  className="rounded-l-none"
                  onClick={() => handleCopyLink(`${window.location.origin}/poll/${poll.publicToken}`, 'public')}
                >
                  {copiedLink === 'public' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            {isAdminAccess && (
              <div className="space-y-2">
                <Label>{t('pollView.adminLinkForYou')}</Label>
                <div className="flex">
                  <Input
                    value={`${window.location.origin}/admin/${token}`}
                    readOnly
                    className="rounded-r-none"
                  />
                  <Button 
                    variant="outline" 
                    className="rounded-l-none"
                    onClick={() => handleCopyLink(`${window.location.origin}/admin/${token}`, 'admin')}
                  >
                    {copiedLink === 'admin' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('pollView.adminLinkWarning')}
                </p>
              </div>
            )}
            <div className="space-y-3 pt-2">
              <Label>{t('pollView.qrCode')}</Label>
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                {qrCodeLoading ? (
                  <div className="flex items-center justify-center h-40 w-40">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : qrCodeData ? (
                  <img 
                    src={qrCodeData} 
                    alt={t('pollView.qrCodeAlt')} 
                    className="h-40 w-40"
                    data-testid="img-qr-code"
                  />
                ) : (
                  <div className="flex items-center justify-center h-40 w-40 text-muted-foreground">
                    <QrCode className="h-12 w-12" />
                  </div>
                )}
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {t('pollView.qrCodeHint')}
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => window.open(`/api/v1/polls/${poll.publicToken}/qr/download?format=png`, '_blank')}
                  data-testid="button-download-png"
                >
                  <Download className="w-4 h-4 mr-2" />
                  PNG
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => window.open(`/api/v1/polls/${poll.publicToken}/qr/download?format=svg`, '_blank')}
                  data-testid="button-download-svg"
                >
                  <Download className="w-4 h-4 mr-2" />
                  SVG
                </Button>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.open(`${window.location.origin}/poll/${poll.publicToken}`, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {t('pollView.openPoll')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* End Poll Dialog */}
      <Dialog open={endPollDialogOpen} onOpenChange={setEndPollDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <StopCircle className="w-5 h-5 mr-2 text-destructive" />
              {t('pollView.endPollDialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('pollView.endPollDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center space-x-3">
                {endPollResultsPublic ? (
                  <Eye className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <EyeOff className="w-5 h-5 text-muted-foreground" />
                )}
                <div>
                  <Label className="font-medium">{t('pollView.resultsPublic')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {endPollResultsPublic 
                      ? t('pollView.resultsPublicYes') 
                      : t('pollView.resultsPublicNo')}
                  </p>
                </div>
              </div>
              <Switch
                checked={endPollResultsPublic}
                onCheckedChange={setEndPollResultsPublic}
                data-testid="switch-end-poll-results-public"
              />
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center space-x-3">
                <BellRing className="w-5 h-5 text-muted-foreground" />
                <div>
                  <Label className="font-medium">{t('pollView.notifyParticipants')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {endPollNotifyParticipants 
                      ? t('pollView.notifyParticipantsYes') 
                      : t('pollView.notifyParticipantsNo')}
                  </p>
                </div>
              </div>
              <Switch
                checked={endPollNotifyParticipants}
                onCheckedChange={setEndPollNotifyParticipants}
                data-testid="switch-end-poll-notify"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEndPollDialogOpen(false)}
              data-testid="button-cancel-end-poll"
            >
              {t('common.cancel')}
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                updatePollMutation.mutate({ 
                  isActive: false, 
                  resultsPublic: endPollResultsPublic 
                });
              }}
              disabled={updatePollMutation.isPending}
              data-testid="button-confirm-end-poll"
            >
              {updatePollMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('pollView.endingPoll')}
                </>
              ) : (
                <>
                  <StopCircle className="w-4 h-4 mr-2" />
                  {t('pollView.endPoll')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
