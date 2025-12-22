import { 
  users, polls, pollOptions, votes, systemSettings, notificationLogs,
  passwordResetTokens, emailChangeTokens,
  type User, type InsertUser,
  type Poll, type InsertPoll, type PollWithOptions,
  type PollOption, type InsertPollOption,
  type Vote, type InsertVote,
  type SystemSetting, type InsertSystemSetting,
  type NotificationLog, type InsertNotificationLog,
  type PasswordResetToken, type InsertPasswordResetToken,
  type EmailChangeToken, type InsertEmailChangeToken,
  type PollResults, type VoteStats,
  type CustomizationSettings, customizationSettingsSchema,
  type SecuritySettings, securitySettingsSchema,
  type NotificationSettings, notificationSettingsSchema,
  type SessionTimeoutSettings, sessionTimeoutSettingsSchema
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, count, isNull } from "drizzle-orm";

// Export db for direct database access in routes
export { db };
import { randomBytes } from "crypto";

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByKeycloakId(keycloakId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  updateUserLastLogin(id: number): Promise<void>;
  getAllUsers(): Promise<User[]>;
  getUserParticipatedPolls(userId: number): Promise<PollWithOptions[]>;
  deleteUser(id: number): Promise<void>;

  // Poll management
  createPoll(poll: InsertPoll, options: InsertPollOption[]): Promise<{ poll: Poll; adminToken: string; publicToken: string }>;
  getPoll(id: string): Promise<PollWithOptions | undefined>;
  getPollByAdminToken(token: string): Promise<PollWithOptions | undefined>;
  getPollByPublicToken(token: string): Promise<PollWithOptions | undefined>;
  updatePoll(id: string, updates: Partial<InsertPoll>): Promise<Poll>;
  deletePoll(id: string): Promise<void>;
  getUserPolls(userId: number): Promise<PollWithOptions[]>;
  getSharedPolls(userId: number): Promise<PollWithOptions[]>;
  getActivePolls(): Promise<PollWithOptions[]>;
  getAllPolls(): Promise<PollWithOptions[]>;

  // Poll options
  addPollOption(option: InsertPollOption): Promise<PollOption>;
  updatePollOption(id: number, updates: Partial<InsertPollOption>): Promise<PollOption>;
  deletePollOption(id: number): Promise<void>;

  // Voting
  vote(vote: InsertVote): Promise<Vote>;
  voteBulk(pollId: string, voterName: string, voterEmail: string, userId: number | null, voterEditToken: string | null, voteItems: Array<{ optionId: number; response: string }>): Promise<{ votes: Vote[]; alreadyVoted: boolean }>;
  updateVote(id: number, response: string): Promise<Vote>;
  deleteVote(id: number): Promise<void>;
  getUserVoteForOption(userId: number | undefined, optionId: number, voterName?: string): Promise<Vote | undefined>;
  getVotesByEmail(pollId: string, voterEmail: string): Promise<Vote[]>;
  getVotesByEditToken(editToken: string): Promise<Vote[]>;
  getPollResults(pollId: string): Promise<PollResults>;

  // System settings
  getSetting(key: string): Promise<SystemSetting | undefined>;
  setSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
  getSettings(): Promise<SystemSetting[]>;

  // Customization settings
  getCustomizationSettings(): Promise<CustomizationSettings>;
  setCustomizationSettings(settings: Partial<CustomizationSettings>): Promise<CustomizationSettings>;

  // Security settings
  getSecuritySettings(): Promise<SecuritySettings>;
  setSecuritySettings(settings: Partial<SecuritySettings>): Promise<SecuritySettings>;
  
  // Session timeout settings
  getSessionTimeoutSettings(): Promise<SessionTimeoutSettings>;
  setSessionTimeoutSettings(settings: Partial<SessionTimeoutSettings>): Promise<SessionTimeoutSettings>;

  // Notification settings
  getNotificationSettings(): Promise<NotificationSettings>;
  setNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings>;

  // Notification logs
  logNotification(log: InsertNotificationLog): Promise<NotificationLog>;
  getNotificationLogs(pollId: string): Promise<NotificationLog[]>;
  getManualReminderCount(pollId: string): Promise<number>;
  getLastManualReminderTime(pollId: string): Promise<Date | null>;
  getPollsNeedingExpiryReminder(): Promise<Poll[]>;
  markExpiryReminderSent(pollId: string): Promise<void>;

  // Analytics
  getSystemStats(): Promise<{
    totalUsers: number;
    activePolls: number;
    totalVotes: number;
    monthlyPolls: number;
  }>;
  
  getExtendedStats(): Promise<{
    totalUsers: number;
    activePolls: number;
    inactivePolls: number;
    totalPolls: number;
    totalVotes: number;
    monthlyPolls: number;
    weeklyPolls: number;
    todayPolls: number;
    schedulePolls: number;
    surveyPolls: number;
    organizationPolls: number;
    recentActivity: Array<{
      type: string;
      message: string;
      timestamp: Date;
      actor?: string;
      pollToken?: string;
    }>;
  }>;

  // Password reset tokens
  createPasswordResetToken(userId: number): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;

  // Email change tokens
  createEmailChangeToken(userId: number, newEmail: string): Promise<EmailChangeToken>;
  getEmailChangeToken(token: string): Promise<EmailChangeToken | undefined>;
  markEmailChangeTokenUsed(token: string): Promise<void>;
  deleteExpiredEmailChangeTokens(): Promise<void>;

  // Test data management
  purgeTestData(): Promise<{ deletedPolls: number; deletedUsers: number; deletedVotes: number; deletedOptions: number }>;
  getTestDataStats(): Promise<{ testPolls: number; testUsers: number; testVotes: number; testOptions: number }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Case-insensitive email lookup
    const [user] = await db.select().from(users).where(
      sql`LOWER(${users.email}) = LOWER(${email})`
    );
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUserByKeycloakId(keycloakId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.keycloakId, keycloakId));
    return user || undefined;
  }

  async updateUserLastLogin(id: number): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
  }

  async getUserParticipatedPolls(userId: number): Promise<PollWithOptions[]> {
    const user = await this.getUser(userId);
    if (!user) return [];

    const userVotes = await db.select({ pollId: votes.pollId })
      .from(votes)
      .where(eq(votes.voterEmail, user.email))
      .groupBy(votes.pollId);

    const pollIds = userVotes.map(v => v.pollId);
    
    if (pollIds.length === 0) return [];

    const participatedPolls = await Promise.all(
      pollIds.map(async (pollId) => {
        return this.getPoll(pollId);
      })
    );

    return participatedPolls.filter((p): p is PollWithOptions => p !== undefined);
  }

  async createPoll(insertPoll: InsertPoll, options: InsertPollOption[]): Promise<{ poll: Poll; adminToken: string; publicToken: string }> {
    const adminToken = randomBytes(32).toString('hex');
    const publicToken = randomBytes(32).toString('hex');

    const pollData = {
      ...insertPoll,
      adminToken,
      publicToken,
    };

    const [poll] = await db.insert(polls).values(pollData).returning();

    // Add options
    if (options.length > 0) {
      const optionsWithPollId = options.map(option => ({
        ...option,
        pollId: poll.id,
      }));
      await db.insert(pollOptions).values(optionsWithPollId);
    }

    return { poll, adminToken, publicToken };
  }

  async getPoll(id: string): Promise<PollWithOptions | undefined> {
    const [poll] = await db.select().from(polls).where(eq(polls.id, id));
    if (!poll) return undefined;

    const options = await db.select().from(pollOptions).where(eq(pollOptions.pollId, id)).orderBy(pollOptions.id);
    const allVotes = await db.select().from(votes).where(eq(votes.pollId, id));
    
    let user: User | undefined;
    if (poll.userId) {
      [user] = await db.select().from(users).where(eq(users.id, poll.userId));
    }

    return { ...poll, options, votes: allVotes, user };
  }

  async getPollByAdminToken(token: string): Promise<PollWithOptions | undefined> {
    const [poll] = await db.select().from(polls).where(eq(polls.adminToken, token));
    if (!poll) return undefined;
    return this.getPoll(poll.id);
  }

  async getPollByPublicToken(token: string): Promise<PollWithOptions | undefined> {
    const [poll] = await db.select().from(polls).where(eq(polls.publicToken, token));
    if (!poll) return undefined;
    return this.getPoll(poll.id);
  }

  async updatePoll(id: string, updates: Partial<InsertPoll>): Promise<Poll> {
    const [poll] = await db.update(polls).set({ ...updates, updatedAt: new Date() }).where(eq(polls.id, id)).returning();
    return poll;
  }

  async deletePoll(id: string): Promise<void> {
    await db.delete(votes).where(eq(votes.pollId, id));
    await db.delete(pollOptions).where(eq(pollOptions.pollId, id));
    await db.delete(polls).where(eq(polls.id, id));
  }

  async getUserPolls(userId: number): Promise<PollWithOptions[]> {
    const userPolls = await db.select().from(polls).where(eq(polls.userId, userId)).orderBy(desc(polls.createdAt));
    
    const pollsWithDetails = await Promise.all(
      userPolls.map(async (poll) => {
        const options = await db.select().from(pollOptions).where(eq(pollOptions.pollId, poll.id)).orderBy(pollOptions.id);
        const allVotes = await db.select().from(votes).where(eq(votes.pollId, poll.id));
        return { ...poll, options, votes: allVotes };
      })
    );

    return pollsWithDetails;
  }

  async getSharedPolls(userId: number): Promise<PollWithOptions[]> {
    // Get polls where user has voted but doesn't own
    const votedPolls = await db
      .selectDistinct({ pollId: votes.pollId })
      .from(votes)
      .where(eq(votes.userId, userId));

    if (votedPolls.length === 0) return [];

    const pollIds = votedPolls.map(v => v.pollId);
    const sharedPolls = await db
      .select()
      .from(polls)
      .where(
        and(
          sql`${polls.id} = ANY(${pollIds})`,
          sql`${polls.userId} != ${userId} OR ${polls.userId} IS NULL`
        )
      )
      .orderBy(desc(polls.createdAt));

    const pollsWithDetails = await Promise.all(
      sharedPolls.map(async (poll) => {
        const options = await db.select().from(pollOptions).where(eq(pollOptions.pollId, poll.id)).orderBy(pollOptions.id);
        const allVotes = await db.select().from(votes).where(eq(votes.pollId, poll.id));
        return { ...poll, options, votes: allVotes };
      })
    );

    return pollsWithDetails;
  }

  async getActivePolls(): Promise<PollWithOptions[]> {
    const activePolls = await db
      .select()
      .from(polls)
      .where(
        and(
          eq(polls.isActive, true),
          sql`${polls.expiresAt} > NOW() OR ${polls.expiresAt} IS NULL`
        )
      )
      .orderBy(desc(polls.createdAt));

    const pollsWithDetails = await Promise.all(
      activePolls.map(async (poll) => {
        const options = await db.select().from(pollOptions).where(eq(pollOptions.pollId, poll.id)).orderBy(pollOptions.id);
        const allVotes = await db.select().from(votes).where(eq(votes.pollId, poll.id));
        let user: User | undefined;
        if (poll.userId) {
          [user] = await db.select().from(users).where(eq(users.id, poll.userId));
        }
        return { ...poll, options, votes: allVotes, user };
      })
    );

    return pollsWithDetails;
  }

  async addPollOption(option: InsertPollOption): Promise<PollOption> {
    const [newOption] = await db.insert(pollOptions).values(option).returning();
    return newOption;
  }

  async updatePollOption(id: number, updates: Partial<InsertPollOption>): Promise<PollOption> {
    const [option] = await db.update(pollOptions).set(updates).where(eq(pollOptions.id, id)).returning();
    return option;
  }

  async deletePollOption(id: number): Promise<void> {
    await db.delete(votes).where(eq(votes.optionId, id));
    await db.delete(pollOptions).where(eq(pollOptions.id, id));
  }

  async vote(insertVote: InsertVote, allowEditExisting = false): Promise<Vote> {
    // Get poll information to check type
    const [poll] = await db.select().from(polls).where(eq(polls.id, insertVote.pollId));
    if (!poll) {
      throw new Error('Poll not found');
    }

    // For organization polls: Check capacity and multi-slot restrictions
    if (poll.type === 'organization') {
      // Get the option to check capacity
      const [option] = await db.select().from(pollOptions).where(eq(pollOptions.id, insertVote.optionId));
      if (!option) {
        throw new Error('Option not found');
      }

      // Check if slot is full (only for signups, not cancellations)
      // Organization polls use 'yes' as the signup response
      if (insertVote.response === 'yes' && option.maxCapacity) {
        const currentSignups = await db.select({ count: count() }).from(votes)
          .where(and(
            eq(votes.optionId, insertVote.optionId),
            eq(votes.response, 'yes')
          ));
        
        if (currentSignups[0].count >= option.maxCapacity) {
          throw new Error('SLOT_FULL');
        }
      }

      // Check multi-slot restriction
      if (!poll.allowMultipleSlots && insertVote.voterEmail && insertVote.response === 'yes') {
        const existingSignups = await db.select().from(votes)
          .where(and(
            eq(votes.pollId, insertVote.pollId),
            eq(votes.voterEmail, insertVote.voterEmail),
            eq(votes.response, 'yes')
          ));
        
        if (existingSignups.length > 0) {
          throw new Error('ALREADY_SIGNED_UP');
        }
      }

      // Check for existing signup on this option by this email
      if (insertVote.voterEmail) {
        const existingVoteOnOption = await db.select().from(votes)
          .where(and(
            eq(votes.optionId, insertVote.optionId),
            eq(votes.voterEmail, insertVote.voterEmail)
          ));
        
        if (existingVoteOnOption.length > 0) {
          // Update existing vote (e.g., adding/changing comment or cancelling)
          const [updatedVote] = await db.update(votes)
            .set({ 
              response: insertVote.response, 
              comment: insertVote.comment,
              updatedAt: new Date() 
            })
            .where(eq(votes.id, existingVoteOnOption[0].id))
            .returning();
          return updatedVote;
        }
      }

      // Create new signup
      const [vote] = await db.insert(votes).values(insertVote).returning();
      return vote;
    }

    // For surveys: Strict email validation - prevent duplicate participation unless editing allowed
    if (poll.type === 'survey' && insertVote.voterEmail && !allowEditExisting) {
      const existingEmailVotesOnSurvey = await db.select().from(votes)
        .where(and(
          eq(votes.pollId, insertVote.pollId),
          eq(votes.voterEmail, insertVote.voterEmail)
        ));
      
      if (existingEmailVotesOnSurvey.length > 0) {
        // Email has already participated in survey - block new voting attempts
        throw new Error('DUPLICATE_EMAIL_VOTE');
      }
    }

    // For surveys with edit permission: Allow updating existing votes
    if (poll.type === 'survey' && insertVote.voterEmail && allowEditExisting) {
      const existingEmailVotesOnSurvey = await db.select().from(votes)
        .where(and(
          eq(votes.pollId, insertVote.pollId),
          eq(votes.voterEmail, insertVote.voterEmail)
        ));
      
      // Find existing vote on this specific option
      const existingVoteOnSameOption = existingEmailVotesOnSurvey.find(vote => vote.optionId === insertVote.optionId);
      
      if (existingVoteOnSameOption) {
        // Update existing vote on same option
        return this.updateVote(existingVoteOnSameOption.id, insertVote.response);
      }
      
      // If trying to vote on a different option when already participated, block it
      if (existingEmailVotesOnSurvey.length > 0) {
        throw new Error('DUPLICATE_EMAIL_VOTE');
      }
    }

    // For schedule polls: Check if vote exists for this voter on this specific option (for updating)
    if (poll.type === 'schedule') {
      const existingVote = await this.getUserVoteForOption(
        insertVote.userId ?? undefined, 
        insertVote.optionId, 
        insertVote.voterName,
        insertVote.voterEmail ?? undefined
      );

      // Check for duplicate email on same option for schedule polls
      if (insertVote.voterEmail && !existingVote) {
        const existingEmailVoteOnOption = await db.select().from(votes)
          .where(and(
            eq(votes.pollId, insertVote.pollId),
            eq(votes.optionId, insertVote.optionId),
            eq(votes.voterEmail, insertVote.voterEmail)
          ));
        
        if (existingEmailVoteOnOption.length > 0) {
          throw new Error('DUPLICATE_EMAIL_VOTE');
        }
      }

      if (existingVote) {
        // Update existing vote
        return this.updateVote(existingVote.id, insertVote.response);
      }
    }

    // Create new vote
    const [vote] = await db.insert(votes).values(insertVote).returning();
    return vote;
  }

  async voteBulk(
    pollId: string,
    voterName: string,
    voterEmail: string,
    userId: number | null,
    voterEditToken: string | null,
    voteItems: Array<{ optionId: number; response: string }>
  ): Promise<{ votes: Vote[]; alreadyVoted: boolean }> {
    return await db.transaction(async (tx) => {
      // Use advisory lock on poll+email combination to prevent concurrent inserts
      // This creates a session-level lock that serializes concurrent vote attempts
      const lockKey = `${pollId}-${voterEmail}`.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);
      
      // Now check for existing votes (with lock held, no other transaction can insert)
      const existingVotes = await tx.select().from(votes)
        .where(and(
          eq(votes.pollId, pollId),
          eq(votes.voterEmail, voterEmail)
        ));
      
      if (existingVotes.length > 0) {
        return { votes: existingVotes, alreadyVoted: true };
      }
      
      const votesToInsert = voteItems.map(item => ({
        pollId,
        optionId: item.optionId,
        voterName,
        voterEmail,
        response: item.response,
        userId,
        voterEditToken
      }));
      
      const createdVotes = await tx.insert(votes).values(votesToInsert).returning();
      
      return { votes: createdVotes, alreadyVoted: false };
    });
  }

  async updateVote(id: number, response: string): Promise<Vote> {
    const [vote] = await db.update(votes).set({ response, updatedAt: new Date() }).where(eq(votes.id, id)).returning();
    return vote;
  }

  async deleteVote(id: number): Promise<void> {
    await db.delete(votes).where(eq(votes.id, id));
  }

  async getUserVoteForOption(userId: number | undefined, optionId: number, voterName?: string, voterEmail?: string): Promise<Vote | undefined> {
    if (userId) {
      const [vote] = await db.select().from(votes)
        .where(and(eq(votes.userId, userId), eq(votes.optionId, optionId)));
      return vote || undefined;
    } else if (voterEmail) {
      // Check for existing vote by email first (more reliable for anonymous users)
      const [vote] = await db.select().from(votes)
        .where(and(eq(votes.voterEmail, voterEmail), eq(votes.optionId, optionId), isNull(votes.userId)));
      return vote || undefined;
    } else if (voterName) {
      const [vote] = await db.select().from(votes)
        .where(and(eq(votes.voterName, voterName), eq(votes.optionId, optionId), isNull(votes.userId)));
      return vote || undefined;
    }
    return undefined;
  }

  async getVotesByEmail(pollId: string, voterEmail: string): Promise<Vote[]> {
    return await db.select().from(votes)
      .where(and(eq(votes.pollId, pollId), eq(votes.voterEmail, voterEmail)));
  }

  async getVotesByUserId(pollId: string, userId: number): Promise<Vote[]> {
    return await db.select().from(votes)
      .where(and(eq(votes.pollId, pollId), eq(votes.userId, userId)));
  }

  async hasUserVoted(pollId: string, userId: number): Promise<boolean> {
    const existingVotes = await this.getVotesByUserId(pollId, userId);
    return existingVotes.length > 0;
  }

  async getVotesByEditToken(editToken: string): Promise<Vote[]> {
    return await db.select().from(votes).where(eq(votes.voterEditToken, editToken));
  }

  async getPollResults(pollId: string): Promise<PollResults> {
    const poll = await this.getPoll(pollId);
    if (!poll) throw new Error('Poll not found');

    const stats: VoteStats[] = await Promise.all(
      poll.options.map(async (option) => {
        const optionVotes = poll.votes.filter(v => v.optionId === option.id);
        const yesCount = optionVotes.filter(v => v.response === 'yes').length;
        const maybeCount = optionVotes.filter(v => v.response === 'maybe').length;
        const noCount = optionVotes.filter(v => v.response === 'no').length;
        const score = yesCount * 2 + maybeCount * 1 + noCount * 0;

        return {
          optionId: option.id,
          yesCount,
          maybeCount,
          noCount,
          score,
        };
      })
    );

    const uniqueVoters = new Set(
      poll.votes.map(v => v.userId ? `user_${v.userId}` : `anon_${v.voterName}`)
    );
    const participantCount = uniqueVoters.size;
    
    // Calculate response rate (assuming we track invited users somehow, for now use total voters)
    const responseRate = participantCount > 0 ? 100 : 0;

    return {
      poll,
      options: poll.options,
      votes: poll.votes,
      stats,
      participantCount,
      responseRate,
    };
  }

  async getSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting || undefined;
  }

  async setSetting(insertSetting: InsertSystemSetting): Promise<SystemSetting> {
    const existing = await this.getSetting(insertSetting.key);
    
    // Log all setting changes for audit trail (especially critical settings)
    const criticalSettings = ['registration_enabled', 'smtp_host', 'smtp_user'];
    if (criticalSettings.includes(insertSetting.key)) {
      console.log(`[SETTINGS AUDIT] Changing "${insertSetting.key}": ${JSON.stringify(existing?.value)} -> ${JSON.stringify(insertSetting.value)}`);
    }
    
    if (existing) {
      const [setting] = await db.update(systemSettings)
        .set({ value: insertSetting.value, updatedAt: new Date() })
        .where(eq(systemSettings.key, insertSetting.key))
        .returning();
      return setting;
    } else {
      console.log(`[SETTINGS] Creating new setting: "${insertSetting.key}" = ${JSON.stringify(insertSetting.value)}`);
      const [setting] = await db.insert(systemSettings).values(insertSetting).returning();
      return setting;
    }
  }

  async getSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings);
  }

  async getCustomizationSettings(): Promise<CustomizationSettings> {
    const themeSetting = await this.getSetting('customization_theme');
    const brandingSetting = await this.getSetting('customization_branding');
    const footerSetting = await this.getSetting('customization_footer');

    const settings = {
      theme: themeSetting?.value || {},
      branding: brandingSetting?.value || {},
      footer: footerSetting?.value || {},
    };

    return customizationSettingsSchema.parse(settings);
  }

  async setCustomizationSettings(settings: Partial<CustomizationSettings>): Promise<CustomizationSettings> {
    if (settings.theme) {
      await this.setSetting({ key: 'customization_theme', value: settings.theme });
    }
    if (settings.branding) {
      await this.setSetting({ key: 'customization_branding', value: settings.branding });
    }
    if (settings.footer) {
      await this.setSetting({ key: 'customization_footer', value: settings.footer });
    }

    return await this.getCustomizationSettings();
  }

  async getSecuritySettings(): Promise<SecuritySettings> {
    const loginRateLimitSetting = await this.getSetting('security_login_rate_limit');

    const settings = {
      loginRateLimit: loginRateLimitSetting?.value || {},
    };

    return securitySettingsSchema.parse(settings);
  }

  async setSecuritySettings(settings: Partial<SecuritySettings>): Promise<SecuritySettings> {
    if (settings.loginRateLimit) {
      await this.setSetting({ key: 'security_login_rate_limit', value: settings.loginRateLimit });
    }

    return await this.getSecuritySettings();
  }
  
  async getSessionTimeoutSettings(): Promise<SessionTimeoutSettings> {
    const setting = await this.getSetting('session_timeout_settings');
    
    if (!setting) {
      return sessionTimeoutSettingsSchema.parse({});
    }
    
    return sessionTimeoutSettingsSchema.parse(setting.value);
  }
  
  async setSessionTimeoutSettings(settings: Partial<SessionTimeoutSettings>): Promise<SessionTimeoutSettings> {
    const current = await this.getSessionTimeoutSettings();
    const merged = { ...current, ...settings };
    const validated = sessionTimeoutSettingsSchema.parse(merged);
    
    await this.setSetting({ 
      key: 'session_timeout_settings', 
      value: validated,
      description: 'Role-based session timeout settings'
    });
    
    return validated;
  }

  async getSystemStats(): Promise<{
    totalUsers: number;
    activePolls: number;
    totalVotes: number;
    monthlyPolls: number;
  }> {
    // Exclude test data from all statistics
    const [totalUsersResult] = await db.select({ count: count() }).from(users)
      .where(eq(users.isTestData, false));
    const [activePollsResult] = await db.select({ count: count() }).from(polls)
      .where(and(
        eq(polls.isActive, true),
        eq(polls.isTestData, false),
        sql`${polls.expiresAt} > NOW() OR ${polls.expiresAt} IS NULL`
      ));
    const [totalVotesResult] = await db.select({ count: count() }).from(votes)
      .innerJoin(polls, eq(votes.pollId, polls.id))
      .where(eq(polls.isTestData, false));
    const [monthlyPollsResult] = await db.select({ count: count() }).from(polls)
      .where(and(
        eq(polls.isTestData, false),
        sql`${polls.createdAt} >= NOW() - INTERVAL '30 days'`
      ));

    return {
      totalUsers: totalUsersResult.count,
      activePolls: activePollsResult.count,
      totalVotes: totalVotesResult.count,
      monthlyPolls: monthlyPollsResult.count,
    };
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(votes).where(eq(votes.userId, id));
    await db.update(polls).set({ userId: null }).where(eq(polls.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllPolls(): Promise<PollWithOptions[]> {
    const allPolls = await db.select().from(polls).orderBy(desc(polls.createdAt));
    
    const pollsWithDetails = await Promise.all(
      allPolls.map(async (poll) => {
        const options = await db.select().from(pollOptions).where(eq(pollOptions.pollId, poll.id)).orderBy(pollOptions.id);
        const allVotes = await db.select().from(votes).where(eq(votes.pollId, poll.id));
        let user: User | undefined;
        if (poll.userId) {
          [user] = await db.select().from(users).where(eq(users.id, poll.userId));
        }
        return { ...poll, options, votes: allVotes, user };
      })
    );

    return pollsWithDetails;
  }

  async getExtendedStats(): Promise<{
    totalUsers: number;
    activePolls: number;
    inactivePolls: number;
    totalPolls: number;
    totalVotes: number;
    monthlyPolls: number;
    weeklyPolls: number;
    todayPolls: number;
    schedulePolls: number;
    surveyPolls: number;
    organizationPolls: number;
    recentActivity: Array<{
      type: string;
      message: string;
      timestamp: Date;
      actor?: string;
      pollToken?: string;
    }>;
  }> {
    // Exclude test data from all statistics
    const [totalUsersResult] = await db.select({ count: count() }).from(users)
      .where(eq(users.isTestData, false));
    const [totalPollsResult] = await db.select({ count: count() }).from(polls)
      .where(eq(polls.isTestData, false));
    const [activePollsResult] = await db.select({ count: count() }).from(polls)
      .where(and(
        eq(polls.isActive, true),
        eq(polls.isTestData, false),
        sql`${polls.expiresAt} > NOW() OR ${polls.expiresAt} IS NULL`
      ));
    const [inactivePollsResult] = await db.select({ count: count() }).from(polls)
      .where(and(eq(polls.isActive, false), eq(polls.isTestData, false)));
    const [totalVotesResult] = await db.select({ count: count() }).from(votes)
      .innerJoin(polls, eq(votes.pollId, polls.id))
      .where(eq(polls.isTestData, false));
    const [monthlyPollsResult] = await db.select({ count: count() }).from(polls)
      .where(and(eq(polls.isTestData, false), sql`${polls.createdAt} >= NOW() - INTERVAL '30 days'`));
    const [weeklyPollsResult] = await db.select({ count: count() }).from(polls)
      .where(and(eq(polls.isTestData, false), sql`${polls.createdAt} >= NOW() - INTERVAL '7 days'`));
    const [todayPollsResult] = await db.select({ count: count() }).from(polls)
      .where(and(eq(polls.isTestData, false), sql`${polls.createdAt} >= NOW() - INTERVAL '1 day'`));
    const [schedulePollsResult] = await db.select({ count: count() }).from(polls)
      .where(and(eq(polls.type, 'schedule'), eq(polls.isTestData, false)));
    const [surveyPollsResult] = await db.select({ count: count() }).from(polls)
      .where(and(eq(polls.type, 'survey'), eq(polls.isTestData, false)));
    const [organizationPollsResult] = await db.select({ count: count() }).from(polls)
      .where(and(eq(polls.type, 'organization'), eq(polls.isTestData, false)));

    // Get recent activity (recent polls and votes) - excluding test data
    const recentPolls = await db.select().from(polls).where(eq(polls.isTestData, false)).orderBy(desc(polls.createdAt)).limit(5);

    const recentVotesWithPolls = await db.select({
      vote: votes,
      poll: polls,
    }).from(votes)
      .innerJoin(polls, eq(votes.pollId, polls.id))
      .where(eq(polls.isTestData, false))
      .orderBy(desc(votes.createdAt)).limit(5);

    const recentUsers = await db.select({
      id: users.id,
      name: users.name,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.isTestData, false)).orderBy(desc(users.createdAt)).limit(3);

    // Build activity list
    const activity: Array<{ type: string; message: string; timestamp: Date; actor?: string; pollToken?: string }> = [];

    for (const poll of recentPolls) {
      let actor: string | undefined;
      if (poll.userId) {
        const [user] = await db.select().from(users).where(eq(users.id, poll.userId));
        actor = user?.name;
      }
      const typeLabel = poll.type === 'schedule' ? 'Terminumfrage' : 
                        poll.type === 'organization' ? 'Orga' : 'Umfrage';
      activity.push({
        type: 'poll_created',
        message: `Neue ${typeLabel} erstellt: "${poll.title}"`,
        timestamp: poll.createdAt,
        actor,
        pollToken: poll.publicToken,
      });
    }

    for (const { vote, poll } of recentVotesWithPolls) {
      activity.push({
        type: 'vote',
        message: `Neue Abstimmung abgegeben`,
        timestamp: vote.createdAt,
        actor: vote.voterName,
        pollToken: poll.publicToken,
      });
    }

    for (const user of recentUsers) {
      activity.push({
        type: 'user_registered',
        message: `Neuer Benutzer registriert`,
        timestamp: user.createdAt,
        actor: user.name,
      });
    }

    // Sort by timestamp descending
    activity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      totalUsers: totalUsersResult.count,
      activePolls: activePollsResult.count,
      inactivePolls: inactivePollsResult.count,
      totalPolls: totalPollsResult.count,
      totalVotes: totalVotesResult.count,
      monthlyPolls: monthlyPollsResult.count,
      weeklyPolls: weeklyPollsResult.count,
      todayPolls: todayPollsResult.count,
      schedulePolls: schedulePollsResult.count,
      surveyPolls: surveyPollsResult.count,
      organizationPolls: organizationPollsResult.count,
      recentActivity: activity.slice(0, 10),
    };
  }

  // Notification settings
  async getNotificationSettings(): Promise<NotificationSettings> {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'notification_settings'));

    if (!setting) {
      return notificationSettingsSchema.parse({});
    }

    return notificationSettingsSchema.parse(setting.value);
  }

  async setNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const currentSettings = await this.getNotificationSettings();
    const mergedSettings = { ...currentSettings, ...settings };
    const validatedSettings = notificationSettingsSchema.parse(mergedSettings);

    await db
      .insert(systemSettings)
      .values({
        key: 'notification_settings',
        value: validatedSettings,
        description: 'Notification and reminder settings',
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: validatedSettings,
          updatedAt: new Date(),
        },
      });

    return validatedSettings;
  }

  // Notification logs
  async logNotification(log: InsertNotificationLog): Promise<NotificationLog> {
    const [notification] = await db
      .insert(notificationLogs)
      .values(log)
      .returning();
    return notification;
  }

  async getNotificationLogs(pollId: string): Promise<NotificationLog[]> {
    return db
      .select()
      .from(notificationLogs)
      .where(eq(notificationLogs.pollId, pollId))
      .orderBy(desc(notificationLogs.createdAt));
  }

  async getManualReminderCount(pollId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(notificationLogs)
      .where(and(
        eq(notificationLogs.pollId, pollId),
        eq(notificationLogs.type, 'manual_reminder')
      ));
    return result?.count ?? 0;
  }

  async getLastManualReminderTime(pollId: string): Promise<Date | null> {
    const [result] = await db
      .select({ createdAt: notificationLogs.createdAt })
      .from(notificationLogs)
      .where(and(
        eq(notificationLogs.pollId, pollId),
        eq(notificationLogs.type, 'manual_reminder')
      ))
      .orderBy(desc(notificationLogs.createdAt))
      .limit(1);
    return result?.createdAt ?? null;
  }

  async getPollsNeedingExpiryReminder(): Promise<Poll[]> {
    // Get polls that have expiry reminders enabled but not yet sent,
    // and are within the reminder window before expiration
    return db
      .select()
      .from(polls)
      .where(and(
        eq(polls.enableExpiryReminder, true),
        eq(polls.expiryReminderSent, false),
        eq(polls.isActive, true),
        sql`${polls.expiresAt} IS NOT NULL`,
        sql`${polls.expiresAt} > NOW()`,
        sql`${polls.expiresAt} <= NOW() + (${polls.expiryReminderHours} || ' hours')::interval`
      ));
  }

  async markExpiryReminderSent(pollId: string): Promise<void> {
    await db
      .update(polls)
      .set({ expiryReminderSent: true })
      .where(eq(polls.id, pollId));
  }

  // Password reset tokens
  async createPasswordResetToken(userId: number): Promise<PasswordResetToken> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry
    
    const [resetToken] = await db
      .insert(passwordResetTokens)
      .values({ userId, token, expiresAt })
      .returning();
    
    return resetToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.token, token),
        isNull(passwordResetTokens.usedAt),
        sql`${passwordResetTokens.expiresAt} > NOW()`
      ));
    return resetToken || undefined;
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
  }

  async deleteExpiredPasswordResetTokens(): Promise<void> {
    await db
      .delete(passwordResetTokens)
      .where(sql`${passwordResetTokens.expiresAt} < NOW()`);
  }

  // Email change tokens
  async createEmailChangeToken(userId: number, newEmail: string): Promise<EmailChangeToken> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hour expiry
    
    const [changeToken] = await db
      .insert(emailChangeTokens)
      .values({ userId, newEmail, token, expiresAt })
      .returning();
    
    return changeToken;
  }

  async getEmailChangeToken(token: string): Promise<EmailChangeToken | undefined> {
    const [changeToken] = await db
      .select()
      .from(emailChangeTokens)
      .where(and(
        eq(emailChangeTokens.token, token),
        isNull(emailChangeTokens.usedAt),
        sql`${emailChangeTokens.expiresAt} > NOW()`
      ));
    return changeToken || undefined;
  }

  async markEmailChangeTokenUsed(token: string): Promise<void> {
    await db
      .update(emailChangeTokens)
      .set({ usedAt: new Date() })
      .where(eq(emailChangeTokens.token, token));
  }

  async deleteExpiredEmailChangeTokens(): Promise<void> {
    await db
      .delete(emailChangeTokens)
      .where(sql`${emailChangeTokens.expiresAt} < NOW()`);
  }

  // Test data management
  async purgeTestData(): Promise<{ deletedPolls: number; deletedUsers: number; deletedVotes: number; deletedOptions: number }> {
    // First get the test poll IDs
    const testPolls = await db.select({ id: polls.id }).from(polls).where(eq(polls.isTestData, true));
    const testPollIds = testPolls.map(p => p.id);
    
    let deletedVotes = 0;
    let deletedOptions = 0;
    let deletedPolls = 0;
    
    // Only proceed if there are test polls to delete
    if (testPollIds.length > 0) {
      // Count votes before deletion
      const [voteCount] = await db.select({ count: count() }).from(votes)
        .where(sql`${votes.pollId} IN (SELECT id FROM polls WHERE is_test_data = true)`);
      deletedVotes = voteCount.count;
      
      // Count options before deletion
      const [optionCount] = await db.select({ count: count() }).from(pollOptions)
        .where(sql`${pollOptions.pollId} IN (SELECT id FROM polls WHERE is_test_data = true)`);
      deletedOptions = optionCount.count;
      
      // Delete in correct order: votes first, then options, then polls
      await db.delete(votes).where(
        sql`${votes.pollId} IN (SELECT id FROM polls WHERE is_test_data = true)`
      );
      
      await db.delete(pollOptions).where(
        sql`${pollOptions.pollId} IN (SELECT id FROM polls WHERE is_test_data = true)`
      );
      
      await db.delete(polls).where(eq(polls.isTestData, true));
      deletedPolls = testPollIds.length;
    }
    
    // Delete test users
    const testUsers = await db.select({ id: users.id }).from(users).where(eq(users.isTestData, true));
    const deletedUsers = testUsers.length;
    
    if (testUsers.length > 0) {
      await db.delete(users).where(eq(users.isTestData, true));
    }
    
    return { deletedPolls, deletedUsers, deletedVotes, deletedOptions };
  }

  async getTestDataStats(): Promise<{ testPolls: number; testUsers: number; testVotes: number; testOptions: number }> {
    const [testPollsResult] = await db.select({ count: count() }).from(polls).where(eq(polls.isTestData, true));
    const [testUsersResult] = await db.select({ count: count() }).from(users).where(eq(users.isTestData, true));
    const [testVotesResult] = await db.select({ count: count() }).from(votes)
      .innerJoin(polls, eq(votes.pollId, polls.id))
      .where(eq(polls.isTestData, true));
    const [testOptionsResult] = await db.select({ count: count() }).from(pollOptions)
      .innerJoin(polls, eq(pollOptions.pollId, polls.id))
      .where(eq(polls.isTestData, true));
    
    return {
      testPolls: testPollsResult.count,
      testUsers: testUsersResult.count,
      testVotes: testVotesResult.count,
      testOptions: testOptionsResult.count,
    };
  }
}

export const storage = new DatabaseStorage();
