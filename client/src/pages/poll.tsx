import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
          setAuthError({ type: 'unauthorized', message: 'Diese Umfrage wurde von einem registrierten Benutzer erstellt. Bitte melden Sie sich an, um die Administrationsseite aufzurufen.' });
        } else if (err.status === 403) {
          setAuthError({ type: 'forbidden', message: 'Sie können nur Ihre eigenen Umfragen verwalten.' });
        }
      };
      checkAuthError();
    }
  }, [error, isAdminAccess]);

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
      toast({ title: "Gespeichert", description: "Die Änderungen wurden gespeichert." });
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      setEditDialogOpen(false);
      setEndPollDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Fehler", description: "Die Änderungen konnten nicht gespeichert werden.", variant: "destructive" });
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
      
      toast({ title: "Gespeichert", description: "Alle Änderungen wurden gespeichert." });
      setEditDialogOpen(false);
      setHasVotesWarningShown(false);
    } catch (error) {
      toast({ title: "Fehler", description: "Einige Änderungen konnten nicht gespeichert werden.", variant: "destructive" });
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
      toast({ title: "Einladungen gesendet", description: "Die Einladungen wurden erfolgreich versendet." });
      setInviteDialogOpen(false);
      setInviteEmails("");
      setInviteMessage("");
    },
    onError: () => {
      toast({ title: "Fehler", description: "Die Einladungen konnten nicht gesendet werden.", variant: "destructive" });
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
        title: "Matrix-Einladungen gesendet", 
        description: `${data.sent} Einladung(en) erfolgreich gesendet.${data.failed > 0 ? ` ${data.failed} fehlgeschlagen.` : ''}`
      });
      setInviteDialogOpen(false);
      setSelectedMatrixUsers([]);
      setMatrixSearch("");
      setInviteMessage("");
    },
    onError: () => {
      toast({ title: "Fehler", description: "Die Matrix-Einladungen konnten nicht gesendet werden.", variant: "destructive" });
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
          title: "Erinnerungen gesendet", 
          description: `${result.sent} Erinnerung(en) erfolgreich versendet.`
        });
      } else {
        toast({ 
          title: "Fehler", 
          description: result.error || "Erinnerungen konnten nicht gesendet werden.", 
          variant: "destructive" 
        });
      }
    } catch (error: any) {
      let errorMessage = "Erinnerungen konnten nicht gesendet werden.";
      try {
        const errorData = await error?.json?.();
        if (errorData?.error) errorMessage = errorData.error;
      } catch {}
      toast({ title: "Fehler", description: errorMessage, variant: "destructive" });
    } finally {
      setReminderSending(false);
    }
  };

  const handleSendMatrixInvites = () => {
    if (selectedMatrixUsers.length === 0) {
      toast({ title: "Fehler", description: "Bitte wählen Sie mindestens einen Matrix-Benutzer aus.", variant: "destructive" });
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
      toast({ title: "Kopiert", description: "Link wurde in die Zwischenablage kopiert." });
      setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      toast({ title: "Fehler", description: "Link konnte nicht kopiert werden.", variant: "destructive" });
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
      toast({ title: "Fehler", description: "Bitte geben Sie mindestens eine gültige E-Mail-Adresse ein.", variant: "destructive" });
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
              {authError.type === 'unauthorized' ? 'Anmeldung erforderlich' : 'Zugriff verweigert'}
            </h1>
            <p className="text-muted-foreground mb-6">
              {authError.message}
            </p>
            {authError.type === 'unauthorized' && !isAuthenticated && (
              <Link href={`/anmelden?returnTo=${encodeURIComponent(location)}`}>
                <Button className="polly-button-primary">
                  <LogIn className="w-4 h-4 mr-2" />
                  Jetzt anmelden
                </Button>
              </Link>
            )}
            {authError.type === 'forbidden' && (
              <Link href="/">
                <Button variant="outline">
                  Zur Startseite
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
            <h1 className="text-2xl font-bold text-destructive mb-4">Umfrage nicht gefunden</h1>
            <p className="text-muted-foreground">
              Die angeforderte Umfrage existiert nicht oder ist nicht mehr verfügbar.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPollExpired = poll.expiresAt && new Date() > new Date(poll.expiresAt);
  const pollTypeLabel = poll.type === 'schedule' ? 'Terminumfrage' : poll.type === 'organization' ? 'Orga' : 'Umfrage';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <PollTypeBadge type={poll.type as 'schedule' | 'survey' | 'organization'} variant="solid" />
              <Badge className={poll.isActive && !isPollExpired ? 'polly-badge-active' : 'polly-badge-inactive'}>
                {poll.isActive && !isPollExpired ? 'Aktiv' : 'Beendet'}
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
                Bearbeiten
              </Button>
              <Button variant="outline" size="sm" onClick={() => setInviteDialogOpen(true)} data-testid="button-invite">
                <Mail className="w-4 h-4 mr-2" />
                Einladen
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)} data-testid="button-share">
                <Share2 className="w-4 h-4 mr-2" />
                Teilen
              </Button>
            </div>
          )}
        </div>

        {/* Meta Information */}
        <div className="flex flex-wrap items-center text-sm text-muted-foreground mt-4 space-x-6">
          {poll.user && (
            <span className="flex items-center">
              <User className="w-4 h-4 mr-1" />
              Erstellt von: {poll.user.name || poll.user.username}
            </span>
          )}
          <span className="flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            Erstellt: {new Date(poll.createdAt).toLocaleDateString('de-DE')}
          </span>
          {poll.expiresAt && (
            <span className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              Läuft ab: {new Date(poll.expiresAt).toLocaleDateString('de-DE')}
            </span>
          )}
          {results && (
            <span className="flex items-center">
              <Users className="w-4 h-4 mr-1" />
              {results.participantCount} Teilnehmer
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="vote">Abstimmung</TabsTrigger>
          <TabsTrigger value="results">Ergebnisse</TabsTrigger>
          <TabsTrigger value="live" className="flex items-center gap-1">
            <Radio className="w-3 h-3" />
            Live
          </TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
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
                    Ergebnisse nicht sichtbar
                  </h3>
                  <p className="text-amber-700 dark:text-amber-300 mt-2">
                    Die Ergebnisse dieser Umfrage sind nur für den Ersteller sichtbar.
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
                <p className="text-muted-foreground">Noch keine Abstimmungsergebnisse verfügbar.</p>
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
                  Teilen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Öffentlicher Link</label>
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
                  <label className="text-sm font-medium">QR-Code</label>
                  <div className="flex justify-center p-4 bg-white rounded-lg border">
                    {qrCodeLoading ? (
                      <div className="flex items-center justify-center h-40 w-40">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : qrCodeData ? (
                      <img 
                        src={qrCodeData} 
                        alt="QR-Code für Umfrage" 
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
                  Export
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
                  CSV exportieren
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => window.open(`/api/v1/polls/${poll.publicToken}/export/pdf`, '_blank')}
                  data-testid="button-export-pdf"
                >
                  <Download className="w-4 h-4 mr-2" />
                  PDF-Bericht erstellen
                </Button>
                {poll.type === 'schedule' && (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => window.open(`/api/v1/polls/${poll.publicToken}/export/ics`, '_blank')}
                    data-testid="button-export-ics"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Kalender-Datei (ICS)
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
                    Verwaltung
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
                      Umfrage bearbeiten
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setInviteDialogOpen(true)}
                      data-testid="button-invite-tools"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Teilnehmer einladen
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
                      Teilnehmer erinnern
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
                        Umfrage beenden
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
                        Umfrage reaktivieren
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Admin-Link: <code className="bg-muted px-1 py-0.5 rounded text-xs">{window.location.origin}/poll/{poll.adminToken}</code>
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
            <DialogTitle>Umfrage bearbeiten</DialogTitle>
            <DialogDescription>
              Ändern Sie die Einstellungen und Optionen dieser Umfrage.
            </DialogDescription>
          </DialogHeader>
          
          {hasVotes && !hasVotesWarningShown && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800 dark:text-amber-200">Achtung: Umfrage hat bereits Stimmen</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Diese Umfrage hat bereits <strong>{uniqueVoters} Teilnehmer</strong> mit <strong>{poll?.votes?.length} Stimmen</strong>. 
                    Änderungen an den Optionen können die Ergebnisse beeinflussen.
                  </p>
                  <ul className="text-sm text-amber-700 dark:text-amber-300 mt-2 list-disc list-inside">
                    <li>Das Löschen einer Option entfernt auch alle zugehörigen Stimmen</li>
                    <li>Neue Optionen haben noch keine Stimmen</li>
                  </ul>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50"
                    onClick={() => setHasVotesWarningShown(true)}
                  >
                    Verstanden, trotzdem bearbeiten
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {(!hasVotes || hasVotesWarningShown) && (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Titel</Label>
                  <Input
                    id="edit-title"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    data-testid="input-edit-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Beschreibung</Label>
                  <Textarea
                    id="edit-description"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    data-testid="input-edit-description"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-active">Umfrage aktiv</Label>
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
                      {poll?.type === 'schedule' ? 'Termine' : poll?.type === 'organization' ? 'Slots' : 'Optionen'}
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
                      + {poll?.type === 'schedule' ? 'Termin hinzufügen' : poll?.type === 'organization' ? 'Slot hinzufügen' : 'Option hinzufügen'}
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
                                    <Label className="text-xs text-muted-foreground">Start</Label>
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
                                    <Label className="text-xs text-muted-foreground">Ende</Label>
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
                                  placeholder="Beschreibung (optional)"
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
                                    placeholder="Slot-Name"
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
                                    placeholder="Max"
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
                                placeholder="Option"
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
                                {optionVotes} Stimme(n) für diese Option
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
                        Keine Optionen vorhanden. Fügen Sie mindestens eine Option hinzu.
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
                  Abbrechen
                </Button>
                <Button 
                  onClick={handleSaveAllChanges}
                  disabled={updatePollMutation.isPending || addOptionMutation.isPending || deleteOptionMutation.isPending || updateOptionMutation.isPending}
                  data-testid="button-save-edit"
                >
                  {(updatePollMutation.isPending || addOptionMutation.isPending || deleteOptionMutation.isPending || updateOptionMutation.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Alle Änderungen speichern
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
            <DialogTitle>Teilnehmer einladen</DialogTitle>
            <DialogDescription>
              Senden Sie Einladungen per E-Mail oder Matrix-Chat.
            </DialogDescription>
          </DialogHeader>
          
          {matrixStatus?.enabled ? (
            <Tabs value={inviteTab} onValueChange={(v) => setInviteTab(v as "email" | "matrix")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email" data-testid="tab-invite-email">
                  <Mail className="w-4 h-4 mr-2" />
                  E-Mail
                </TabsTrigger>
                <TabsTrigger value="matrix" data-testid="tab-invite-matrix">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Matrix Chat
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="email" className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-emails">E-Mail-Adressen</Label>
                  <Textarea
                    id="invite-emails"
                    value={inviteEmails}
                    onChange={(e) => setInviteEmails(e.target.value)}
                    placeholder="max@example.de, anna@example.de&#10;Oder eine Adresse pro Zeile..."
                    rows={4}
                    data-testid="input-invite-emails"
                  />
                  <p className="text-xs text-muted-foreground">
                    Trennen Sie mehrere Adressen mit Komma, Semikolon oder Zeilenumbruch.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-message-email">Persönliche Nachricht (optional)</Label>
                  <Textarea
                    id="invite-message-email"
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder="Liebe Kollegen, bitte stimmt ab..."
                    rows={2}
                    data-testid="input-invite-message"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button 
                    onClick={handleSendInvites}
                    disabled={sendInviteMutation.isPending || !inviteEmails.trim()}
                    data-testid="button-send-invites"
                  >
                    {sendInviteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Mail className="w-4 h-4 mr-2" />
                    Einladungen senden
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="matrix" className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Matrix-Benutzer suchen</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={matrixSearch}
                      onChange={(e) => setMatrixSearch(e.target.value)}
                      placeholder="Name oder @user:matrix.example.com eingeben..."
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
                    <Label>Ausgewählte Teilnehmer ({selectedMatrixUsers.length})</Label>
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
                  <Label htmlFor="invite-message-matrix">Persönliche Nachricht (optional)</Label>
                  <Textarea
                    id="invite-message-matrix"
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder="Liebe Kollegen, bitte stimmt ab..."
                    rows={2}
                    data-testid="input-invite-message-matrix"
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button 
                    onClick={handleSendMatrixInvites}
                    disabled={sendMatrixInviteMutation.isPending || selectedMatrixUsers.length === 0}
                    data-testid="button-send-matrix-invites"
                  >
                    {sendMatrixInviteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Chat-Einladungen senden
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invite-emails">E-Mail-Adressen</Label>
                <Textarea
                  id="invite-emails"
                  value={inviteEmails}
                  onChange={(e) => setInviteEmails(e.target.value)}
                  placeholder="max@example.de, anna@example.de&#10;Oder eine Adresse pro Zeile..."
                  rows={4}
                  data-testid="input-invite-emails"
                />
                <p className="text-xs text-muted-foreground">
                  Trennen Sie mehrere Adressen mit Komma, Semikolon oder Zeilenumbruch.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-message">Persönliche Nachricht (optional)</Label>
                <Textarea
                  id="invite-message"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Liebe Kollegen, bitte stimmt ab..."
                  rows={3}
                  data-testid="input-invite-message"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button 
                  onClick={handleSendInvites}
                  disabled={sendInviteMutation.isPending || !inviteEmails.trim()}
                  data-testid="button-send-invites"
                >
                  {sendInviteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Mail className="w-4 h-4 mr-2" />
                  Einladungen senden
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
            <DialogTitle>Umfrage teilen</DialogTitle>
            <DialogDescription>
              Teilen Sie diese Umfrage mit Ihrem Team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Öffentlicher Link (für Teilnehmer)</Label>
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
                <Label>Admin-Link (nur für Sie)</Label>
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
                  Teilen Sie diesen Link nicht öffentlich - er ermöglicht die Verwaltung der Umfrage.
                </p>
              </div>
            )}
            <div className="space-y-3 pt-2">
              <Label>QR-Code</Label>
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                {qrCodeLoading ? (
                  <div className="flex items-center justify-center h-40 w-40">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : qrCodeData ? (
                  <img 
                    src={qrCodeData} 
                    alt="QR-Code für Umfrage" 
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
                Scannen Sie den QR-Code oder nutzen Sie die Download-Buttons
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
              Umfrage öffnen
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
              Umfrage beenden
            </DialogTitle>
            <DialogDescription>
              Die Teilnehmer können nach dem Beenden nicht mehr abstimmen. Sie können die Umfrage später wieder aktivieren.
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
                  <Label className="font-medium">Ergebnisse öffentlich</Label>
                  <p className="text-sm text-muted-foreground">
                    {endPollResultsPublic 
                      ? 'Alle Teilnehmer können die Ergebnisse sehen' 
                      : 'Nur Sie können die Ergebnisse sehen'}
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
                  <Label className="font-medium">Teilnehmer benachrichtigen</Label>
                  <p className="text-sm text-muted-foreground">
                    {endPollNotifyParticipants 
                      ? 'Teilnehmer per E-Mail über das Ende informieren' 
                      : 'Keine Benachrichtigung senden'}
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
              Abbrechen
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
                  Wird beendet...
                </>
              ) : (
                <>
                  <StopCircle className="w-4 h-4 mr-2" />
                  Umfrage beenden
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
