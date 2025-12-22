import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PollType = 'schedule' | 'survey' | 'organization';

interface PollTypeBadgeProps {
  type: PollType;
  variant?: 'solid' | 'outline';
  className?: string;
}

const typeLabels: Record<PollType, string> = {
  schedule: 'Termin',
  survey: 'Umfrage',
  organization: 'Orga',
};

export function PollTypeBadge({ type, variant = 'solid', className }: PollTypeBadgeProps) {
  const badgeClass = variant === 'solid' 
    ? `kita-badge-${type}-solid`
    : `kita-badge-${type}`;

  return (
    <Badge 
      className={cn(badgeClass, className)}
      data-testid={`badge-poll-type-${type}`}
    >
      {typeLabels[type]}
    </Badge>
  );
}
