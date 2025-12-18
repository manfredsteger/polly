import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, Users, Calendar, BarChart3, Plus, ExternalLink, Clock, CheckCircle, Shield, ListChecks } from 'lucide-react';
import type { PollWithOptions, User, SystemSetting } from '@shared/schema';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
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
  const [, navigate] = useLocation();
  const isActive = poll.isActive && (!poll.expiresAt || new Date(poll.expiresAt) > new Date());
  const voteCount = poll.votes?.length || 0;

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
            <Badge className={
              poll.type === 'schedule' ? 'kita-badge-schedule' : 
              poll.type === 'organization' ? 'kita-badge-organization' : 
              'kita-badge-survey'
            }>
              {poll.type === 'schedule' ? (
                <><Calendar className="h-3 w-3 mr-1" />Termin</>
              ) : poll.type === 'organization' ? (
                <><ListChecks className="h-3 w-3 mr-1" />Orga</>
              ) : (
                <><ClipboardList className="h-3 w-3 mr-1" />Umfrage</>
              )}
            </Badge>
            <Badge variant={isActive ? 'default' : 'outline'} className={isActive ? 'bg-green-500' : ''}>
              {isActive ? (
                <><CheckCircle className="h-3 w-3 mr-1" />Aktiv</>
              ) : (
                <><Clock className="h-3 w-3 mr-1" />Beendet</>
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
              {voteCount} Stimme{voteCount !== 1 ? 'n' : ''}
            </span>
            <span className="flex items-center">
              <BarChart3 className="h-4 w-4 mr-1" />
              {poll.options?.length || 0} Option{(poll.options?.length || 0) !== 1 ? 'en' : ''}
            </span>
          </div>
          <span>
            {poll.createdAt && format(new Date(poll.createdAt), 'dd. MMM yyyy', { locale: de })}
          </span>
        </div>
        {poll.expiresAt && (
          <div className="mt-2 text-xs text-muted-foreground">
            Läuft ab: {format(new Date(poll.expiresAt), 'dd. MMM yyyy, HH:mm', { locale: de })}
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

function EmptyState({ type }: { type: 'created' | 'participated' }) {
  const [, navigate] = useLocation();

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        {type === 'created' ? (
          <>
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">Keine Umfragen erstellt</CardTitle>
            <CardDescription className="mb-4">
              Sie haben noch keine Umfragen erstellt. Erstellen Sie jetzt Ihre erste Umfrage!
            </CardDescription>
            <div className="flex gap-2 flex-wrap justify-center">
              <Button onClick={() => navigate('/create-poll')} className="kita-button-schedule" data-testid="button-create-poll">
                <Plus className="h-4 w-4 mr-2" />
                Termin
              </Button>
              <Button onClick={() => navigate('/create-survey')} className="kita-button-survey" data-testid="button-create-survey">
                <Plus className="h-4 w-4 mr-2" />
                Umfrage
              </Button>
              <Button onClick={() => navigate('/create-organization')} className="kita-button-organization" data-testid="button-create-orga">
                <Plus className="h-4 w-4 mr-2" />
                Orga
              </Button>
            </div>
          </>
        ) : (
          <>
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">Keine Teilnahmen</CardTitle>
            <CardDescription>
              Sie haben noch an keinen Umfragen teilgenommen.
            </CardDescription>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function MyPolls() {
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
          <h1 className="text-2xl font-bold" data-testid="title-my-polls">Meine Umfragen</h1>
          <p className="text-muted-foreground mt-1">
            Willkommen zurück, {user?.name || user?.username}!
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/create-poll')} className="kita-button-schedule" data-testid="button-new-poll">
            <Plus className="h-4 w-4 mr-2" />
            Termin
          </Button>
          <Button onClick={() => navigate('/create-survey')} className="kita-button-survey" data-testid="button-new-survey">
            <Plus className="h-4 w-4 mr-2" />
            Umfrage
          </Button>
          <Button onClick={() => navigate('/create-organization')} className="kita-button-organization" data-testid="button-new-orga">
            <Plus className="h-4 w-4 mr-2" />
            Orga
          </Button>
        </div>
      </div>

      <Tabs defaultValue="created" className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} mb-6`}>
          <TabsTrigger value="created" data-testid="tab-created">
            <ClipboardList className="h-4 w-4 mr-2" />
            Meine Umfragen
            {createdPolls && createdPolls.length > 0 && (
              <Badge variant="secondary" className="ml-2">{createdPolls.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="participated" data-testid="tab-participated">
            <Users className="h-4 w-4 mr-2" />
            Teilnahmen
            {participatedPolls && participatedPolls.length > 0 && (
              <Badge variant="secondary" className="ml-2">{participatedPolls.length}</Badge>
            )}
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="admin" data-testid="tab-admin">
              <Shield className="h-4 w-4 mr-2" />
              Administration
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
