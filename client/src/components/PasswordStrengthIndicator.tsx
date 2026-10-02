import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import type { PasswordPolicySettings } from '@shared/schema';

const DEFAULT_POLICY: PasswordPolicySettings = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

const SPECIAL_CHARS_RE = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

export function usePasswordPolicy() {
  return useQuery<PasswordPolicySettings>({
    queryKey: ['/api/v1/auth/password-policy'],
    staleTime: 5 * 60 * 1000,
  });
}

export function validatePasswordWithPolicy(
  password: string,
  policy: PasswordPolicySettings = DEFAULT_POLICY,
): boolean {
  if (password.length < policy.minLength) return false;
  if (policy.requireUppercase && !/[A-Z]/.test(password)) return false;
  if (policy.requireLowercase && !/[a-z]/.test(password)) return false;
  if (policy.requireNumbers && !/[0-9]/.test(password)) return false;
  if (policy.requireSpecialChars && !SPECIAL_CHARS_RE.test(password)) return false;
  return true;
}

interface Props {
  password: string;
  confirmPassword?: string;
}

export function PasswordStrengthIndicator({ password, confirmPassword = '' }: Props) {
  const { t } = useTranslation();
  const { data: policy = DEFAULT_POLICY } = usePasswordPolicy();

  const requirements = useMemo(() => {
    const reqs: { label: string; met: boolean }[] = [
      {
        label: t('auth.passwordRequirements.minLength', { count: policy.minLength }),
        met: password.length >= policy.minLength,
      },
    ];
    if (policy.requireUppercase) {
      reqs.push({ label: t('auth.passwordRequirements.uppercase'), met: /[A-Z]/.test(password) });
    }
    if (policy.requireLowercase) {
      reqs.push({ label: t('auth.passwordRequirements.lowercase'), met: /[a-z]/.test(password) });
    }
    if (policy.requireNumbers) {
      reqs.push({ label: t('auth.passwordRequirements.number'), met: /[0-9]/.test(password) });
    }
    if (policy.requireSpecialChars) {
      reqs.push({ label: t('auth.passwordRequirements.special'), met: SPECIAL_CHARS_RE.test(password) });
    }
    return reqs;
  }, [password, policy, t]);

  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const allRequirementsMet = requirements.every((r) => r.met);
  const strengthPercentage = requirements.length > 0
    ? (requirements.filter((r) => r.met).length / requirements.length) * 100
    : 0;

  const getStrengthColor = () => {
    if (strengthPercentage < 40) return 'bg-red-500';
    if (strengthPercentage < 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthLabel = () => {
    if (strengthPercentage < 40) return t('auth.passwordStrength.weak');
    if (strengthPercentage < 80) return t('auth.passwordStrength.medium');
    return t('auth.passwordStrength.strong');
  };

  if (password.length === 0) return null;

  return (
    <div className="space-y-3 mt-2 p-3 bg-muted/50 rounded-lg border" data-testid="password-strength-indicator">
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{t('auth.passwordStrength.label')}</span>
          <span className={`font-medium ${strengthPercentage === 100 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
            {getStrengthLabel()}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${getStrengthColor()}`}
            style={{ width: `${strengthPercentage}%` }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        {requirements.map((req, index) => (
          <div
            key={index}
            className={`flex items-center gap-2 text-xs ${req.met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
            data-testid={`password-requirement-${index}`}
          >
            {req.met ? (
              <Check className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
            )}
            <span>{req.label}</span>
          </div>
        ))}

        {confirmPassword.length > 0 && (
          <div
            className={`flex items-center gap-2 text-xs ${passwordsMatch ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}
            data-testid="password-match-indicator"
          >
            {passwordsMatch ? (
              <Check className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            <span>{t('auth.passwordsMatch')}</span>
          </div>
        )}
      </div>

      {allRequirementsMet && (confirmPassword.length === 0 || passwordsMatch) && (
        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 font-medium pt-1 border-t border-green-200 dark:border-green-800">
          <Check className="h-4 w-4" />
          <span>{t('auth.passwordMeetsRequirements')}</span>
        </div>
      )}
    </div>
  );
}
