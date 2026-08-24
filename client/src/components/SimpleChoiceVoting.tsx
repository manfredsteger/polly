import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { Check } from 'lucide-react';
import { type PollOption } from '@shared/schema';
import { formatScheduleOptionWithWeekday } from '@/lib/utils';

interface SimpleChoiceVotingProps {
  options: PollOption[];
  maxSelections: number; // 1 = single choice (radio behavior), >1 = limited multiple choice
  selectedOptionIds: number[];
  onChange: (selectedOptionIds: number[]) => void;
  disabled?: boolean;
  adminPreview?: boolean;
  expiredOptionIds?: Set<number>;
}

function OptionLabel({ text, startTime, locale }: { text: string; startTime?: Date | string | null; locale: string }) {
  const startTimeStr = startTime instanceof Date ? startTime.toISOString() : startTime;
  const formatted = formatScheduleOptionWithWeekday(text, startTimeStr ?? undefined, locale);
  if (formatted.isSchedule) {
    return <><span className="font-bold">{formatted.dateWithWeekday}</span> {formatted.time}</>;
  }
  return <>{text}</>;
}

export function SimpleChoiceVoting({
  options,
  maxSelections,
  selectedOptionIds,
  onChange,
  disabled = false,
  adminPreview = false,
  expiredOptionIds,
}: SimpleChoiceVotingProps) {
  const { t, i18n } = useTranslation();
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string } | null>(null);
  const isSingleChoice = maxSelections <= 1;
  const selectedSet = new Set(selectedOptionIds);
  const limitReached = !isSingleChoice && selectedOptionIds.length >= maxSelections;

  const toggleOption = (optionId: number) => {
    if (disabled) return;
    if (isSingleChoice) {
      onChange(selectedSet.has(optionId) ? [] : [optionId]);
      return;
    }
    if (selectedSet.has(optionId)) {
      onChange(selectedOptionIds.filter((id) => id !== optionId));
    } else {
      if (selectedOptionIds.length >= maxSelections) return;
      onChange([...selectedOptionIds, optionId]);
    }
  };

  const sortedOptions = [...options].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="space-y-3" role={isSingleChoice ? 'radiogroup' : 'group'} data-testid="simple-choice-voting">
      <p className="text-sm text-muted-foreground" data-testid="text-selection-hint">
        {isSingleChoice
          ? t('simpleChoice.selectOneHint')
          : t('simpleChoice.selectUpToHint', { count: maxSelections })}
      </p>
      {sortedOptions.map((option) => {
        const isSelected = selectedSet.has(option.id);
        const isExpired = expiredOptionIds?.has(option.id) ?? false;
        const isBlocked = disabled || isExpired || (!isSelected && limitReached);
        return (
          <button
            key={option.id}
            type="button"
            role={isSingleChoice ? 'radio' : 'checkbox'}
            aria-checked={isSelected}
            aria-disabled={isBlocked}
            onClick={() => !isExpired && !(!isSelected && limitReached) && toggleOption(option.id)}
            disabled={disabled}
            className={`w-full flex items-center gap-3 rounded-lg border p-4 text-left transition-colors
              ${isSelected ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-muted'}
              ${isExpired ? 'opacity-50 cursor-not-allowed' : ''}
              ${!isSelected && limitReached && !disabled ? 'opacity-60 cursor-not-allowed' : ''}
              ${adminPreview || disabled ? 'cursor-default' : ''}`}
            data-testid={`simple-choice-option-${option.id}`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center border
                ${isSingleChoice ? 'rounded-full' : 'rounded-sm'}
                ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 bg-background'}`}
              aria-hidden="true"
            >
              {isSelected && (isSingleChoice
                ? <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                : <Check className="h-3.5 w-3.5" />)}
            </span>
            {option.imageUrl && (
              <img
                src={option.imageUrl}
                alt={option.altText || option.text}
                className="h-12 w-12 rounded-md object-cover shrink-0 cursor-zoom-in"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxImage({ src: option.imageUrl!, alt: option.altText || option.text });
                }}
              />
            )}
            <span className="flex-1 text-sm font-medium">
              <OptionLabel text={option.text} startTime={option.startTime} locale={i18n.language === 'de' ? 'de' : 'en'} />
              {isExpired && (
                <span className="ml-2 text-xs text-muted-foreground">({t('votingInterface.expired')})</span>
              )}
            </span>
          </button>
        );
      })}
      {!isSingleChoice && (
        <p className="text-xs text-muted-foreground" data-testid="text-selection-count">
          {t('simpleChoice.selectedCount', { selected: selectedOptionIds.length, max: maxSelections })}
        </p>
      )}
      {lightboxImage && (
        <Lightbox
          open={!!lightboxImage}
          close={() => setLightboxImage(null)}
          slides={[{ src: lightboxImage.src, alt: lightboxImage.alt }]}
          carousel={{ finite: true }}
          render={{ buttonPrev: () => null, buttonNext: () => null }}
        />
      )}
    </div>
  );
}
