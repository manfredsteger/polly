import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatScheduleOptionText(text: string): { date: string; time: string } | null {
  const match = text.match(/^(\d{1,2}\.\d{1,2}\.\d{4})\s+(.+)$/);
  if (match) {
    return { date: match[1], time: match[2] };
  }
  return null;
}

function getLocaleCode(locale: string): string {
  const localeMap: Record<string, string> = {
    'de': 'de-DE',
    'en': 'en-US',
    'fr': 'fr-FR',
    'es': 'es-ES',
    'it': 'it-IT',
    'nl': 'nl-NL',
    'pt': 'pt-PT',
    'pl': 'pl-PL',
  };
  return localeMap[locale] || locale || 'en-US';
}

function getLocalizedWeekday(date: Date, locale: string = 'en'): string {
  const localeCode = getLocaleCode(locale);
  try {
    return date.toLocaleDateString(localeCode, { weekday: 'long' });
  } catch {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }
}

export interface FormattedScheduleOption {
  isSchedule: boolean;
  dateWithWeekday: string;
  time: string;
}

export function formatScheduleOptionWithWeekday(
  text: string, 
  startTime?: string | null, 
  locale: string = 'en'
): FormattedScheduleOption {
  const match = text.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?\s*(.*)$/);
  
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const yearPart = match[3];
    const timePart = match[4] || '';
    
    let year: number;
    if (yearPart) {
      year = yearPart.length === 2 ? 2000 + parseInt(yearPart) : parseInt(yearPart);
    } else {
      year = startTime ? new Date(startTime).getFullYear() : new Date().getFullYear();
    }
    
    const date = new Date(year, month - 1, day);
    const weekday = getLocalizedWeekday(date, locale);
    
    const formattedDate = `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year} ${weekday}`;
    
    return {
      isSchedule: true,
      dateWithWeekday: formattedDate,
      time: timePart.trim()
    };
  }
  
  if (startTime) {
    try {
      const date = new Date(startTime);
      const weekday = getLocalizedWeekday(date, locale);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const formattedDate = `${day}.${month}.${year} ${weekday}`;
      
      const timeMatch = text.match(/(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/);
      const timePart = timeMatch ? timeMatch[1] : '';
      
      return {
        isSchedule: true,
        dateWithWeekday: formattedDate,
        time: timePart
      };
    } catch {
      // Fall through to return non-schedule format
    }
  }
  
  return {
    isSchedule: false,
    dateWithWeekday: text,
    time: ''
  };
}

/**
 * @deprecated Use formatScheduleOptionWithWeekday instead
 */
export const formatScheduleOptionWithGermanWeekday = formatScheduleOptionWithWeekday;
