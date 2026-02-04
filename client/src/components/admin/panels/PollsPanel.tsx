import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Vote, 
  Eye, 
  EyeOff, 
  Trash2, 
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  ExternalLink,
  ArrowLeft,
  Loader2
} from "lucide-react";
import { PollTypeBadge } from "@/components/ui/PollTypeBadge";
import { formatDistanceToNow, format } from "date-fns";
import { getDateLocale } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PollWithOptions } from "@shared/schema";

interface PollsPanelProps {
  polls: PollWithOptions[] | undefined;
  selectedPoll: PollWithOptions | null;
  onPollClick: (poll: PollWithOptions) => void;
  onBackToPolls: () => void;
}

export function PollsPanel({
  polls,
  selectedPoll,
  onPollClick,
  onBackToPolls,
}: PollsPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const updatePollMutation = useMutation({
    mutationFn: async ({ pollId, updates }: { pollId: string; updates: any }) => {
      const response = await apiRequest("PATCH", `/api/v1/admin/polls/${pollId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toast.pollUpdated'), description: t('admin.toast.pollUpdatedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/polls'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/extended-stats'] });
    },
    onError: () => {
      toast({ title: t('admin.toast.error'), description: t('admin.toast.pollUpdateError'), variant: "destructive" });
    },
  });

  const deletePollMutation = useMutation({
    mutationFn: async (pollId: string) => {
      const response = await apiRequest("DELETE", `/api/v1/admin/polls/${pollId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toast.pollDeleted'), description: t('admin.toast.pollDeletedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/polls'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/extended-stats'] });
      onBackToPolls();
    },
    onError: () => {
      toast({ title: t('admin.toast.error'), description: t('admin.toast.pollDeleteError'), variant: "destructive" });
    },
  });

  const filteredPolls = polls?.filter(poll => 
    poll.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    poll.publicToken.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (selectedPoll) {
    return (
      <PollDetailView 
        poll={selectedPoll}
        onBack={onBackToPolls}
        onDelete={(pollId) => deletePollMutation.mutate(pollId)}
        onToggleActive={(pollId, isActive) => updatePollMutation.mutate({ pollId, updates: { isActive } })}
        onToggleResultsPublic={(pollId, resultsPublic) => updatePollMutation.mutate({ pollId, updates: { resultsPublic } })}
        isDeleting={deletePollMutation.isPending}
        isUpdating={updatePollMutation.isPending}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground">{t('admin.polls.title')}</h2>
        <Badge variant="outline" className="text-polly-orange border-polly-orange">
          <Vote className="w-3 h-3 mr-1" />
          {t('admin.polls.totalCount', { count: polls?.length || 0 })}
        </Badge>
      </div>

      <Card className="polly-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>{t('admin.polls.allPolls')}</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('admin.polls.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-poll-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPolls.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('admin.polls.noPollsFound')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.polls.pollTitle')}</TableHead>
                    <TableHead>{t('admin.polls.type')}</TableHead>
                    <TableHead>{t('admin.polls.status')}</TableHead>
                    <TableHead>{t('admin.polls.created')}</TableHead>
                    <TableHead>{t('admin.polls.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPolls.map((poll) => (
                    <TableRow 
                      key={poll.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onPollClick(poll)}
                      data-testid={`poll-row-${poll.publicToken}`}
                    >
                      <TableCell className="font-medium">
                        <div>
                          <p className="font-medium">{poll.title}</p>
                          <p className="text-xs text-muted-foreground">{poll.publicToken}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <PollTypeBadge type={poll.type as 'schedule' | 'survey' | 'organization'} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={poll.isActive ? "default" : "secondary"}>
                          {poll.isActive ? t('admin.polls.active') : t('admin.polls.inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(poll.createdAt), { addSuffix: true, locale: getDateLocale() })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('admin.polls.actions')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPollClick(poll); }}>
                              <Eye className="w-4 h-4 mr-2" />
                              {t('admin.polls.viewDetails')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                updatePollMutation.mutate({ pollId: poll.publicToken, updates: { isActive: !poll.isActive } });
                              }}
                            >
                              {poll.isActive ? (
                                <>
                                  <EyeOff className="w-4 h-4 mr-2" />
                                  {t('admin.polls.deactivate')}
                                </>
                              ) : (
                                <>
                                  <Eye className="w-4 h-4 mr-2" />
                                  {t('admin.polls.activate')}
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PollDetailView({ 
  poll, 
  onBack, 
  onDelete, 
  onToggleActive, 
  onToggleResultsPublic, 
  isDeleting, 
  isUpdating 
}: {
  poll: PollWithOptions;
  onBack: () => void;
  onDelete: (pollId: string) => void;
  onToggleActive: (pollId: string, isActive: boolean) => void;
  onToggleResultsPublic: (pollId: string, resultsPublic: boolean) => void;
  isDeleting: boolean;
  isUpdating: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-polls">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">{poll.title}</h2>
          <p className="text-sm text-muted-foreground">{poll.publicToken}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="polly-card">
          <CardHeader>
            <CardTitle>{t('admin.polls.details')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t('admin.polls.type')}</Label>
              <PollTypeBadge type={poll.type as 'schedule' | 'survey' | 'organization'} />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('admin.polls.status')}</Label>
              <Badge variant={poll.isActive ? "default" : "secondary"}>
                {poll.isActive ? t('admin.polls.active') : t('admin.polls.inactive')}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('admin.polls.created')}</Label>
              <span className="text-sm text-muted-foreground">
                {format(new Date(poll.createdAt), 'PPp', { locale: getDateLocale() })}
              </span>
            </div>
            {poll.expiresAt && (
              <div className="flex items-center justify-between">
                <Label>{t('admin.polls.expires')}</Label>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(poll.expiresAt), 'PPp', { locale: getDateLocale() })}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>{t('admin.polls.options')}</Label>
              <span className="text-sm">{poll.options.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="polly-card">
          <CardHeader>
            <CardTitle>{t('admin.polls.controls')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.polls.pollActive')}</Label>
                <p className="text-xs text-muted-foreground">{t('admin.polls.pollActiveDescription')}</p>
              </div>
              <Switch
                checked={poll.isActive}
                onCheckedChange={(checked) => onToggleActive(poll.publicToken, checked)}
                disabled={isUpdating}
                data-testid="switch-poll-active"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.polls.resultsPublic')}</Label>
                <p className="text-xs text-muted-foreground">{t('admin.polls.resultsPublicDescription')}</p>
              </div>
              <Switch
                checked={poll.resultsPublic || false}
                onCheckedChange={(checked) => onToggleResultsPublic(poll.publicToken, checked)}
                disabled={isUpdating}
                data-testid="switch-results-public"
              />
            </div>
            
            <div className="pt-4 space-y-2">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open(`/poll/${poll.publicToken}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {t('admin.polls.openPoll')}
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full" disabled={isDeleting}>
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    {t('admin.polls.deletePoll')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('admin.polls.confirmDelete')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('admin.polls.confirmDeleteDescription')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(poll.publicToken)}>
                      {t('common.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
