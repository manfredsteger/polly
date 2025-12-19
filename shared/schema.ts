import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, uuid } from "drizzle-orm/pg-core";
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
  isTestData: boolean("is_test_data").default(false).notNull(), // Test accounts cannot log in
  isInitialAdmin: boolean("is_initial_admin").default(false).notNull(), // Initial admin created on first start - shows warning banner
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
  allowVoteEdit: boolean("allow_vote_edit").default(false).notNull(), // allow voters to edit their votes after submission
  resultsPublic: boolean("results_public").default(true).notNull(), // whether results are visible to everyone or only to the creator
  isTestData: boolean("is_test_data").default(false).notNull(), // Test polls excluded from stats
  expiresAt: timestamp("expires_at"),
  // Notification settings per poll
  enableExpiryReminder: boolean("enable_expiry_reminder").default(false).notNull(),
  expiryReminderHours: integer("expiry_reminder_hours").default(24), // hours before expiry to send reminder
  expiryReminderSent: boolean("expiry_reminder_sent").default(false).notNull(), // has the expiry reminder been sent?
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  pollId: uuid("poll_id").notNull(),
  optionId: integer("option_id").notNull(),
  voterName: text("voter_name").notNull(),
  voterEmail: text("voter_email").notNull(),
  userId: integer("user_id"), // null for anonymous votes
  response: text("response").notNull(), // "yes", "maybe", "no", or "signup" for organization polls
  comment: text("comment"), // optional comment (e.g., contact info, which cake they bring)
  voterEditToken: text("voter_edit_token"), // Unique token for editing votes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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

// Theme preference type
export const themePreferenceSchema = z.enum(['light', 'dark', 'system']);
export type ThemePreference = z.infer<typeof themePreferenceSchema>;

// Customization Settings Schemas
export const themeSettingsSchema = z.object({
  primaryColor: z.string().default('#f97316'), // KITA orange
  secondaryColor: z.string().default('#1e40af'), // Blue
  // Feature-specific colors from Design Manual (Default values)
  scheduleColor: z.string().default('#F97316'), // Orange - for Termin polls
  surveyColor: z.string().default('#72BEB7'), // Light Blue/Teal - for Umfrage polls  
  organizationColor: z.string().default('#7DB942'), // Green - for Orga polls
  defaultThemeMode: themePreferenceSchema.default('system'), // System default theme mode
});

export const brandingSettingsSchema = z.object({
  logoUrl: z.string().nullable().default(null),
  siteName: z.string().default('KITA Poll'),
  siteNameAccent: z.string().default('Poll'), // The accented part of the name
});

export const footerLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
});

export const footerSettingsSchema = z.object({
  description: z.string().default('Die professionelle Abstimmungsplattform für KITA-Teams in Bayern. Sicher, einfach und DSGVO-konform.'),
  copyrightText: z.string().default('© 2025 KITA Bayern. Ein Projekt des Staatsinstituts für Frühpädagogik und Medienkompetenz (IFP).'),
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

export const customizationSettingsSchema = z.object({
  theme: themeSettingsSchema.default({}),
  branding: brandingSettingsSchema.default({}),
  footer: footerSettingsSchema.default({}),
  matrix: matrixSettingsSchema.default({}),
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
