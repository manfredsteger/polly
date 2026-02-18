import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, Check, MessageCircle, CalendarDays } from 'lucide-react';
import { type PollOption } from '@shared/schema';

interface SlotBookingInfo {
  optionId: number;
  comment?: string;
}

interface OrganizationSlotVotingProps {
  options: PollOption[];
  allowMultipleSlots: boolean;
  onBookingChange: (bookings: SlotBookingInfo[]) => void;
  existingBookings?: SlotBookingInfo[];
  disabled?: boolean;
  adminPreview?: boolean;
  currentSignups?: Record<number, { count: number; maxCapacity: number; names: string[] }>;
}

export function OrganizationSlotVoting({ 
  options, 
  allowMultipleSlots,
  onBookingChange,
  existingBookings = [],
  disabled = false,
  adminPreview = false,
  currentSignups = {}
}: OrganizationSlotVotingProps) {
  const { t, i18n } = useTranslation();
  const [bookings, setBookings] = useState<SlotBookingInfo[]>(existingBookings);
  const [comments, setComments] = useState<Record<number, string>>({});

  // Sync internal bookings state with parent when existingBookings changes
  useEffect(() => {
    setBookings(existingBookings);
  }, [existingBookings]);

  const isSlotBooked = (optionId: number) => {
    return bookings.some(b => b.optionId === optionId);
  };

  const getSlotCapacity = (optionId: number) => {
    const signupInfo = currentSignups[optionId];
    if (signupInfo) {
      return {
        current: signupInfo.count,
        max: signupInfo.maxCapacity,
        names: signupInfo.names
      };
    }
    const option = options.find(o => o.id === optionId);
    return {
      current: 0,
      max: option?.maxCapacity || 1,
      names: []
    };
  };

  const isSlotFull = (optionId: number) => {
    const capacity = getSlotCapacity(optionId);
    return capacity.current >= capacity.max;
  };

  const toggleSlot = (optionId: number) => {
    if (disabled || adminPreview) return;
    
    let newBookings: SlotBookingInfo[];
    
    if (isSlotBooked(optionId)) {
      newBookings = bookings.filter(b => b.optionId !== optionId);
    } else {
      if (isSlotFull(optionId)) {
        return;
      }
      
      if (!allowMultipleSlots) {
        newBookings = [{ optionId, comment: comments[optionId] }];
      } else {
        newBookings = [...bookings, { optionId, comment: comments[optionId] }];
      }
    }
    
    setBookings(newBookings);
    onBookingChange(newBookings);
  };

  const updateComment = (optionId: number, comment: string) => {
    setComments(prev => ({ ...prev, [optionId]: comment }));
    
    if (isSlotBooked(optionId)) {
      const newBookings = bookings.map(b => 
        b.optionId === optionId ? { ...b, comment } : b
      );
      setBookings(newBookings);
      onBookingChange(newBookings);
    }
  };

  const locale = i18n.language === 'de' ? 'de-DE' : 'en-US';

  const formatTime = (dateVal: string | Date | null | undefined) => {
    if (!dateVal) return null;
    try {
      const date = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
      return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  };

  const getDateKey = (dateVal: string | Date | null | undefined) => {
    if (!dateVal) return null;
    try {
      const date = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
      return date.toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return null;
    }
  };

  const getDateSortKey = (dateVal: string | Date | null | undefined) => {
    if (!dateVal) return '0';
    try {
      const date = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
      return date.toISOString().slice(0, 10);
    } catch {
      return '0';
    }
  };

  const groupedOptions = (() => {
    const groups: { dateLabel: string | null; sortKey: string; options: PollOption[] }[] = [];
    const dateMap = new Map<string, { dateLabel: string | null; sortKey: string; options: PollOption[] }>();

    for (const option of options) {
      const dateLabel = getDateKey(option.startTime);
      const sortKey = getDateSortKey(option.startTime);
      const key = sortKey || '__none__';
      if (!dateMap.has(key)) {
        const group = { dateLabel, sortKey, options: [] as PollOption[] };
        dateMap.set(key, group);
        groups.push(group);
      }
      dateMap.get(key)!.options.push(option);
    }

    groups.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return groups;
  })();

  const hasMultipleDates = groupedOptions.filter(g => g.dateLabel).length > 1;

  const parseSlotTitle = (text: string) => {
    const separatorIndex = text.indexOf(' – ');
    if (separatorIndex === -1) {
      const dashIndex = text.indexOf(' - ');
      if (dashIndex !== -1 && dashIndex < text.length / 2) {
        return text.slice(dashIndex + 3).trim();
      }
      return text;
    }
    return text.slice(separatorIndex + 3).trim();
  };

  const renderSlot = (option: PollOption, showDateInTitle: boolean) => {
    const isBooked = isSlotBooked(option.id);
    const capacity = getSlotCapacity(option.id);
    const isFull = capacity.current >= capacity.max;
    const progressPercent = capacity.max > 0 ? (capacity.current / capacity.max) * 100 : 0;
    const startTime = formatTime(option.startTime);
    const endTime = formatTime(option.endTime);
    const spotsRemaining = capacity.max - capacity.current;
    const title = showDateInTitle ? option.text : parseSlotTitle(option.text);

    return (
      <div
        key={option.id}
        className={`border rounded-xl p-4 transition-all ${
          isBooked
            ? 'border-green-500 bg-green-50 dark:bg-green-900/30 dark:border-green-600 ring-1 ring-green-500/20'
            : isFull
              ? 'border-gray-300 bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700 opacity-60'
              : 'border-border hover:border-green-400 hover:shadow-md dark:hover:border-green-500'
        }`}
        data-testid={`slot-option-${option.id}`}
      >
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-base truncate">{title}</h4>
                {(startTime || endTime) && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-base font-medium text-foreground">
                      {startTime && endTime ? `${startTime} – ${endTime}` : startTime || endTime}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Badge
                  variant={isFull ? 'secondary' : 'default'}
                  className={`text-sm px-2.5 py-1 ${isFull ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'}`}
                >
                  <Users className="w-3.5 h-3.5 mr-1" />
                  {capacity.current}/{capacity.max}
                </Badge>

                {!adminPreview && (
                  <Button
                    type="button"
                    size="sm"
                    variant={isBooked ? 'default' : 'outline'}
                    className={`min-w-[110px] ${
                      isBooked
                        ? 'polly-button-success'
                        : isFull
                          ? 'opacity-50 cursor-not-allowed'
                          : 'polly-button-organization-outline'
                    }`}
                    onClick={() => toggleSlot(option.id)}
                    disabled={disabled || (isFull && !isBooked)}
                    data-testid={`button-book-slot-${option.id}`}
                  >
                    {isBooked ? (
                      <><Check className="w-4 h-4 mr-1.5" />{t('organizationSlot.registered')}</>
                    ) : isFull ? (
                      t('organizationSlot.fullyBooked')
                    ) : (
                      t('organizationSlot.register')
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-2.5 space-y-1">
              <Progress value={progressPercent} className="h-1.5" />
              <p className="text-xs text-muted-foreground">
                {isFull
                  ? t('organizationSlot.fullyBooked')
                  : spotsRemaining === 1
                    ? t('organizationSlot.spotFree', { count: spotsRemaining })
                    : t('organizationSlot.spotsFree', { count: spotsRemaining })
                }
              </p>
            </div>

            {capacity.names.length > 0 && (
              <div className="text-sm text-muted-foreground mt-2">
                <span className="font-medium">{t('organizationSlot.registeredLabel')} </span>
                {capacity.names.join(', ')}
              </div>
            )}

            {isBooked && !adminPreview && (
              <div className="mt-3">
                <Label className="text-sm flex items-center mb-1">
                  <MessageCircle className="w-3 h-3 mr-1" />
                  {t('organizationSlot.commentOptional')}
                </Label>
                <Textarea
                  value={comments[option.id] || ''}
                  onChange={(e) => updateComment(option.id, e.target.value)}
                  placeholder={t('organizationSlot.commentPlaceholder')}
                  className="mt-1 text-sm"
                  rows={2}
                  disabled={disabled}
                  data-testid={`input-comment-${option.id}`}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {!allowMultipleSlots && bookings.length === 0 && !adminPreview && (
        <div className="text-sm text-muted-foreground mb-4 p-3 bg-muted rounded-lg">
          <strong>{t('organizationSlot.note')}</strong> {t('organizationSlot.singleSlotNote')}
        </div>
      )}

      {hasMultipleDates ? (
        groupedOptions.map((group) => (
          <div key={group.sortKey} className="space-y-2">
            {group.dateLabel && (
              <div className="flex items-center gap-2 pt-4 pb-2 border-b border-border/50">
                <CalendarDays className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">{group.dateLabel}</h3>
              </div>
            )}
            <div className="space-y-2">
              {group.options.map((option) => renderSlot(option, false))}
            </div>
          </div>
        ))
      ) : (
        <div className="space-y-2">
          {options.map((option) => renderSlot(option, true))}
        </div>
      )}

      {bookings.length > 0 && !adminPreview && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-700 dark:text-green-300">
            <strong>{t('organizationSlot.yourSelection')}</strong> {bookings.length === 1
              ? t('organizationSlot.registeredForSlot', { count: bookings.length })
              : t('organizationSlot.registeredForSlots', { count: bookings.length })
            }
          </p>
        </div>
      )}
    </div>
  );
}
