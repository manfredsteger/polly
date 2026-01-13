import { Poll, PollOption, Vote, CalendarSettings, calendarSettingsSchema } from "@shared/schema";

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

export interface CalendarExportContext {
  settings: CalendarSettings;
  language: 'de' | 'en';
  voterEmail?: string;
  userVotedOptionIds?: Set<number>;
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

function getLocalizedPrefixes(settings: CalendarSettings, language: 'de' | 'en'): {
  tentative: string;
  confirmed: string;
  myChoice: string;
} {
  const localized = settings.prefixesLocalized[language];
  if (localized) {
    return localized;
  }
  return {
    tentative: settings.tentativePrefix,
    confirmed: settings.confirmedPrefix,
    myChoice: settings.myChoicePrefix,
  };
}

function isPollCompleted(poll: Poll): boolean {
  if (!poll.isActive) return true;
  if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) return true;
  return false;
}

function buildEventTitle(
  baseTitle: string,
  poll: Poll,
  optionId: number,
  context: CalendarExportContext
): string {
  const { settings, language, userVotedOptionIds } = context;
  const prefixes = getLocalizedPrefixes(settings, language);
  const parts: string[] = [];

  if (settings.markOwnChoices && userVotedOptionIds?.has(optionId)) {
    parts.push(prefixes.myChoice);
  }

  if (settings.prefixEnabled) {
    const isCompleted = isPollCompleted(poll);
    if (isCompleted) {
      parts.push(`${prefixes.confirmed}:`);
    } else {
      parts.push(`${prefixes.tentative}:`);
    }
  }

  parts.push(baseTitle);
  return parts.join(' ');
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

function parseOptionDateTime(option: PollOption): { startTime: Date; endTime?: Date } | null {
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
      return null;
    }
  }

  return { startTime, endTime };
}

export interface PollWithOptionsAndVotes {
  poll: Poll;
  options: PollOption[];
  votes: Vote[];
}

export function getDefaultCalendarSettings(): CalendarSettings {
  return calendarSettingsSchema.parse({});
}

export function generatePollIcs(
  poll: Poll,
  options: PollOption[],
  votes: Vote[],
  baseUrl: string,
  context?: CalendarExportContext
): string {
  const settings = context?.settings || getDefaultCalendarSettings();
  const language = context?.language || 'de';
  const voterEmail = context?.voterEmail;

  const userVotedOptionIds = new Set<number>();
  if (voterEmail) {
    votes.filter(v => v.voterEmail === voterEmail && v.response === 'yes')
      .forEach(v => userVotedOptionIds.add(v.optionId));
  }

  const effectiveContext: CalendarExportContext = {
    settings,
    language,
    voterEmail,
    userVotedOptionIds,
  };

  const events: CalendarEvent[] = [];

  for (const option of options) {
    if (settings.exportScope === 'own_yes') {
      if (!userVotedOptionIds.has(option.id)) {
        continue;
      }
    }

    const dateTime = parseOptionDateTime(option);
    if (!dateTime) continue;

    const { startTime, endTime } = dateTime;

    const yesCount = votes.filter(v => v.optionId === option.id && v.response === 'yes').length;
    const maybeCount = votes.filter(v => v.optionId === option.id && v.response === 'maybe').length;
    const uid = `poll-${poll.id}-option-${option.id}@polly`;

    const votesLabel = language === 'de' 
      ? `Stimmen: ${yesCount} Ja, ${maybeCount} Vielleicht`
      : `Votes: ${yesCount} Yes, ${maybeCount} Maybe`;

    const description = poll.description
      ? `${poll.description}\n\n${votesLabel}`
      : votesLabel;

    const baseTitle = `${poll.title}: ${option.text}`;
    const title = buildEventTitle(baseTitle, poll, option.id, effectiveContext);

    events.push({
      uid,
      title,
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
  baseUrl: string,
  context?: CalendarExportContext
): string {
  const settings = context?.settings || getDefaultCalendarSettings();
  const language = context?.language || 'de';

  const events: CalendarEvent[] = [];

  for (const { poll, options, votes } of participations) {
    const userVotes = votes.filter(v => v.response === 'yes');
    const userVotedOptionIds = new Set(userVotes.map(v => v.optionId));

    const effectiveContext: CalendarExportContext = {
      settings,
      language,
      userVotedOptionIds,
    };

    for (const vote of userVotes) {
      const option = options.find(o => o.id === vote.optionId);
      if (!option) continue;

      const dateTime = parseOptionDateTime(option);
      if (!dateTime) continue;

      const { startTime, endTime } = dateTime;

      const uid = `participation-${poll.id}-${vote.id}@polly`;

      let baseTitle = poll.title;
      if (option.text && option.text !== poll.title) {
        baseTitle = `${poll.title}: ${option.text}`;
      }

      const title = buildEventTitle(baseTitle, poll, option.id, effectiveContext);

      const commentLabel = language === 'de' ? 'Ihr Kommentar' : 'Your comment';

      events.push({
        uid,
        title,
        description: [
          poll.description,
          vote.comment ? `${commentLabel}: ${vote.comment}` : null,
        ].filter(Boolean).join('\n\n') || undefined,
        startTime,
        endTime,
        url: `${baseUrl}/poll/${poll.publicToken}`,
      });
    }
  }

  const calendarName = language === 'de' 
    ? `Polly - ${userName}'s Termine`
    : `Polly - ${userName}'s Events`;

  return generateCalendar(events, calendarName);
}

export function generateSingleEventIcs(
  poll: Poll,
  option: PollOption,
  baseUrl: string,
  context?: CalendarExportContext
): string {
  const settings = context?.settings || getDefaultCalendarSettings();
  const language = context?.language || 'de';

  const effectiveContext: CalendarExportContext = {
    settings,
    language,
    userVotedOptionIds: new Set(),
  };

  const dateTime = parseOptionDateTime(option);
  if (!dateTime) {
    return generateCalendar([], poll.title);
  }

  const { startTime, endTime } = dateTime;

  const baseTitle = `${poll.title}: ${option.text}`;
  const title = buildEventTitle(baseTitle, poll, option.id, effectiveContext);

  const event: CalendarEvent = {
    uid: `poll-${poll.id}-option-${option.id}@polly`,
    title,
    description: poll.description || undefined,
    startTime,
    endTime,
    url: `${baseUrl}/poll/${poll.publicToken}`,
  };

  return generateCalendar([event], poll.title);
}
