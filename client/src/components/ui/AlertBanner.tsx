import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, AlertTriangle, Info } from "lucide-react";

type AlertVariant = 'error' | 'success' | 'warning' | 'info';

interface AlertBannerProps {
  variant: AlertVariant;
  children: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}

const variantIcons = {
  error: AlertCircle,
  success: CheckCircle,
  warning: AlertTriangle,
  info: Info,
};

export function AlertBanner({ variant, children, className, showIcon = true }: AlertBannerProps) {
  const Icon = variantIcons[variant];
  
  return (
    <div 
      className={cn(
        `kita-alert-${variant}`,
        "rounded-lg p-4 flex items-start gap-3",
        className
      )}
      role="alert"
      data-testid={`alert-${variant}`}
    >
      {showIcon && (
        <Icon className="kita-alert-icon h-5 w-5 flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1">{children}</div>
    </div>
  );
}
