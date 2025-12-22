import { Poll, PollOption, Vote } from "@shared/schema";

interface CalendarEvent {
  uid: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  location?: string;
  organizer?: string;
  url?: string;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function formatIcsDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

function generateEvent(event: CalendarEvent): string {
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(event.startTime)}`,
  ];

  if (event.endTime) {
    lines.push(`DTEND:${formatIcsDate(event.endTime)}`);
  } else {
    const endTime = new Date(event.startTime);
    endTime.setHours(endTime.getHours() + 1);
    lines.push(`DTEND:${formatIcsDate(endTime)}`);
  }

  lines.push(`SUMMARY:${escapeIcsText(event.title)}`);

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }

  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  if (event.organizer) {
    lines.push(`ORGANIZER:${escapeIcsText(event.organizer)}`);
  }

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

function generateCalendar(events: CalendarEvent[], calendarName: string = 'Polly Termine'): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Polly//Polling System//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    'X-WR-TIMEZONE:Europe/Berlin',
  ];

  for (const event of events) {
    lines.push(generateEvent(event));
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export interface PollWithOptionsAndVotes {
  poll: Poll;
  options: PollOption[];
  votes: Vote[];
}

export function generatePollIcs(
  poll: Poll,
  options: PollOption[],
  votes: Vote[],
  baseUrl: string
): string {
  const events: CalendarEvent[] = [];
  
  for (const option of options) {
    let startTime: Date;
    let endTime: Date | undefined;
    
    if (option.startTime) {
      startTime = new Date(option.startTime);
      endTime = option.endTime ? new Date(option.endTime) : undefined;
    } else {
      const dateMatch = option.text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      const timeMatch = option.text.match(/(\d{1,2}):(\d{2})/);
      
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        const hours = timeMatch ? parseInt(timeMatch[1]) : 9;
        const minutes = timeMatch ? parseInt(timeMatch[2]) : 0;
        startTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes);
      } else {
        continue;
      }
    }

    const yesCount = votes.filter(v => v.optionId === option.id && v.response === 'yes').length;
    const maybeCount = votes.filter(v => v.optionId === option.id && v.response === 'maybe').length;
    const uid = `poll-${poll.id}-option-${option.id}@polly`;
    
    const description = poll.description 
      ? `${poll.description}\n\nStimmen: ${yesCount} Ja, ${maybeCount} Vielleicht`
      : `Stimmen: ${yesCount} Ja, ${maybeCount} Vielleicht`;
    
    events.push({
      uid,
      title: `${poll.title}: ${option.text}`,
      description,
      startTime,
      endTime,
      url: `${baseUrl}/poll/${poll.publicToken}`,
    });
  }

  return generateCalendar(events, poll.title);
}

export function generateUserCalendarFeed(
  participations: PollWithOptionsAndVotes[],
  userName: string,
  baseUrl: string
): string {
  const events: CalendarEvent[] = [];

  for (const { poll, options, votes } of participations) {
    const userVotes = votes.filter(v => v.response === 'yes');
    
    for (const vote of userVotes) {
      const option = options.find(o => o.id === vote.optionId);
      if (!option) continue;

      let startTime: Date;
      let endTime: Date | undefined;

      if (option.startTime) {
        startTime = new Date(option.startTime);
        endTime = option.endTime ? new Date(option.endTime) : undefined;
      } else {
        const dateMatch = option.text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        const timeMatch = option.text.match(/(\d{1,2}):(\d{2})/);

        if (dateMatch) {
          const [, day, month, year] = dateMatch;
          const hours = timeMatch ? parseInt(timeMatch[1]) : 9;
          const minutes = timeMatch ? parseInt(timeMatch[2]) : 0;
          startTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes);
        } else {
          continue;
        }
      }

      const uid = `participation-${poll.id}-${vote.id}@polly`;

      let title = poll.title;
      if (option.text && option.text !== poll.title) {
        title = `${poll.title}: ${option.text}`;
      }

      events.push({
        uid,
        title,
        description: [
          poll.description,
          vote.comment ? `Ihr Kommentar: ${vote.comment}` : null,
        ].filter(Boolean).join('\n\n') || undefined,
        startTime,
        endTime,
        url: `${baseUrl}/poll/${poll.publicToken}`,
      });
    }
  }

  return generateCalendar(events, `Polly - ${userName}'s Termine`);
}

export function generateSingleEventIcs(
  poll: Poll,
  option: PollOption,
  baseUrl: string
): string {
  let startTime: Date;
  let endTime: Date | undefined;

  if (option.startTime) {
    startTime = new Date(option.startTime);
    endTime = option.endTime ? new Date(option.endTime) : undefined;
  } else {
    const dateMatch = option.text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    const timeMatch = option.text.match(/(\d{1,2}):(\d{2})/);

    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      const hours = timeMatch ? parseInt(timeMatch[1]) : 9;
      const minutes = timeMatch ? parseInt(timeMatch[2]) : 0;
      startTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes);
    } else {
      startTime = new Date();
    }
  }

  const event: CalendarEvent = {
    uid: `poll-${poll.id}-option-${option.id}@polly`,
    title: `${poll.title}: ${option.text}`,
    description: poll.description || undefined,
    startTime,
    endTime,
    url: `${baseUrl}/poll/${poll.publicToken}`,
  };

  return generateCalendar([event], poll.title);
}
