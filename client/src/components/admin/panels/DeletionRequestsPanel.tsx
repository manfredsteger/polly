import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  UserX, 
  RefreshCw,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Trash2,
  XCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getDateLocale } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DeletionRequestUser {
  id: number;
  username: string;
  email: string;
  name: string;
  organization: string | null;
  role: string;
  provider: string;
  createdAt: string;
  deletionRequestedAt: string | null;
}

interface DeletionRequestsPanelProps {
  onBack: () => void;
}

export function DeletionRequestsPanel({ onBack }: DeletionRequestsPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading, refetch } = useQuery<DeletionRequestUser[]>({
    queryKey: ['/api/v1/admin/deletion-requests'],
  });

  const confirmDeletionMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest('POST', `/api/v1/admin/deletion-requests/${userId}/confirm`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('admin.deletionRequests.userDeleted'),
        description: t('admin.deletionRequests.userDeletedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/extended-stats'] });
    },
    onError: () => {
      toast({
        title: t('errors.generic'),
        description: t('admin.deletionRequests.userDeleteError'),
        variant: "destructive",
      });
    },
  });

  const rejectDeletionMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest('POST', `/api/v1/admin/deletion-requests/${userId}/reject`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('admin.deletionRequests.requestRejected'),
        description: t('admin.deletionRequests.requestRejectedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/deletion-requests'] });
    },
    onError: () => {
      toast({
        title: t('errors.generic'),
        description: t('admin.deletionRequests.requestRejectError'),
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-deletion">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <UserX className="w-5 h-5 text-destructive" />
              {t('admin.deletionRequests.title')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('admin.deletionRequests.description')}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-deletion-requests">
          <RefreshCw className="w-4 h-4 mr-2" />
          {t('common.refresh')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('admin.deletionRequests.openRequests')}</CardTitle>
          <CardDescription>
            {t('admin.deletionRequests.openRequestsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !requests || requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p className="font-medium">{t('admin.deletionRequests.noOpenRequests')}</p>
              <p className="text-sm mt-1">{t('admin.deletionRequests.allProcessed')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.deletionRequests.user')}</TableHead>
                    <TableHead>{t('admin.deletionRequests.email')}</TableHead>
                    <TableHead>{t('admin.deletionRequests.requestedAt')}</TableHead>
                    <TableHead>{t('admin.deletionRequests.provider')}</TableHead>
                    <TableHead className="text-right">{t('admin.deletionRequests.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id} data-testid={`deletion-request-${request.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.name || request.username}</p>
                          <p className="text-xs text-muted-foreground">@{request.username}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{request.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {request.deletionRequestedAt ? (
                          formatDistanceToNow(new Date(request.deletionRequestedAt), { addSuffix: true, locale: getDateLocale() })
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{request.provider}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={confirmDeletionMutation.isPending}
                                data-testid={`button-confirm-delete-${request.id}`}
                              >
                                {confirmDeletionMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('admin.deletionRequests.confirmDeleteTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('admin.deletionRequests.confirmDeleteDescription', { username: request.username })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => confirmDeletionMutation.mutate(request.id)}>
                                  {t('admin.deletionRequests.confirmDelete')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => rejectDeletionMutation.mutate(request.id)}
                            disabled={rejectDeletionMutation.isPending}
                            data-testid={`button-reject-${request.id}`}
                          >
                            {rejectDeletionMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* GDPR Information */}
      <Card className="polly-card border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-blue-700 dark:text-blue-400">
            {t('admin.deletionRequests.gdprInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t('admin.deletionRequests.gdprDescription')}</p>
          <ul className="list-disc list-inside space-y-1">
            <li>{t('admin.deletionRequests.gdprPoint1')}</li>
            <li>{t('admin.deletionRequests.gdprPoint2')}</li>
            <li>{t('admin.deletionRequests.gdprPoint3')}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
