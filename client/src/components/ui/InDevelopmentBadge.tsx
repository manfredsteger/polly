import { useTranslation } from 'react-i18next';
import { cn } from "@/lib/utils";
import { FlaskConical } from "lucide-react";

interface InDevelopmentBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function InDevelopmentBadge({ className, size = 'sm' }: InDevelopmentBadgeProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border font-semibold polly-badge-in-development",
        size === 'sm' ? "px-2 py-0.5 text-[10px] gap-1" : "px-2.5 py-0.5 text-xs gap-1.5",
        className
      )}
    >
      <FlaskConical className={size === 'sm' ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {t('common.inDevelopment')}
    </div>
  );
}
