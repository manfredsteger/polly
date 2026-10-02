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
            disabled={isBlocked}
            className={`group w-full flex min-h-[68px] items-center gap-3 rounded-xl border-2 p-4 text-left shadow-sm transition-all
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
              ${isSelected
                ? 'border-primary bg-primary text-primary-foreground shadow-md'
                : 'border-border bg-background hover:border-primary/60 hover:bg-primary/5 hover:shadow-md'}
              ${isExpired ? 'opacity-50 cursor-not-allowed' : ''}
              ${!isSelected && limitReached && !disabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${adminPreview || disabled ? 'cursor-default' : 'cursor-pointer'}`}
            data-testid={`simple-choice-option-${option.id}`}
            data-state={isSelected ? 'checked' : 'unchecked'}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center border-2
                ${isSingleChoice ? 'rounded-full' : 'rounded-sm'}
                ${isSelected
                  ? 'border-primary-foreground bg-primary-foreground text-primary'
                  : 'border-muted-foreground/60 bg-background group-hover:border-primary'}`}
              aria-hidden="true"
            >
              {isSelected && (isSingleChoice
                ? <span className="h-3.5 w-3.5 rounded-full bg-primary" />
                : <Check className="h-4 w-4 stroke-[3]" />)}
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
            <span className={`flex-1 text-sm font-semibold ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
              <OptionLabel text={option.text} startTime={option.startTime} locale={i18n.language === 'de' ? 'de' : 'en'} />
              {isExpired && (
                <span className={`ml-2 text-xs ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  ({t('votingInterface.expired')})
                </span>
              )}
            </span>
            {isSelected && (
              <span className="shrink-0 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-xs font-bold">
                {t('simpleChoice.selected')}
              </span>
            )}
          </button>
        );
      })}
      {!isSingleChoice && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground" data-testid="text-selection-count">
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
