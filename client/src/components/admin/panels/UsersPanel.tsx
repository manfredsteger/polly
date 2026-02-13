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
  Eye,
  Vote
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
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'user' as 'user' | 'admin' | 'manager',
  });
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    email: '',
  });
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

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

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: number; updates: any }) => {
      const response = await apiRequest("PATCH", `/api/v1/admin/users/${userId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toast.userUpdated'), description: t('admin.toast.userUpdatedDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/users'] });
      setEditingUser(null);
    },
    onError: () => {
      toast({ title: t('admin.toast.error'), description: t('admin.toast.userUpdateError'), variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/v1/admin/users/${userId}`);
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
      if (selectedUser) {
        onBackToUsers();
      }
    },
    onError: (error: Error) => {
      toast({ title: t('admin.toast.error'), description: error.message || t('admin.toast.userDeleteError'), variant: "destructive" });
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

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserForm({
      name: user.name || '',
      email: user.email || '',
    });
  };

  if (selectedUser) {
    const userPolls = getUserPolls(selectedUser.id);
    return (
      <UserDetailView 
        user={selectedUser}
        polls={userPolls}
        onBack={onBackToUsers}
        onPollClick={onPollClick}
        onUpdateRole={(userId, role) => updateUserMutation.mutate({ userId, updates: { role } })}
        onUpdateUser={(userId, updates) => updateUserMutation.mutate({ userId, updates })}
        onDelete={(userId) => deleteUserMutation.mutate(userId)}
        isDeleting={deleteUserMutation.isPending}
        isUpdating={updateUserMutation.isPending}
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('admin.users.actions')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUserClick(user); }}>
                              <Eye className="w-4 h-4 mr-2" />
                              {t('admin.users.viewDetails')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditUser(user); }}>
                              <Edit2 className="w-4 h-4 mr-2" />
                              {t('admin.users.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setUserToDelete(user); }}
                              disabled={isDeprovisionEnabled}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t('common.delete')}
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

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => { if (!open) setUserToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.users.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.users.confirmDeleteDescription')} ({userToDelete?.username})
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => { if (userToDelete) { deleteUserMutation.mutate(userToDelete.id); setUserToDelete(null); } }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.editUser')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">{t('admin.users.name')}</Label>
              <Input
                id="edit-name"
                value={editUserForm.name}
                onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                data-testid="input-edit-user-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-email">{t('admin.users.email')}</Label>
              <Input
                id="edit-email"
                type="email"
                value={editUserForm.email}
                onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                data-testid="input-edit-user-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => editingUser && updateUserMutation.mutate({ userId: editingUser.id, updates: editUserForm })}
              disabled={updateUserMutation.isPending}
              data-testid="button-save-user"
            >
              {updateUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('common.save')}
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
  onUpdateRole, 
  onUpdateUser, 
  onDelete, 
  isDeleting, 
  isUpdating,
  isDeprovisionEnabled
}: {
  user: User;
  polls: PollWithOptions[];
  onBack: () => void;
  onPollClick: (poll: PollWithOptions) => void;
  onUpdateRole: (userId: number, role: string) => void;
  onUpdateUser: (userId: number, updates: any) => void;
  onDelete: (userId: number) => void;
  isDeleting: boolean;
  isUpdating: boolean;
  isDeprovisionEnabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-users">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">{user.name || user.username}</h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="polly-card">
          <CardHeader>
            <CardTitle>{t('admin.users.details')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t('admin.users.username')}</Label>
              <span className="text-sm">{user.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('admin.users.email')}</Label>
              <span className="text-sm text-muted-foreground">{user.email || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
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
          </CardContent>
        </Card>

        <Card className="polly-card">
          <CardHeader>
            <CardTitle>{t('admin.users.management')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t('admin.users.changeRole')}</Label>
              <Select
                value={user.role}
                onValueChange={(value) => onUpdateRole(user.id, value)}
                disabled={isUpdating}
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

            <div className="pt-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    className="w-full" 
                    disabled={isDeleting || isDeprovisionEnabled}
                  >
                    {isDeleting ? (
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
                    <AlertDialogAction onClick={() => onDelete(user.id)}>
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
                  onClick={() => onPollClick(poll)}
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
