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
    <div 
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        badgeClass,
        className
      )}
      data-testid={`badge-poll-type-${type}`}
    >
      {typeLabels[type]}
    </div>
  );
}
