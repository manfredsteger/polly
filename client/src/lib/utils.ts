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
