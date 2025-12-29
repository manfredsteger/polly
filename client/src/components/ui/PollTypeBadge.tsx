import { useTranslation } from 'react-i18next';
import { cn } from "@/lib/utils";
import { Calendar, BarChart3, ListChecks, HelpCircle, type LucideIcon } from "lucide-react";

type PollType = 'schedule' | 'survey' | 'organization';

interface PollTypeBadgeProps {
  type: PollType;
  variant?: 'solid' | 'outline';
  showIcon?: boolean;
  className?: string;
}

const typeIcons: Record<PollType, LucideIcon> = {
  schedule: Calendar,
  survey: BarChart3,
  organization: ListChecks,
};

export function PollTypeBadge({ type, variant = 'solid', showIcon = true, className }: PollTypeBadgeProps) {
  const { t } = useTranslation();
  const validType = ['schedule', 'survey', 'organization'].includes(type) ? type : 'survey';
  
  const typeLabels: Record<PollType, string> = {
    schedule: t('pollTypes.schedule'),
    survey: t('pollTypes.survey'),
    organization: t('pollTypes.organization'),
  };
  
  const badgeClass = variant === 'solid' 
    ? `polly-badge-${validType}-solid`
    : `polly-badge-${validType}`;

  const Icon = typeIcons[validType as PollType] || HelpCircle;
  const label = typeLabels[validType as PollType] || type;

  return (
    <div 
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        badgeClass,
        className
      )}
      data-testid={`badge-poll-type-${type}`}
    >
      {showIcon && Icon && <Icon className="w-3 h-3 mr-1" />}
      {label}
    </div>
  );
}
