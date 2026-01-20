import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, uuid, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"), // user, admin, manager
  organization: text("organization"),
  passwordHash: text("password_hash"), // For local login (null for OIDC-only users)
  keycloakId: text("keycloak_id").unique(), // OIDC subject identifier from Keycloak
  provider: text("provider").default("local"), // 'local' or 'keycloak'
  themePreference: text("theme_preference").default("system"), // 'light', 'dark', or 'system'
  languagePreference: text("language_preference").default("de"), // 'de' or 'en'
  calendarToken: text("calendar_token").unique(), // Secret token for calendar subscription feed
  isTestData: boolean("is_test_data").default(false).notNull(), // Test accounts cannot log in
  isInitialAdmin: boolean("is_initial_admin").default(false).notNull(), // Initial admin created on first start - shows warning banner
  deletionRequestedAt: timestamp("deletion_requested_at"), // GDPR: User requested account deletion
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const polls = pgTable("polls", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // "schedule", "survey", or "organization"
  userId: integer("user_id"), // null for anonymous
  creatorEmail: text("creator_email"), // for anonymous polls
  adminToken: text("admin_token").notNull().unique(), // for admin access
  publicToken: text("public_token").notNull().unique(), // for public access
  isActive: boolean("is_active").default(true).notNull(),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  allowAnonymousVoting: boolean("allow_anonymous_voting").default(true).notNull(),
  allowMultipleSlots: boolean("allow_multiple_slots").default(true).notNull(), // for organization polls: can one person sign up for multiple slots?
  maxSlotsPerUser: integer("max_slots_per_user"), // for organization polls: max number of slots per user (null = unlimited when allowMultipleSlots is true)
  allowVoteEdit: boolean("allow_vote_edit").default(false).notNull(), // allow voters to edit their votes after submission
  allowVoteWithdrawal: boolean("allow_vote_withdrawal").default(false).notNull(), // allow voters to completely withdraw/delete their votes
  resultsPublic: boolean("results_public").default(true).notNull(), // whether results are visible to everyone or only to the creator
  allowMaybe: boolean("allow_maybe").default(true).notNull(), // whether "maybe" option is available for voting
  isTestData: boolean("is_test_data").default(false).notNull(), // Test polls excluded from stats
  expiresAt: timestamp("expires_at"),
  finalOptionId: integer("final_option_id"), // Creator's final chosen option - removes other options from calendar exports
  enableExpiryReminder: boolean("enable_expiry_reminder").default(false).notNull(),
  expiryReminderHours: integer("expiry_reminder_hours").default(24), // hours before expiry to send reminder
  expiryReminderSent: boolean("expiry_reminder_sent").default(false).notNull(), // has the expiry reminder been sent?
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("polls_user_id_idx").on(table.userId),
  index("polls_type_idx").on(table.type),
  index("polls_is_active_idx").on(table.isActive),
  index("polls_expires_at_idx").on(table.expiresAt),
]);

export const pollOptions = pgTable("poll_options", {
  id: serial("id").primaryKey(),
  pollId: uuid("poll_id").notNull(),
  text: text("text").notNull(),
  imageUrl: text("image_url"), // for uploaded images
  altText: text("alt_text"), // alt text for accessibility
  startTime: timestamp("start_time"), // for schedule polls
  endTime: timestamp("end_time"), // for schedule polls
  maxCapacity: integer("max_capacity"), // for organization polls: max signups per slot (null = unlimited)
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("poll_options_poll_id_idx").on(table.pollId),
]);

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  pollId: uuid("poll_id").notNull(),
  optionId: integer("option_id").notNull(),
  voterName: text("voter_name").notNull(),
  voterEmail: text("voter_email").notNull(),
  userId: integer("user_id"), // null for anonymous votes
  voterKey: text("voter_key"), // Unique voter identifier: "user:123" or "device:abc123" (for deduplication)
  voterSource: text("voter_source"), // "user" (logged in) or "device" (guest with device token)
  response: text("response").notNull(), // "yes", "maybe", "no", or "signup" for organization polls
  comment: text("comment"), // optional comment (e.g., contact info, which cake they bring)
  voterEditToken: text("voter_edit_token"), // Unique token for editing votes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("votes_poll_id_idx").on(table.pollId),
  index("votes_option_id_idx").on(table.optionId),
  index("votes_voter_email_idx").on(table.voterEmail),
  index("votes_voter_key_idx").on(table.voterKey),
]);

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notification logs - tracks all sent notifications for rate limiting and audit
export const notificationLogs = pgTable("notification_logs", {
  id: serial("id").primaryKey(),
  pollId: uuid("poll_id").notNull(),
  type: text("type").notNull(), // "expiry_reminder", "manual_reminder", "vote_confirmation", "poll_created"
  recipientEmail: text("recipient_email").notNull(),
  sentBy: text("sent_by"), // user id or "system" for automatic reminders
  sentByGuest: boolean("sent_by_guest").default(false).notNull(),
  success: boolean("success").default(true).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Password reset tokens - for secure password reset workflow
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"), // null if not yet used
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Email change tokens - for secure email change confirmation workflow
export const emailChangeTokens = pgTable("email_change_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  newEmail: text("new_email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"), // null if not yet used
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Test runs - for storing automated test execution history
export const testRuns = pgTable("test_runs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("running"), // running, completed, failed
  triggeredBy: text("triggered_by").notNull().default("manual"), // manual, scheduled
  totalTests: integer("total_tests").default(0),
  passed: integer("passed").default(0),
  failed: integer("failed").default(0),
  skipped: integer("skipped").default(0),
  duration: integer("duration"), // in milliseconds
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Test results - individual test results for each run
export const testResults = pgTable("test_results", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull(),
  testFile: text("test_file").notNull(),
  testName: text("test_name").notNull(),
  category: text("category").notNull(), // auth, api, polls, security, database
  status: text("status").notNull(), // passed, failed, skipped
  duration: integer("duration"), // in milliseconds
  error: text("error"),
  errorStack: text("error_stack"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Email templates - customizable email designs stored as JSON
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().unique(), // Template type: poll_created, invitation, vote_confirmation, reminder, password_reset, email_change, password_changed, test_report
  name: text("name").notNull(), // Display name in admin panel
  subject: text("subject").notNull(), // Email subject line (supports variables)
  jsonContent: jsonb("json_content").notNull(), // email-builder-js JSON structure
  htmlContent: text("html_content"), // Pre-rendered HTML (optional cache)
  textContent: text("text_content"), // Plain text version
  variables: jsonb("variables").notNull().default([]), // Available variables for this template type
  isDefault: boolean("is_default").default(false).notNull(), // Is this the system default?
  isActive: boolean("is_active").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Test configurations - stores which tests are enabled/disabled
export const testConfigurations = pgTable("test_configurations", {
  id: serial("id").primaryKey(),
  testId: text("test_id").notNull().unique(), // unique identifier: file:testName
  testFile: text("test_file").notNull(),
  testName: text("test_name").notNull(),
  testType: text("test_type").notNull(), // unit, integration, e2e, data
  category: text("category").notNull(), // auth, api, polls, security, database
  description: text("description"),
  enabled: boolean("enabled").notNull().default(true),
  lastStatus: text("last_status"), // passed, failed, skipped, null
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ClamAV scan logs - audit trail for all virus scans
export const clamavScanLogs = pgTable("clamav_scan_logs", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  fileSize: integer("file_size").notNull(), // bytes
  mimeType: text("mime_type"),
  scanStatus: text("scan_status").notNull(), // "clean", "infected", "error"
  virusName: text("virus_name"), // null if clean
  errorMessage: text("error_message"), // null if no error
  actionTaken: text("action_taken").notNull(), // "allowed", "blocked", "quarantined"
  uploaderUserId: integer("uploader_user_id"), // null for anonymous
  uploaderEmail: text("uploader_email"), // email of uploader (guest or user)
  requestIp: text("request_ip"), // IP address of request
  scanDurationMs: integer("scan_duration_ms"), // scan duration in milliseconds
  adminNotifiedAt: timestamp("admin_notified_at"), // when admin was notified (if applicable)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  polls: many(polls),
  votes: many(votes),
}));

export const pollsRelations = relations(polls, ({ one, many }) => ({
  user: one(users, {
    fields: [polls.userId],
    references: [users.id],
  }),
  options: many(pollOptions),
  votes: many(votes),
}));

export const pollOptionsRelations = relations(pollOptions, ({ one, many }) => ({
  poll: one(polls, {
    fields: [pollOptions.pollId],
    references: [polls.id],
  }),
  votes: many(votes),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  poll: one(polls, {
    fields: [votes.pollId],
    references: [polls.id],
  }),
  option: one(pollOptions, {
    fields: [votes.optionId],
    references: [pollOptions.id],
  }),
  user: one(users, {
    fields: [votes.userId],
    references: [users.id],
  }),
}));

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  poll: one(polls, {
    fields: [notificationLogs.pollId],
    references: [polls.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertPollSchema = createInsertSchema(polls).omit({
  id: true,
  adminToken: true,
  publicToken: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPollOptionSchema = createInsertSchema(pollOptions).omit({
  id: true,
  createdAt: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertNotificationLogSchema = createInsertSchema(notificationLogs).omit({
  id: true,
  createdAt: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

export const insertEmailChangeTokenSchema = createInsertSchema(emailChangeTokens).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

export const insertTestRunSchema = createInsertSchema(testRuns).omit({
  id: true,
  startedAt: true,
});

export const insertTestResultSchema = createInsertSchema(testResults).omit({
  id: true,
  createdAt: true,
});

export const insertTestConfigurationSchema = createInsertSchema(testConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClamavScanLogSchema = createInsertSchema(clamavScanLogs).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Poll = typeof polls.$inferSelect;
export type InsertPoll = z.infer<typeof insertPollSchema>;

export type PollOption = typeof pollOptions.$inferSelect;
export type InsertPollOption = z.infer<typeof insertPollOptionSchema>;

export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

export type EmailChangeToken = typeof emailChangeTokens.$inferSelect;
export type InsertEmailChangeToken = z.infer<typeof insertEmailChangeTokenSchema>;

export type TestRun = typeof testRuns.$inferSelect;
export type InsertTestRun = z.infer<typeof insertTestRunSchema>;

export type TestResult = typeof testResults.$inferSelect;
export type InsertTestResult = z.infer<typeof insertTestResultSchema>;

export type TestConfiguration = typeof testConfigurations.$inferSelect;
export type InsertTestConfiguration = z.infer<typeof insertTestConfigurationSchema>;

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

export type ClamavScanLog = typeof clamavScanLogs.$inferSelect;
export type InsertClamavScanLog = z.infer<typeof insertClamavScanLogSchema>;

// Email template types
export const EMAIL_TEMPLATE_TYPES = [
  'poll_created',
  'invitation', 
  'vote_confirmation',
  'reminder',
  'password_reset',
  'email_change',
  'password_changed',
  'test_report',
] as const;

export type EmailTemplateType = typeof EMAIL_TEMPLATE_TYPES[number];

// Email template variable definitions per type
export const EMAIL_TEMPLATE_VARIABLES: Record<EmailTemplateType, { key: string; description: string }[]> = {
  poll_created: [
    { key: 'pollTitle', description: 'Titel der Umfrage' },
    { key: 'pollType', description: 'Umfragetyp (Terminumfrage, Umfrage, Orga-Liste)' },
    { key: 'publicLink', description: 'Öffentlicher Link zur Umfrage' },
    { key: 'adminLink', description: 'Admin-Link zur Umfrage' },
    { key: 'qrCodeUrl', description: 'QR-Code als Bild-URL' },
    { key: 'siteName', description: 'Name der Plattform' },
  ],
  invitation: [
    { key: 'pollTitle', description: 'Titel der Umfrage' },
    { key: 'inviterName', description: 'Name des Einladenden' },
    { key: 'publicLink', description: 'Link zur Umfrage' },
    { key: 'message', description: 'Optionale Nachricht' },
    { key: 'qrCodeUrl', description: 'QR-Code als Bild-URL' },
    { key: 'siteName', description: 'Name der Plattform' },
  ],
  vote_confirmation: [
    { key: 'voterName', description: 'Name des Abstimmenden' },
    { key: 'pollTitle', description: 'Titel der Umfrage' },
    { key: 'pollType', description: 'Umfragetyp' },
    { key: 'publicLink', description: 'Link zur Umfrage' },
    { key: 'resultsLink', description: 'Link zu den Ergebnissen' },
    { key: 'siteName', description: 'Name der Plattform' },
  ],
  reminder: [
    { key: 'senderName', description: 'Name des Absenders' },
    { key: 'pollTitle', description: 'Titel der Umfrage' },
    { key: 'pollLink', description: 'Link zur Umfrage' },
    { key: 'expiresAt', description: 'Ablaufdatum (formatiert)' },
    { key: 'qrCodeUrl', description: 'QR-Code als Bild-URL' },
    { key: 'siteName', description: 'Name der Plattform' },
  ],
  password_reset: [
    { key: 'resetLink', description: 'Link zum Passwort zurücksetzen' },
    { key: 'siteName', description: 'Name der Plattform' },
  ],
  email_change: [
    { key: 'oldEmail', description: 'Bisherige E-Mail-Adresse' },
    { key: 'newEmail', description: 'Neue E-Mail-Adresse' },
    { key: 'confirmLink', description: 'Bestätigungslink' },
    { key: 'siteName', description: 'Name der Plattform' },
  ],
  password_changed: [
    { key: 'siteName', description: 'Name der Plattform' },
  ],
  test_report: [
    { key: 'testRunId', description: 'Testlauf-ID' },
    { key: 'status', description: 'Status (bestanden/fehlgeschlagen)' },
    { key: 'totalTests', description: 'Gesamtzahl der Tests' },
    { key: 'passed', description: 'Anzahl bestandener Tests' },
    { key: 'failed', description: 'Anzahl fehlgeschlagener Tests' },
    { key: 'skipped', description: 'Anzahl übersprungener Tests' },
    { key: 'duration', description: 'Testdauer' },
    { key: 'startedAt', description: 'Startzeit' },
    { key: 'siteName', description: 'Name der Plattform' },
  ],
};

// Theme preference type
export const themePreferenceSchema = z.enum(['light', 'dark', 'system']);
export type ThemePreference = z.infer<typeof themePreferenceSchema>;

// Customization Settings Schemas - Maximum 12 theme colors
export const themeSettingsSchema = z.object({
  // Core branding colors (1-2)
  primaryColor: z.string().default('#f97316'), // Polly orange
  secondaryColor: z.string().default('#1e40af'), // Blue
  
  // Poll type colors (3-5)
  scheduleColor: z.string().default('#F97316'), // Orange - for Termin polls
  surveyColor: z.string().default('#72BEB7'), // Light Blue/Teal - for Umfrage polls  
  organizationColor: z.string().default('#7DB942'), // Green - for Orga polls
  
  // Semantic status colors (6-9)
  successColor: z.string().default('#22c55e'), // Green - success states
  warningColor: z.string().default('#f59e0b'), // Amber - warnings
  errorColor: z.string().default('#ef4444'), // Red - errors/critical
  infoColor: z.string().default('#3b82f6'), // Blue - informational
  
  // UI accent colors (10-12)
  accentColor: z.string().default('#8b5cf6'), // Purple - highlights, active states
  mutedColor: z.string().default('#64748b'), // Slate - muted/secondary text
  neutralColor: z.string().default('#f1f5f9'), // Light gray - backgrounds, borders
  
  // Mode setting
  defaultThemeMode: themePreferenceSchema.default('system'), // System default theme mode
});

export const brandingSettingsSchema = z.object({
  logoUrl: z.string().nullable().default(null),
  siteName: z.string().default('Poll'),
  siteNameAccent: z.string().default('y'), // The accented part of the name (Poll + y = Polly)
});

export const footerLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
});

export const footerSettingsSchema = z.object({
  description: z.string().default('Die Open-Source Abstimmungsplattform für Teams. Sicher, einfach und DSGVO-konform.'),
  copyrightText: z.string().default('© 2025 Polly. Open Source unter MIT-Lizenz.'),
  supportLinks: z.array(footerLinkSchema).default([
    { label: 'Hilfe & FAQ', url: '#' },
    { label: 'Kontakt', url: '#' },
    { label: 'Datenschutz', url: '#' },
    { label: 'Impressum', url: '#' },
  ]),
});

export const matrixSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  homeserverUrl: z.string().default(''),
  botUserId: z.string().default(''),
  botAccessToken: z.string().default(''),
  searchEnabled: z.boolean().default(true),
});

// Security Settings - Login Rate Limiter
export const loginRateLimitSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  maxAttempts: z.number().min(1).max(100).default(5),
  windowSeconds: z.number().min(60).max(86400).default(900), // 15 minutes default
  cooldownSeconds: z.number().min(60).max(86400).default(900), // 15 minutes default
});

export const securitySettingsSchema = z.object({
  loginRateLimit: loginRateLimitSettingsSchema.default({}),
});

export type LoginRateLimitSettings = z.infer<typeof loginRateLimitSettingsSchema>;
export type SecuritySettings = z.infer<typeof securitySettingsSchema>;

// Notification Settings Schema (Admin global settings)
export const notificationSettingsSchema = z.object({
  // Global switches
  enabled: z.boolean().default(true), // Master switch for all notifications
  expiryRemindersEnabled: z.boolean().default(true), // Allow auto-reminders before poll expiry
  manualRemindersEnabled: z.boolean().default(true), // Allow creators to manually send reminders
  
  // Default values for new polls
  defaultExpiryReminderHours: z.number().min(1).max(168).default(24), // Default: 24 hours before expiry
  
  // Guest restrictions (anti-spam)
  guestsCanSendReminders: z.boolean().default(false), // Can anonymous poll creators send reminders?
  guestReminderLimitPerPoll: z.number().min(0).max(10).default(1), // Max reminders per poll for guests (0 = disabled)
  userReminderLimitPerPoll: z.number().min(1).max(20).default(3), // Max reminders per poll for registered users
  
  // Rate limiting
  reminderCooldownMinutes: z.number().min(10).max(1440).default(60), // Minimum time between reminders for same poll
});

export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

// Session Timeout Settings Schema (role-based session expiry)
export const sessionTimeoutSettingsSchema = z.object({
  enabled: z.boolean().default(false), // Master switch for session timeout
  adminTimeoutMinutes: z.number().min(5).max(10080).default(480), // 8 hours default for admins
  managerTimeoutMinutes: z.number().min(5).max(10080).default(240), // 4 hours default for managers
  userTimeoutMinutes: z.number().min(5).max(10080).default(60), // 1 hour default for users
  showWarningMinutes: z.number().min(1).max(30).default(5), // Show warning X minutes before logout
});

export type SessionTimeoutSettings = z.infer<typeof sessionTimeoutSettingsSchema>;

// Calendar Settings Schema (ICS export configuration)
export const calendarSettingsSchema = z.object({
  // Prefix settings
  prefixEnabled: z.boolean().default(true), // Enable status prefixes in calendar entries
  tentativePrefix: z.string().default('Vorläufig'), // Prefix for running polls (DE default)
  confirmedPrefix: z.string().default('Bestätigt'), // Prefix for completed polls (DE default)
  myChoicePrefix: z.string().default('[Meine Wahl]'), // Prefix for user's own selections
  
  // Export scope settings
  exportScope: z.enum(['all', 'own_yes', 'final_only']).default('all'),
  // 'all' = export all poll options
  // 'own_yes' = only export options where user voted 'yes'
  // 'final_only' = only export final/confirmed dates (when creator sets final)
  
  // Marking settings
  markOwnChoices: z.boolean().default(false), // Add [My Choice] prefix for user's yes votes
  highlightFinalDate: z.boolean().default(true), // Add [CONFIRMED] prefix when creator sets final date
  
  // Localization - allows admin to override prefixes per language
  prefixesLocalized: z.record(z.string(), z.object({
    tentative: z.string(),
    confirmed: z.string(),
    myChoice: z.string(),
  })).default({
    de: { tentative: 'Vorläufig', confirmed: 'Bestätigt', myChoice: '[Meine Wahl]' },
    en: { tentative: 'Tentative', confirmed: 'Confirmed', myChoice: '[My Choice]' },
  }),
});

export type CalendarSettings = z.infer<typeof calendarSettingsSchema>;

// WCAG Accessibility Settings Schema
export const wcagAuditIssueSchema = z.object({
  token: z.string(), // CSS variable name, e.g. "--primary"
  originalValue: z.string(), // Original hex color
  contrastRatio: z.number(), // Calculated contrast ratio
  requiredRatio: z.number(), // Required ratio (4.5:1 for normal text)
  suggestedValue: z.string(), // WCAG-compliant hex color
});

export const wcagAuditResultSchema = z.object({
  runAt: z.string(), // ISO timestamp
  passed: z.boolean(),
  issues: z.array(wcagAuditIssueSchema),
  appliedCorrections: z.record(z.string(), z.string()).optional(), // token -> corrected value
});

export const wcagSettingsSchema = z.object({
  enforcementEnabled: z.boolean().default(false), // When true, auto-correct colors for WCAG compliance
  enforceDefaultTheme: z.boolean().default(true), // When true, use default WCAG-compliant colors; false = admin has customized
  lastAudit: wcagAuditResultSchema.optional(),
});

export type WcagAuditIssue = z.infer<typeof wcagAuditIssueSchema>;
export type WcagAuditResult = z.infer<typeof wcagAuditResultSchema>;
export type WcagSettings = z.infer<typeof wcagSettingsSchema>;

export const customizationSettingsSchema = z.object({
  theme: themeSettingsSchema.default({}),
  branding: brandingSettingsSchema.default({}),
  footer: footerSettingsSchema.default({}),
  matrix: matrixSettingsSchema.default({}),
  wcag: wcagSettingsSchema.default({}),
});

export type ThemeSettings = z.infer<typeof themeSettingsSchema>;
export type BrandingSettings = z.infer<typeof brandingSettingsSchema>;
export type FooterLink = z.infer<typeof footerLinkSchema>;
export type MatrixSettings = z.infer<typeof matrixSettingsSchema>;
export type FooterSettings = z.infer<typeof footerSettingsSchema>;
export type CustomizationSettings = z.infer<typeof customizationSettingsSchema>;

// Extended types for API responses
export type PollWithOptions = Poll & {
  options: PollOption[];
  votes: Vote[];
  user?: User;
};

export type VoteStats = {
  optionId: number;
  yesCount: number;
  maybeCount: number;
  noCount: number;
  score: number; // yes=2, maybe=1, no=0
};

export type PollResults = {
  poll: Poll;
  options: PollOption[];
  votes: Vote[];
  stats: VoteStats[];
  participantCount: number;
  responseRate: number;
};
