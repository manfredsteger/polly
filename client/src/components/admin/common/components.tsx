import { useTranslation } from 'react-i18next';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Vote, 
  Activity, 
  CheckCircle, 
  UserCheck,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getDateLocale } from "@/lib/i18n";

export function NavButton({ 
  active, 
  onClick, 
  icon, 
  label, 
  testId, 
  collapsed 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string; 
  testId: string; 
  collapsed: boolean;
}) {
  const button = (
    <Button
      variant={active ? "default" : "ghost"}
      className={`w-full ${collapsed ? 'justify-center px-2' : 'justify-start px-3'}`}
      size={collapsed ? "icon" : "default"}
      onClick={onClick}
      data-testid={testId}
    >
      {icon}
      {!collapsed && <span className="ml-2 truncate">{label}</span>}
    </Button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

export function StatCard({ 
  icon, 
  label, 
  value, 
  color, 
  onClick, 
  testId 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
  color: 'blue' | 'green' | 'purple' | 'orange';
  onClick?: () => void;
  testId?: string;
}) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
  };
  
  const iconColorClasses = {
    blue: 'text-blue-200',
    green: 'text-green-200',
    purple: 'text-purple-200',
    orange: 'text-orange-200',
  };

  return (
    <Card 
      className={`bg-gradient-to-r ${colorClasses[color]} text-white cursor-pointer hover:shadow-lg transition-shadow`}
      onClick={onClick}
      data-testid={testId}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={`w-8 h-8 ${iconColorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const { t } = useTranslation();
  switch (role) {
    case 'admin': return <Badge className="polly-badge-admin">{t('admin.roleAdmin')}</Badge>;
    case 'manager': return <Badge className="polly-badge-manager">{t('admin.roleManager')}</Badge>;
    default: return <Badge className="polly-badge-user">{t('admin.roleUser')}</Badge>;
  }
}

export function ActivityItem({ activity }: { activity: { type: string; message: string; timestamp: string; actor?: string } }) {
  const getIcon = () => {
    switch (activity.type) {
      case 'poll_created': return <Vote className="w-4 h-4 text-white" />;
      case 'vote': return <CheckCircle className="w-4 h-4 text-white" />;
      case 'user_registered': return <UserCheck className="w-4 h-4 text-white" />;
      default: return <Activity className="w-4 h-4 text-white" />;
    }
  };

  const getColor = () => {
    switch (activity.type) {
      case 'poll_created': return 'bg-polly-orange';
      case 'vote': return 'bg-green-500';
      case 'user_registered': return 'bg-polly-blue';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
      <div className="flex items-center space-x-3">
        <div className={`w-8 h-8 ${getColor()} rounded-full flex items-center justify-center`}>
          {getIcon()}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{activity.message}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: getDateLocale() })}
          </p>
        </div>
      </div>
      {activity.actor && <span className="text-xs text-muted-foreground">{activity.actor}</span>}
    </div>
  );
}

export function SettingCard({ 
  title, 
  description, 
  icon, 
  status, 
  statusType, 
  onClick, 
  testId 
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  status: string;
  statusType: 'success' | 'warning' | 'error' | 'neutral';
  onClick?: () => void;
  testId?: string;
}) {
  const statusColors = {
    success: 'text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    warning: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    error: 'text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    neutral: 'text-muted-foreground bg-muted/50 border-muted',
  };

  return (
    <Card 
      className={`polly-card ${onClick ? 'cursor-pointer hover:shadow-md hover:border-polly-orange transition-all' : ''}`}
      onClick={onClick}
      data-testid={testId}
    >
      <CardContent className="p-4">
        <div className="flex items-start space-x-4">
          <div className="text-polly-orange">{icon}</div>
          <div className="flex-1">
            <h3 className="font-medium text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mb-2">{description}</p>
            <div className="flex items-center justify-between">
              <Badge className={statusColors[statusType]}>{status}</Badge>
              {onClick && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
