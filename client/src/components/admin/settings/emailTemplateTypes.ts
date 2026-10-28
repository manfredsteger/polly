import type { LucideIcon } from 'lucide-react';
import { Bell, CheckCircle, FileText, Key, Mail, PlusCircle, Shield, UserPlus } from 'lucide-react';
import type { EmailTemplateType } from '@shared/schema';

/**
 * Icon for every email template type. Typed against all template types, so a
 * new type does not compile until it has an entry here (and, by the tests, a
 * name and description in every UI language).
 */
export const EMAIL_TEMPLATE_TYPE_ICONS: Record<EmailTemplateType, LucideIcon> = {
  poll_created: PlusCircle,
  invitation: UserPlus,
  vote_confirmation: CheckCircle,
  vote_updated: CheckCircle,
  new_vote_notification: Bell,
  reminder: Bell,
  password_reset: Key,
  email_change: Mail,
  password_changed: Shield,
  test_report: FileText,
  welcome: Mail,
  poll_finalized: CheckCircle,
};

/** Translation key of a template type's card title. */
export function templateTypeNameKey(type: string): string {
  return `admin.emailTemplates.templateTypes.${type}`;
}

/** Translation key of a template type's card description. */
export function templateTypeDescriptionKey(type: string): string {
  return `admin.emailTemplates.templateTypes.${type}_desc`;
}

/** Translation key of a template variable's explanation in the editor. */
export function templateVariableDescriptionKey(variableKey: string): string {
  return `admin.emailTemplates.variableDescriptions.${variableKey}`;
}

export function isKnownTemplateType(type: string): type is EmailTemplateType {
  return Object.prototype.hasOwnProperty.call(EMAIL_TEMPLATE_TYPE_ICONS, type);
}
