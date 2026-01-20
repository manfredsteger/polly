export const POLL_TYPES = {
  SCHEDULE: 'schedule',
  SURVEY: 'survey', 
  ORGANIZATION: 'organization',
} as const;

export type PollType = typeof POLL_TYPES[keyof typeof POLL_TYPES];

export const VOTE_VALUES = {
  YES: 'yes',
  NO: 'no',
  MAYBE: 'maybe',
} as const;

export type VoteValue = typeof VOTE_VALUES[keyof typeof VOTE_VALUES];

export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const POLL_VISIBILITY = {
  PUBLIC: 'public',
  PRIVATE: 'private',
} as const;

export type PollVisibility = typeof POLL_VISIBILITY[keyof typeof POLL_VISIBILITY];

export const SESSION = {
  COOKIE_NAME: 'polly.sid',
  MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,
} as const;

export const UPLOAD = {
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  BLOCKED_TYPES: ['image/svg+xml'],
} as const;

export const RATE_LIMIT = {
  LOGIN_MAX_ATTEMPTS: 5,
  LOGIN_LOCKOUT_MINUTES: 15,
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;

export const DATE_FORMATS = {
  DISPLAY_DATE: 'dd.MM.yyyy',
  DISPLAY_DATETIME: 'dd.MM.yyyy HH:mm',
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
} as const;

export const LANGUAGES = {
  GERMAN: 'de',
  ENGLISH: 'en',
  DEFAULT: 'de',
} as const;

export type Language = typeof LANGUAGES[keyof typeof LANGUAGES];

export const CALENDAR = {
  ICS_PRODID: '-//Polly//Polling System//EN',
  WEBCAL_PROTOCOL: 'webcal://',
} as const;
