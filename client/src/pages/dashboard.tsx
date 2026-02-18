import { useQuery } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { 
  Plus, 
  Calendar, 
  Vote, 
  Users, 
  BarChart3, 
  Clock, 
  Share2, 
  Edit,
  Trash2,
  TrendingUp,
  Activity
} from "lucide-react";
import type { PollWithOptions } from "@shared/schema";

// Mock user ID - in real app this would come from auth context
const CURRENT_USER_ID = 1;

interface DashboardData {
  userPolls: PollWithOptions[];
  sharedPolls: PollWithOptions[];
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: [`/api/v1/users/${CURRENT_USER_ID}/dashboard`],
  });

  const { data: stats } = useQuery({
    queryKey: [`/api/v1/admin/stats`],
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <Skeleton className="h-8 w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const userPolls = dashboardData?.userPolls || [];
  const sharedPolls = dashboardData?.sharedPolls || [];

  const activePolls = userPolls.filter((poll: PollWithOptions) => 
    poll.isActive && (!poll.expiresAt || new Date() < new Date(poll.expiresAt))
  ).length;

  const totalVotes = userPolls.reduce((sum: number, poll: PollWithOptions) => 
    sum + poll.votes.length, 0
  );

  const thisWeekPolls = userPolls.filter((poll: PollWithOptions) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(poll.createdAt) > weekAgo;
  }).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('nav.dashboard')}</h1>
            <p className="text-muted-foreground mt-2">
              {t('dashboard.managePolls')}
            </p>
          </div>
          <div className="flex space-x-3">
            <Link href="/create-poll">
              <Button className="polly-button-primary">
                <Plus className="w-4 h-4 mr-2" />
                {t('dashboard.schedule')}
              </Button>
            </Link>
            <Link href="/create-survey">
              <Button className="polly-button-secondary">
                <Plus className="w-4 h-4 mr-2" />
                {t('polls.survey')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="polly-gradient-orange text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">{t('dashboard.activePolls')}</p>
                <p className="text-2xl font-bold">{activePolls}</p>
              </div>
              <Activity className="w-8 h-8 text-orange-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="polly-gradient-blue text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">{t('dashboard.totalPolls')}</p>
                <p className="text-2xl font-bold">{userPolls.length}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">{t('dashboard.participations')}</p>
                <p className="text-2xl font-bold">{totalVotes}</p>
              </div>
              <Users className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">{t('dashboard.thisWeek')}</p>
                <p className="text-2xl font-bold">{thisWeekPolls}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="my-polls" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="my-polls">
            {t('nav.myPolls')} ({userPolls.length})
          </TabsTrigger>
          <TabsTrigger value="shared-polls">
            {t('dashboard.sharedPolls')} ({sharedPolls.length})
          </TabsTrigger>
          <TabsTrigger value="archived">
            {t('dashboard.archive')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-polls" className="space-y-4">
          {userPolls.length === 0 ? (
            <Card className="polly-card">
              <CardContent className="p-8 text-center">
                <Vote className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t('polls.noPolls')}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {t('polls.noPollsDescription')}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/create-poll">
                    <Button className="polly-button-primary">
                      <Plus className="w-4 h-4 mr-2" />
                      {t('dashboard.schedule')}
                    </Button>
                  </Link>
                  <Link href="/create-survey">
                    <Button className="polly-button-secondary">
                      <Plus className="w-4 h-4 mr-2" />
                      {t('polls.survey')}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {userPolls.map((poll: PollWithOptions) => (
                <PollCard key={poll.id} poll={poll} isOwner={true} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shared-polls" className="space-y-4">
          {sharedPolls.length === 0 ? (
            <Card className="polly-card">
              <CardContent className="p-8 text-center">
                <Share2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t('dashboard.noSharedPolls')}
                </h3>
                <p className="text-muted-foreground">
                  {t('dashboard.sharedPollsDescription')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sharedPolls.map((poll: PollWithOptions) => (
                <PollCard key={poll.id} poll={poll} isOwner={false} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archived" className="space-y-4">
          <Card className="polly-card">
            <CardContent className="p-8 text-center">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t('dashboard.archiveComingSoon')}
              </h3>
              <p className="text-muted-foreground">
                {t('dashboard.archiveDescription')}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface PollCardProps {
  poll: PollWithOptions;
  isOwner: boolean;
}

function PollCard({ poll, isOwner }: PollCardProps) {
  const isPollExpired = poll.expiresAt && new Date() > new Date(poll.expiresAt);
  const uniqueVoters = new Set(
    poll.votes.map(v => v.userId ? `user_${v.userId}` : `anon_${v.voterName}`)
  ).size;

  const { t, i18n } = useTranslation();
  
  const getStatusBadge = () => {
    if (!poll.isActive) {
      return <Badge variant="secondary">{t('polls.inactive')}</Badge>;
    }
    if (isPollExpired) {
      return <Badge variant="secondary">{t('polls.expired')}</Badge>;
    }
    return <Badge className="bg-green-100 text-green-900">{t('polls.active')}</Badge>;
  };

  const getPollTypeInfo = () => {
    if (poll.type === 'schedule') {
      return {
        icon: <Calendar className="w-4 h-4" />,
        label: t('dashboard.schedule'),
        color: 'bg-polly-orange text-white'
      };
    }
    return {
      icon: <Vote className="w-4 h-4" />,
      label: t('polls.survey'),
      color: 'bg-polly-blue text-white'
    };
  };

  const typeInfo = getPollTypeInfo();

  return (
    <Card className="polly-card hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <Badge className={typeInfo.color}>
                {typeInfo.icon}
                <span className="ml-1">{typeInfo.label}</span>
              </Badge>
              {getStatusBadge()}
            </div>
            
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {poll.title}
            </h3>
            
            {poll.description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {poll.description}
              </p>
            )}
            
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <span className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                {uniqueVoters} {t('dashboard.participants')}
              </span>
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {t('dashboard.created')}: {new Date(poll.createdAt).toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'en-US')}
              </span>
              {poll.expiresAt && (
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {t('dashboard.expiresAt')}: {new Date(poll.expiresAt).toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'en-US')}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2 ml-4">
            <Link href={`/poll/${poll.publicToken}`}>
              <Button variant="ghost" size="sm" title={t('dashboard.showResults')}>
                <BarChart3 className="w-4 h-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="sm" title={t('common.share')}>
              <Share2 className="w-4 h-4" />
            </Button>
            {isOwner && (
              <>
                <Link href={`/admin/${poll.adminToken}`}>
                  <Button variant="ghost" size="sm" title={t('common.edit')}>
                    <Edit className="w-4 h-4" />
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" title={t('common.delete')} className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
