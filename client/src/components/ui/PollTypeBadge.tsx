import { cn } from "@/lib/utils";
import { Calendar, BarChart3, ListChecks } from "lucide-react";

type PollType = 'schedule' | 'survey' | 'organization';

interface PollTypeBadgeProps {
  type: PollType;
  variant?: 'solid' | 'outline';
  showIcon?: boolean;
  className?: string;
}

const typeLabels: Record<PollType, string> = {
  schedule: 'Termin',
  survey: 'Umfrage',
  organization: 'Orga',
};

const typeIcons: Record<PollType, typeof Calendar> = {
  schedule: Calendar,
  survey: BarChart3,
  organization: ListChecks,
};

export function PollTypeBadge({ type, variant = 'solid', showIcon = true, className }: PollTypeBadgeProps) {
  const badgeClass = variant === 'solid' 
    ? `polly-badge-${type}-solid`
    : `polly-badge-${type}`;

  const Icon = typeIcons[type];

  return (
    <div 
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        badgeClass,
        className
      )}
      data-testid={`badge-poll-type-${type}`}
    >
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {typeLabels[type]}
    </div>
  );
}
