import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Edit2,
  Trash2,
  MoreVertical,
  UserPlus,
  Search,
  ArrowLeft,
  Loader2,
  Vote,
  CheckCircle,
  XCircle,
  ShieldCheck,
  KeyRound,
  Mail,
  Save,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { getDateLocale } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { RoleBadge } from "../common/components";
import type { User, PollWithOptions } from "@shared/schema";

interface UsersPanelProps {
  users: User[] | undefined;
  polls: PollWithOptions[] | undefined;
  selectedUser: User | null;
  onUserClick: (user: User) => void;
  onBackToUsers: () => void;
  onPollClick: (poll: PollWithOptions) => void;
  isDeprovisionEnabled: boolean;
}

export function UsersPanel({
  users,
  polls,
  selectedUser,
  onUserClick,
  onBackToUsers,
  onPollClick,
  isDeprovisionEnabled,
}: UsersPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'user' as 'user' | 'admin' | 'manager',
  });
  const [openMenuUserId, setOpenMenuUserId] = useState<number | null>(null);

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUserForm) => {
      const response = await apiRequest("POST", `/api/v1/admin/users`, userData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('admin.toast.userCreateError'));
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toast.userCreated'), description: t('admin.toast.userCreatedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/users'] });
      setShowAddUserDialog(false);
      setNewUserForm({ name: '', email: '', username: '', password: '', role: 'user' });
    },
    onError: (error: Error) => {
      toast({ title: t('admin.toast.error'), description: error.message, variant: "destructive" });
    },
  });

  const filteredUsers = users?.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getUserPolls = (userId: number) => {
    return polls?.filter(p => p.userId === userId) || [];
  };

  if (selectedUser) {
    const userPolls = getUserPolls(selectedUser.id);
    return (
      <UserDetailView
        user={selectedUser}
        polls={userPolls}
        onBack={onBackToUsers}
        onPollClick={onPollClick}
        isDeprovisionEnabled={isDeprovisionEnabled}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground">{t('admin.users.title')}</h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            <Users className="w-3 h-3 mr-1" />
            {t('admin.users.totalCount', { count: users?.length || 0 })}
          </Badge>
          <Button onClick={() => setShowAddUserDialog(true)} data-testid="button-add-user">
            <UserPlus className="w-4 h-4 mr-2" />
            {t('admin.users.addUser')}
          </Button>
        </div>
      </div>

      <Card className="polly-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>{t('admin.users.allUsers')}</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('admin.users.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-user-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('admin.users.noUsersFound')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.users.name')}</TableHead>
                    <TableHead>{t('admin.users.username')}</TableHead>
                    <TableHead>{t('admin.users.email')}</TableHead>
                    <TableHead>{t('admin.users.role')}</TableHead>
                    <TableHead>{t('admin.users.joined')}</TableHead>
                    <TableHead>{t('admin.users.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onUserClick(user)}
                      data-testid={`user-row-${user.id}`}
                    >
                      <TableCell className="font-medium">{user.name || '-'}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email || '-'}</TableCell>
                      <TableCell><RoleBadge role={user.role} /></TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true, locale: getDateLocale() })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu
                          open={openMenuUserId === user.id}
                          onOpenChange={(open) => setOpenMenuUserId(open ? user.id : null)}
                        >
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" data-testid={`button-user-actions-${user.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('admin.users.actions')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                setOpenMenuUserId(null);
                                onUserClick(user);
                              }}
                              data-testid={`menu-edit-user-${user.id}`}
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              {t('admin.users.edit')}
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

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.addUserTitle')}</DialogTitle>
            <DialogDescription>{t('admin.users.addUserDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">{t('admin.users.name')}</Label>
              <Input
                id="name"
                value={newUserForm.name}
                onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                data-testid="input-new-user-name"
              />
            </div>
            <div>
              <Label htmlFor="username">{t('admin.users.username')}</Label>
              <Input
                id="username"
                value={newUserForm.username}
                onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                data-testid="input-new-user-username"
              />
            </div>
            <div>
              <Label htmlFor="email">{t('admin.users.email')}</Label>
              <Input
                id="email"
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                data-testid="input-new-user-email"
              />
            </div>
            <div>
              <Label htmlFor="password">{t('admin.users.password')}</Label>
              <Input
                id="password"
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                data-testid="input-new-user-password"
              />
            </div>
            <div>
              <Label htmlFor="role">{t('admin.users.role')}</Label>
              <Select
                value={newUserForm.role}
                onValueChange={(value) => setNewUserForm({ ...newUserForm, role: value as 'user' | 'admin' | 'manager' })}
              >
                <SelectTrigger data-testid="select-new-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t('admin.roleUser')}</SelectItem>
                  <SelectItem value="manager">{t('admin.roleManager')}</SelectItem>
                  <SelectItem value="admin">{t('admin.roleAdmin')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => createUserMutation.mutate(newUserForm)}
              disabled={createUserMutation.isPending || !newUserForm.username || !newUserForm.password}
              data-testid="button-create-user"
            >
              {createUserMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              {t('admin.users.createUser')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserDetailView({
  user,
  polls,
  onBack,
  onPollClick,
  isDeprovisionEnabled,
}: {
  user: User;
  polls: PollWithOptions[];
  onBack: () => void;
  onPollClick: (poll: PollWithOptions) => void;
  isDeprovisionEnabled: boolean;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [editForm, setEditForm] = useState({
    name: user.name || '',
    username: user.username,
    email: user.email || '',
  });

  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });

  const passwordPolicy = (pw: string) => ({
    minLength: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pw),
  });
  const passwordPolicyValid = (pw: string) => Object.values(passwordPolicy(pw)).every(Boolean);

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: { name: string; username: string; email: string }) => {
      const response = await apiRequest("PATCH", `/api/v1/admin/users/${user.id}`, updates);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || t('admin.toast.userUpdateError'));
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toast.userUpdated'), description: t('admin.toast.userUpdatedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/users'] });
    },
    onError: (error: Error) => {
      toast({ title: t('admin.toast.error'), description: error.message, variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (role: string) => {
      const response = await apiRequest("PATCH", `/api/v1/admin/users/${user.id}`, { role });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || t('admin.toast.userUpdateError'));
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toast.userUpdated'), description: t('admin.toast.userUpdatedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/users'] });
    },
    onError: () => {
      toast({ title: t('admin.toast.error'), description: t('admin.toast.userUpdateError'), variant: "destructive" });
    },
  });

  const sendPasswordResetMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/v1/admin/users/${user.id}/send-password-reset`, {});
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || t('admin.users.passwordResetError'));
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.users.passwordResetSent'), description: t('admin.users.passwordResetSentDescription') });
    },
    onError: (error: Error) => {
      toast({ title: t('admin.users.passwordResetError'), description: error.message, variant: 'destructive' });
    },
  });

  const setPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await apiRequest("POST", `/api/v1/admin/users/${user.id}/set-password`, { password });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || t('admin.users.passwordSetError'));
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.users.passwordSet'), description: t('admin.users.passwordSetDescription') });
      setPasswordForm({ password: '', confirmPassword: '' });
    },
    onError: (error: Error) => {
      toast({ title: t('admin.users.passwordSetError'), description: error.message, variant: 'destructive' });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/v1/admin/users/${user.id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.code === 'MANUAL_DELETE_DISABLED'
          ? t('admin.toast.manualDeleteDisabled')
          : error.error || t('admin.toast.userDeleteError'));
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toast.userDeleted'), description: t('admin.toast.userDeletedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/extended-stats'] });
      onBack();
    },
    onError: (error: Error) => {
      toast({ title: t('admin.toast.error'), description: error.message || t('admin.toast.userDeleteError'), variant: "destructive" });
    },
  });

  const isLocal = user.provider === 'local';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-users">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">{editForm.name || user.username}</h2>
          <p className="text-sm text-muted-foreground">{editForm.email || user.email}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Details / Edit Card */}
        <Card className="polly-card">
          <CardHeader>
            <CardTitle>{t('admin.users.details')}</CardTitle>
            {!isLocal && (
              <CardDescription className="text-amber-600 dark:text-amber-400">
                {t('admin.users.editSsoHint')}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="detail-name">{t('admin.users.name')}</Label>
              <Input
                id="detail-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                disabled={!isLocal}
                data-testid="input-edit-user-name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="detail-username">{t('admin.users.username')}</Label>
              <Input
                id="detail-username"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                disabled={!isLocal}
                data-testid="input-edit-user-username"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="detail-email">{t('admin.users.email')}</Label>
              <Input
                id="detail-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                disabled={!isLocal}
                data-testid="input-edit-user-email"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Label>{t('admin.users.role')}</Label>
              <RoleBadge role={user.role} />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('admin.users.joined')}</Label>
              <span className="text-sm text-muted-foreground">
                {format(new Date(user.createdAt), 'PPp', { locale: getDateLocale() })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('admin.users.provider')}</Label>
              <Badge variant="outline">{user.provider}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('admin.users.emailStatus')}</Label>
              {user.emailVerified ? (
                <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-500/10">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {t('admin.users.emailVerified')}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10">
                  <XCircle className="w-3 h-3 mr-1" />
                  {t('admin.users.emailNotVerified')}
                </Badge>
              )}
            </div>

            <div className="pt-2">
              <Button
                className="w-full"
                onClick={() => updateProfileMutation.mutate(editForm)}
                disabled={updateProfileMutation.isPending || !isLocal}
                data-testid="button-save-user-profile"
              >
                {updateProfileMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {t('admin.users.save')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Management Card */}
        <Card className="polly-card">
          <CardHeader>
            <CardTitle>{t('admin.users.management')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!user.emailVerified && isLocal && (
              <div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    apiRequest('PATCH', `/api/v1/admin/users/${user.id}`, { emailVerified: true })
                      .then(() => {
                        queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/users'] });
                        toast({
                          title: t('admin.users.emailVerifiedSuccess'),
                          description: t('admin.users.emailVerifiedDescription'),
                        });
                      })
                      .catch(() => {
                        toast({ title: t('admin.users.saveError'), variant: 'destructive' });
                      });
                  }}
                  data-testid="button-verify-email"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  {t('admin.users.verifyEmail')}
                </Button>
              </div>
            )}

            <div>
              <Label>{t('admin.users.changeRole')}</Label>
              <Select
                value={user.role}
                onValueChange={(value) => updateRoleMutation.mutate(value)}
                disabled={updateRoleMutation.isPending}
              >
                <SelectTrigger className="mt-1" data-testid="select-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t('admin.roleUser')}</SelectItem>
                  <SelectItem value="manager">{t('admin.roleManager')}</SelectItem>
                  <SelectItem value="admin">{t('admin.roleAdmin')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Password section — local users only */}
            {isLocal && (
              <div className="space-y-3 border-t pt-4">
                <Label className="text-sm font-semibold">{t('admin.users.passwordSectionTitle')}</Label>

                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!user.email || sendPasswordResetMutation.isPending}
                  onClick={() => sendPasswordResetMutation.mutate()}
                  data-testid="button-send-password-reset"
                >
                  {sendPasswordResetMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  {t('admin.users.sendPasswordReset')}
                </Button>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="set-password-new">{t('admin.users.newPasswordLabel')}</Label>
                    <Input
                      id="set-password-new"
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                      data-testid="input-set-password-new"
                    />
                    <p className="text-xs text-muted-foreground">{t('admin.users.passwordHint')}</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="set-password-confirm">{t('admin.users.confirmPasswordLabel')}</Label>
                    <Input
                      id="set-password-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      data-testid="input-set-password-confirm"
                    />
                    {passwordForm.confirmPassword.length > 0 && passwordForm.password !== passwordForm.confirmPassword && (
                      <p className="text-xs text-destructive">{t('admin.users.passwordMismatch')}</p>
                    )}
                  </div>

                  {passwordForm.password.length > 0 && (
                    <ul className="text-xs space-y-1" data-testid="password-policy-list">
                      {(() => {
                        const p = passwordPolicy(passwordForm.password);
                        const item = (ok: boolean, key: string) => (
                          <li key={key} className={ok ? 'text-green-600' : 'text-muted-foreground'}>
                            {ok ? '✓' : '○'} {t(`auth.passwordRequirements.${key}`)}
                          </li>
                        );
                        return (
                          <>
                            {item(p.minLength, 'minLength')}
                            {item(p.upper, 'uppercase')}
                            {item(p.lower, 'lowercase')}
                            {item(p.digit, 'number')}
                            {item(p.special, 'special')}
                          </>
                        );
                      })()}
                    </ul>
                  )}

                  <Button
                    className="w-full"
                    onClick={() => {
                      if (!passwordPolicyValid(passwordForm.password)) {
                        toast({ title: t('admin.users.passwordSetError'), description: t('auth.errors.passwordRequirements'), variant: 'destructive' });
                        return;
                      }
                      if (passwordForm.password !== passwordForm.confirmPassword) {
                        toast({ title: t('admin.users.passwordSetError'), description: t('admin.users.passwordMismatch'), variant: 'destructive' });
                        return;
                      }
                      setPasswordMutation.mutate(passwordForm.password);
                    }}
                    disabled={
                      setPasswordMutation.isPending ||
                      !passwordForm.password ||
                      !passwordPolicyValid(passwordForm.password) ||
                      passwordForm.password !== passwordForm.confirmPassword
                    }
                    data-testid="button-set-password-save"
                  >
                    {setPasswordMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <KeyRound className="w-4 h-4 mr-2" />
                    )}
                    {t('admin.users.setPassword')}
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={deleteUserMutation.isPending || isDeprovisionEnabled}
                  >
                    {deleteUserMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    {t('admin.users.deleteUser')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('admin.users.confirmDelete')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('admin.users.confirmDeleteDescription')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteUserMutation.mutate()}>
                      {t('common.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {isDeprovisionEnabled && (
                <p className="text-xs text-muted-foreground mt-2">
                  {t('admin.users.deprovisioningEnabled')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User's Polls */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Vote className="w-5 h-5" />
            {t('admin.users.userPolls')}
          </CardTitle>
          <CardDescription>
            {t('admin.users.userPollsDescription', { count: polls.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {polls.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">{t('admin.users.noPolls')}</p>
          ) : (
            <div className="space-y-2">
              {polls.slice(0, 5).map((poll) => (
                <div
                  key={poll.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80"
                  onClick={() => window.open(`/results/${poll.id}`, '_blank')}
                >
                  <div>
                    <p className="font-medium">{poll.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(poll.createdAt), { addSuffix: true, locale: getDateLocale() })}
                    </p>
                  </div>
                  <Badge variant={poll.isActive ? "default" : "secondary"}>
                    {poll.isActive ? t('admin.polls.active') : t('admin.polls.inactive')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
