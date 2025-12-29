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

const GERMAN_WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export function formatScheduleOptionWithGermanWeekday(text: string, startTime?: string | null): { 
  isSchedule: boolean; 
  dateWithWeekday: string; 
  time: string;
} {
  // Try to parse as schedule format: "DD.MM.YYYY HH:MM - HH:MM" or similar
  const match = text.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?\s*(.*)$/);
  
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const yearPart = match[3];
    const timePart = match[4] || '';
    
    // Determine the year
    let year: number;
    if (yearPart) {
      year = yearPart.length === 2 ? 2000 + parseInt(yearPart) : parseInt(yearPart);
    } else {
      // Use startTime if available, otherwise current year
      year = startTime ? new Date(startTime).getFullYear() : new Date().getFullYear();
    }
    
    // Create date and get German weekday
    const date = new Date(year, month - 1, day);
    const weekday = GERMAN_WEEKDAYS[date.getDay()];
    
    // Format date with German weekday
    const formattedDate = `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}. ${weekday}`;
    
    return {
      isSchedule: true,
      dateWithWeekday: formattedDate,
      time: timePart.trim()
    };
  }
  
  // If startTime is available, use it to format
  if (startTime) {
    try {
      const date = new Date(startTime);
      const weekday = GERMAN_WEEKDAYS[date.getDay()];
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const formattedDate = `${day}.${month}. ${weekday}`;
      
      // Extract time from text if available
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
