import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PollTypeBadge } from '@/components/ui/PollTypeBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, Users, Calendar, BarChart3, Plus, ExternalLink, Clock, CheckCircle, Shield, ListChecks, Copy, Check, RefreshCw, Info, ChevronDown } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { PollWithOptions, User, SystemSetting } from '@shared/schema';
import { format } from 'date-fns';
import { getDateLocale } from '@/lib/i18n';
import { AdminDashboard } from '@/components/AdminDashboard';

interface ExtendedStats {
  totalUsers: number;
  activePolls: number;
  inactivePolls: number;
  totalPolls: number;
  totalVotes: number;
  monthlyPolls: number;
  weeklyPolls: number;
  todayPolls: number;
  schedulePolls: number;
  surveyPolls: number;
  recentActivity: Array<{
    type: string;
    message: string;
    timestamp: string;
    actor?: string;
  }>;
}

function PollCard({ poll, showAdminLink = false }: { poll: PollWithOptions; showAdminLink?: boolean }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const isActive = poll.isActive && (!poll.expiresAt || new Date(poll.expiresAt) > new Date());
  const voteCount = poll.votes?.length || 0;
  const optionCount = poll.options?.length || 0;

  return (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate(showAdminLink ? `/admin/${poll.adminToken}` : `/poll/${poll.publicToken}`)}
      data-testid={`poll-card-${poll.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg line-clamp-1">{poll.title}</CardTitle>
            {poll.description && (
              <CardDescription className="line-clamp-2 mt-1">
                {poll.description}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2">
            <PollTypeBadge type={poll.type as 'schedule' | 'survey' | 'organization'} variant="solid" />
            <Badge className={isActive ? 'polly-badge-active' : 'polly-badge-inactive'}>
              {isActive ? (
                <><CheckCircle className="h-3 w-3 mr-1" />{t('myPolls.active')}</>
              ) : (
                <><Clock className="h-3 w-3 mr-1" />{t('myPolls.ended')}</>
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center">
              <Users className="h-4 w-4 mr-1" />
              {voteCount} {voteCount !== 1 ? t('myPolls.votes') : t('myPolls.vote')}
            </span>
            <span className="flex items-center">
              <BarChart3 className="h-4 w-4 mr-1" />
              {optionCount} {optionCount !== 1 ? t('myPolls.options') : t('myPolls.option')}
            </span>
          </div>
          <span>
            {poll.createdAt && format(new Date(poll.createdAt), 'dd. MMM yyyy', { locale: getDateLocale() })}
          </span>
        </div>
        {poll.expiresAt && (
          <div className="mt-2 text-xs text-muted-foreground">
            {t('myPolls.expiresAt')}: {format(new Date(poll.expiresAt), 'dd. MMM yyyy, HH:mm', { locale: getDateLocale() })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PollListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface CalendarTokenResponse {
  calendarToken: string;
  webcalUrl: string;
  httpsUrl: string;
}

function CalendarSubscriptionCard({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const { data: calendarData, isLoading } = useQuery<CalendarTokenResponse>({
    queryKey: ['/api/v1/calendar/token'],
    staleTime: 1000 * 60 * 60,
    enabled,
  });

  const regenerateMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/v1/calendar/token/regenerate'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/calendar/token'] });
      toast({
        title: t('myPolls.toasts.tokenRegenerated'),
        description: t('myPolls.toasts.tokenRegeneratedDesc'),
      });
    },
    onError: () => {
      toast({
        title: t('myPolls.toasts.error'),
        description: t('myPolls.toasts.tokenNotRegenerated'),
        variant: 'destructive',
      });
    },
  });

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: t('myPolls.toasts.copied'),
        description: t('myPolls.toasts.linkCopied'),
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: t('myPolls.toasts.error'),
        description: t('myPolls.toasts.linkNotCopied'),
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-6">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-polly-orange" />
                {t('myPolls.calendarSubscription')}
              </CardTitle>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            <CardDescription>
              {t('myPolls.calendarSubscriptionDesc')}
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  {t('myPolls.calendarInfo')}
                </p>
              </div>
              
              {calendarData && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('myPolls.subscriptionLink')}</label>
                    <div className="flex gap-2">
                      <code className="flex-1 bg-background border rounded px-3 py-2 text-xs overflow-hidden text-ellipsis whitespace-nowrap">
                        {calendarData.webcalUrl}
                      </code>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(calendarData.webcalUrl)}
                        data-testid="button-copy-calendar-url"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(calendarData.webcalUrl, '_blank')}
                      data-testid="button-open-calendar"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      {t('myPolls.openInCalendar')}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => regenerateMutation.mutate()}
                      disabled={regenerateMutation.isPending}
                      data-testid="button-regenerate-token"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
                      {t('myPolls.regenerateToken')}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function EmptyState({ type }: { type: 'created' | 'participated' }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        {type === 'created' ? (
          <>
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">{t('myPolls.emptyCreated')}</CardTitle>
            <CardDescription className="mb-4">
              {t('myPolls.emptyCreatedDesc')}
            </CardDescription>
            <div className="flex gap-2 flex-wrap justify-center">
              <Button onClick={() => navigate('/create-poll')} className="polly-button-schedule" data-testid="button-create-poll">
                <Plus className="h-4 w-4 mr-2" />
                {t('myPolls.newSchedule')}
              </Button>
              <Button onClick={() => navigate('/create-survey')} className="polly-button-survey" data-testid="button-create-survey">
                <Plus className="h-4 w-4 mr-2" />
                {t('myPolls.newSurvey')}
              </Button>
              <Button onClick={() => navigate('/create-organization')} className="polly-button-organization" data-testid="button-create-orga">
                <Plus className="h-4 w-4 mr-2" />
                {t('myPolls.newOrga')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">{t('myPolls.emptyParticipated')}</CardTitle>
            <CardDescription>
              {t('myPolls.emptyParticipatedDesc')}
            </CardDescription>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function MyPolls() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading: authLoading, isAuthReady } = useAuth();
  const [, navigate] = useLocation();

  const isAdmin = user?.role === 'admin';

  // SECURITY: Only enable queries when auth is verified and ready
  // This prevents showing cached data from a previous user session
  const queriesEnabled = isAuthenticated && isAuthReady;

  const { data: createdPolls, isLoading: createdLoading } = useQuery<PollWithOptions[]>({
    queryKey: ['/api/v1/user/polls'],
    enabled: queriesEnabled,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: participatedPolls, isLoading: participatedLoading } = useQuery<PollWithOptions[]>({
    queryKey: ['/api/v1/user/participations'],
    enabled: queriesEnabled,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: adminStats } = useQuery<ExtendedStats>({
    queryKey: ['/api/v1/admin/extended-stats'],
    enabled: queriesEnabled && isAdmin,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: adminUsers } = useQuery<User[]>({
    queryKey: ['/api/v1/admin/users'],
    enabled: queriesEnabled && isAdmin,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: adminPolls } = useQuery<PollWithOptions[]>({
    queryKey: ['/api/v1/admin/polls'],
    enabled: queriesEnabled && isAdmin,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: adminSettings } = useQuery<SystemSetting[]>({
    queryKey: ['/api/v1/admin/settings'],
    enabled: queriesEnabled && isAdmin,
    staleTime: 0,
    gcTime: 0,
  });

  // Show loading state until auth is fully verified
  if (authLoading || !isAuthReady) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Skeleton className="h-10 w-48 mb-6" />
        <PollListSkeleton />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate('/anmelden');
    return null;
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="title-my-polls">{t('myPolls.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('myPolls.welcomeBack', { name: user?.name || user?.username })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/create-poll')} className="polly-button-schedule" data-testid="button-new-poll">
            <Plus className="h-4 w-4 mr-2" />
            {t('myPolls.newSchedule')}
          </Button>
          <Button onClick={() => navigate('/create-survey')} className="polly-button-survey" data-testid="button-new-survey">
            <Plus className="h-4 w-4 mr-2" />
            {t('myPolls.newSurvey')}
          </Button>
          <Button onClick={() => navigate('/create-organization')} className="polly-button-organization" data-testid="button-new-orga">
            <Plus className="h-4 w-4 mr-2" />
            {t('myPolls.newOrga')}
          </Button>
        </div>
      </div>

      <CalendarSubscriptionCard enabled={queriesEnabled} />

      <Tabs defaultValue="created" className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} mb-6`}>
          <TabsTrigger value="created" data-testid="tab-created">
            <ClipboardList className="h-4 w-4 mr-2" />
            {t('myPolls.tabCreated')}
            {createdPolls && createdPolls.length > 0 && (
              <Badge variant="secondary" className="ml-2">{createdPolls.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="participated" data-testid="tab-participated">
            <Users className="h-4 w-4 mr-2" />
            {t('myPolls.tabParticipated')}
            {participatedPolls && participatedPolls.length > 0 && (
              <Badge variant="secondary" className="ml-2">{participatedPolls.length}</Badge>
            )}
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="admin" data-testid="tab-admin">
              <Shield className="h-4 w-4 mr-2" />
              {t('myPolls.tabAdmin')}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="created">
          {createdLoading ? (
            <PollListSkeleton />
          ) : createdPolls && createdPolls.length > 0 ? (
            <div className="space-y-4">
              {createdPolls.map((poll) => (
                <PollCard key={poll.id} poll={poll} showAdminLink />
              ))}
            </div>
          ) : (
            <EmptyState type="created" />
          )}
        </TabsContent>

        <TabsContent value="participated">
          {participatedLoading ? (
            <PollListSkeleton />
          ) : participatedPolls && participatedPolls.length > 0 ? (
            <div className="space-y-4">
              {participatedPolls.map((poll) => (
                <PollCard key={poll.id} poll={poll} />
              ))}
            </div>
          ) : (
            <EmptyState type="participated" />
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="admin" className="mt-0">
            <AdminDashboard 
              stats={adminStats}
              users={adminUsers}
              polls={adminPolls}
              settings={adminSettings}
              userRole="admin"
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
