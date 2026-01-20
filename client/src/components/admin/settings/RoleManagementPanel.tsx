import { useTranslation } from 'react-i18next';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users,
  ArrowLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import type { User } from "@shared/schema";

export function RoleManagementPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/v1/admin/users'],
  });

  const userCounts = {
    user: users?.filter(u => u.role === 'user').length || 0,
    manager: users?.filter(u => u.role === 'manager').length || 0,
    admin: users?.filter(u => u.role === 'admin').length || 0,
  };

  const roles = [
    {
      id: 'user',
      name: t('admin.roles.user'),
      description: t('admin.roles.userDescription'),
      color: 'bg-gray-500',
      badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      count: userCounts.user,
      permissions: [
        { name: t('admin.roles.permissions.createOwnPolls'), allowed: true },
        { name: t('admin.roles.permissions.participateInPolls'), allowed: true },
        { name: t('admin.roles.permissions.manageOwnPolls'), allowed: true },
        { name: t('admin.roles.permissions.editOwnVotes'), allowed: true },
        { name: t('admin.roles.permissions.adminPanelAccess'), allowed: false },
        { name: t('admin.roles.permissions.manageOtherUsers'), allowed: false },
        { name: t('admin.roles.permissions.changeSystemSettings'), allowed: false },
      ],
    },
    {
      id: 'manager',
      name: t('admin.roles.manager'),
      description: t('admin.roles.managerDescription'),
      color: 'bg-blue-500',
      badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      count: userCounts.manager,
      permissions: [
        { name: t('admin.roles.permissions.createOwnPolls'), allowed: true },
        { name: t('admin.roles.permissions.participateInPolls'), allowed: true },
        { name: t('admin.roles.permissions.manageOwnPolls'), allowed: true },
        { name: t('admin.roles.permissions.editOwnVotes'), allowed: true },
        { name: t('admin.roles.permissions.viewTeamPolls'), allowed: true },
        { name: t('admin.roles.permissions.userOverview'), allowed: true },
        { name: t('admin.roles.permissions.changeSystemSettings'), allowed: false },
      ],
    },
    {
      id: 'admin',
      name: t('admin.roles.admin'),
      description: t('admin.roles.adminDescription'),
      color: 'bg-red-500',
      badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      count: userCounts.admin,
      permissions: [
        { name: t('admin.roles.permissions.createOwnPolls'), allowed: true },
        { name: t('admin.roles.permissions.participateInPolls'), allowed: true },
        { name: t('admin.roles.permissions.manageAllPolls'), allowed: true },
        { name: t('admin.roles.permissions.viewAllVotes'), allowed: true },
        { name: t('admin.roles.permissions.adminPanelAccess'), allowed: true },
        { name: t('admin.roles.permissions.manageUsers'), allowed: true },
        { name: t('admin.roles.permissions.changeSystemSettings'), allowed: true },
        { name: t('admin.roles.permissions.assignRoles'), allowed: true },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('admin.roles.backToSettings')}
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">{t('admin.roles.breadcrumb')}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.roles.title')}</h2>
          <p className="text-muted-foreground">{t('admin.roles.description')}</p>
        </div>
        <Badge variant="outline">
          <Users className="w-3 h-3 mr-1" />
          {t('admin.roles.totalUsers', { count: users?.length || 0 })}
        </Badge>
      </div>

      <div className="grid gap-6">
        {roles.map((role) => (
          <Card key={role.id} className="polly-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${role.color}`} />
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {role.name}
                      <Badge className={role.badgeClass}>{t('admin.roles.users', { count: role.count })}</Badge>
                    </CardTitle>
                    <CardDescription>{role.description}</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {role.permissions.map((perm, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-center space-x-2 p-2 rounded-lg text-sm ${
                      perm.allowed 
                        ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' 
                        : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                    }`}
                  >
                    {perm.allowed ? (
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="truncate">{perm.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="polly-card border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-700 dark:text-blue-400">
            <AlertCircle className="w-5 h-5 mr-2" />
            {t('admin.roles.managementNote')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            {t('admin.roles.assignHint')}
          </p>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="font-medium text-foreground">{t('admin.roles.ssoUsers')}:</p>
            <p>
              {t('admin.roles.ssoNote')}
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><code className="bg-muted px-1 rounded">admin</code> {t('common.or')} <code className="bg-muted px-1 rounded">polly-poll-admin</code></li>
              <li><code className="bg-muted px-1 rounded">manager</code> {t('common.or')} <code className="bg-muted px-1 rounded">polly-poll-manager</code></li>
              <li><code className="bg-muted px-1 rounded">user</code> {t('common.or')} <code className="bg-muted px-1 rounded">polly-poll-user</code></li>
            </ul>
            <p className="text-xs">
              {t('admin.roles.configNote')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
