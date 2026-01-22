import { 
  users, polls, pollOptions, votes, systemSettings, notificationLogs,
  passwordResetTokens, emailChangeTokens, emailTemplates, clamavScanLogs,
  type User, type InsertUser,
  type Poll, type InsertPoll, type PollWithOptions,
  type PollOption, type InsertPollOption,
  type Vote, type InsertVote,
  type SystemSetting, type InsertSystemSetting,
  type NotificationLog, type InsertNotificationLog,
  type PasswordResetToken, type InsertPasswordResetToken,
  type EmailChangeToken, type InsertEmailChangeToken,
  type EmailTemplate, type InsertEmailTemplate,
  type EmailTemplateType,
  type ClamavScanLog, type InsertClamavScanLog,
  type PollResults, type VoteStats,
  type CustomizationSettings, customizationSettingsSchema,
  type SecuritySettings, securitySettingsSchema,
  type NotificationSettings, notificationSettingsSchema,
  type SessionTimeoutSettings, sessionTimeoutSettingsSchema,
  type CalendarSettings, calendarSettingsSchema
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
  getUserByCalendarToken(calendarToken: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  updateUserLastLogin(id: number): Promise<void>;
  getAllUsers(): Promise<User[]>;
  getAdminUsers(): Promise<User[]>;
  getUserParticipatedPolls(userId: number): Promise<PollWithOptions[]>;
  getUserParticipations(userId: number, userEmail: string): Promise<Array<{ poll: Poll; options: PollOption[]; votes: Vote[] }>>;
  deleteUser(id: number): Promise<void>;

  // Poll management
  createPoll(poll: InsertPoll, options: InsertPollOption[]): Promise<{ poll: Poll; adminToken: string; publicToken: string; options: PollOption[] }>;
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
  createVote(vote: InsertVote, existingEditToken?: string | null): Promise<{ vote: Vote; editToken: string }>;
  voteBulk(pollId: string, voterName: string, voterEmail: string, userId: number | null, voterEditToken: string | null, voteItems: Array<{ optionId: number; response: string }>): Promise<{ votes: Vote[]; alreadyVoted: boolean }>;
  updateVote(id: number, response: string): Promise<Vote>;
  deleteVote(id: number): Promise<void>;
  getUserVoteForOption(userId: number | undefined, optionId: number, voterName?: string): Promise<Vote | undefined>;
  getVotesByEmail(pollId: string, voterEmail: string): Promise<Vote[]>;
  getVotesByVoterKey(pollId: string, voterKey: string): Promise<Vote[]>;
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

  // Calendar settings
  getCalendarSettings(): Promise<CalendarSettings>;
  setCalendarSettings(settings: Partial<CalendarSettings>): Promise<CalendarSettings>;

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

  // GDPR deletion requests
  requestDeletion(userId: number): Promise<User>;
  cancelDeletionRequest(userId: number): Promise<User>;
  getUsersWithDeletionRequests(): Promise<User[]>;
  confirmDeletion(userId: number): Promise<void>;

  // Email templates
  getEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplate(type: EmailTemplateType): Promise<EmailTemplate | undefined>;
  upsertEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  resetEmailTemplate(type: EmailTemplateType): Promise<EmailTemplate | undefined>;

  // ClamAV scan logs
  createClamavScanLog(log: InsertClamavScanLog): Promise<ClamavScanLog>;
  getClamavScanLogs(options?: { 
    limit?: number; 
    offset?: number;
    status?: 'clean' | 'infected' | 'error';
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ logs: ClamavScanLog[]; total: number }>;
  getClamavScanLog(id: number): Promise<ClamavScanLog | undefined>;
  markClamavScanNotified(id: number): Promise<ClamavScanLog>;
  getClamavScanStats(): Promise<{
    totalScans: number;
    cleanScans: number;
    infectedScans: number;
    errorScans: number;
    lastScanAt: Date | null;
  }>;
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

  async getAdminUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, 'admin'));
  }

  async getUserByKeycloakId(keycloakId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.keycloakId, keycloakId));
    return user || undefined;
  }

  async getUserByCalendarToken(calendarToken: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.calendarToken, calendarToken));
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

  async getUserParticipations(userId: number, userEmail: string): Promise<Array<{ poll: Poll; options: PollOption[]; votes: Vote[] }>> {
    // Get all votes by this user (by email or userId)
    const userVotes = await db.select()
      .from(votes)
      .where(sql`${votes.voterEmail} = ${userEmail} OR ${votes.userId} = ${userId}`);

    if (userVotes.length === 0) return [];

    // Group votes by poll
    const votesByPoll = new Map<string, Vote[]>();
    for (const vote of userVotes) {
      const existing = votesByPoll.get(vote.pollId) || [];
      existing.push(vote);
      votesByPoll.set(vote.pollId, existing);
    }

    // Get all relevant polls and their options
    const pollIds = Array.from(votesByPoll.keys());
    const participations: Array<{ poll: Poll; options: PollOption[]; votes: Vote[] }> = [];

    for (const pollId of pollIds) {
      const [poll] = await db.select().from(polls).where(eq(polls.id, pollId));
      if (!poll) continue;

      const options = await db.select().from(pollOptions).where(eq(pollOptions.pollId, pollId));
      const userPollVotes = votesByPoll.get(pollId) || [];

      participations.push({ poll, options, votes: userPollVotes });
    }

    return participations;
  }

  async createPoll(insertPoll: InsertPoll, options: InsertPollOption[]): Promise<{ poll: Poll; adminToken: string; publicToken: string; options: PollOption[] }> {
    const adminToken = randomBytes(32).toString('hex');
    const publicToken = randomBytes(32).toString('hex');

    const pollData = {
      ...insertPoll,
      adminToken,
      publicToken,
    };

    const [poll] = await db.insert(polls).values(pollData).returning();

    // Add options and return them with IDs
    let createdOptions: PollOption[] = [];
    if (options.length > 0) {
      const optionsWithPollId = options.map(option => ({
        ...option,
        pollId: poll.id,
      }));
      createdOptions = await db.insert(pollOptions).values(optionsWithPollId).returning();
    }

    return { poll, adminToken, publicToken, options: createdOptions };
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

    // For organization polls: Use transactional reservation with row-level locking to prevent overbooking
    if (poll.type === 'organization') {
      return await db.transaction(async (tx) => {
        // Use advisory lock based on poll+voter to serialize operations per voter
        // This prevents race conditions for the same voter trying to book multiple slots simultaneously
        if (insertVote.voterEmail) {
          const lockKey = `${insertVote.pollId}-${insertVote.voterEmail}`.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
          }, 0);
          await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);
        }
        
        // Lock the option row to prevent concurrent modifications (FOR UPDATE)
        const optionResult = await tx.execute(
          sql`SELECT * FROM poll_options WHERE id = ${insertVote.optionId} FOR UPDATE`
        );
        const option = optionResult.rows[0] as { id: number; max_capacity: number | null } | undefined;
        
        if (!option) {
          throw new Error('Option not found');
        }

        // Check if slot is full (only for signups, not cancellations)
        // Organization polls use 'yes' as the signup response
        // Lock existing vote rows to prevent concurrent inserts from seeing the same count
        if (insertVote.response === 'yes' && option.max_capacity) {
          const existingVotesResult = await tx.execute(
            sql`SELECT id FROM votes WHERE option_id = ${insertVote.optionId} AND response = 'yes' FOR UPDATE`
          );
          
          if (existingVotesResult.rows.length >= option.max_capacity) {
            throw new Error('SLOT_FULL');
          }
        }

        // Check multi-slot restriction with FOR UPDATE lock on existing votes
        if (!poll.allowMultipleSlots && insertVote.voterEmail && insertVote.response === 'yes') {
          const existingSignupsResult = await tx.execute(
            sql`SELECT * FROM votes WHERE poll_id = ${insertVote.pollId} 
                AND voter_email = ${insertVote.voterEmail} 
                AND response = 'yes' FOR UPDATE`
          );
          
          if (existingSignupsResult.rows.length > 0) {
            throw new Error('ALREADY_SIGNED_UP');
          }
        }

        // Check for existing signup on this option by this email (with lock)
        if (insertVote.voterEmail) {
          const existingVoteResult = await tx.execute(
            sql`SELECT * FROM votes WHERE option_id = ${insertVote.optionId} 
                AND voter_email = ${insertVote.voterEmail} FOR UPDATE`
          );
          const existingVote = existingVoteResult.rows[0] as { id: number } | undefined;
          
          if (existingVote) {
            // Update existing vote (e.g., adding/changing comment or cancelling)
            const [updatedVote] = await tx.update(votes)
              .set({ 
                response: insertVote.response, 
                comment: insertVote.comment,
                updatedAt: new Date() 
              })
              .where(eq(votes.id, existingVote.id))
              .returning();
            return updatedVote;
          }
        }

        // Create new signup within transaction
        const [vote] = await tx.insert(votes).values(insertVote).returning();
        return vote;
      });
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
    voteItems: Array<{ optionId: number; response: string }>,
    voterKey?: string,
    voterSource?: 'user' | 'device'
  ): Promise<{ votes: Vote[]; alreadyVoted: boolean }> {
    return await db.transaction(async (tx) => {
      // Use advisory lock on poll+voterKey (or email as fallback) to prevent concurrent inserts
      const lockIdentifier = voterKey || voterEmail;
      const lockKey = `${pollId}-${lockIdentifier}`.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);
      
      // Check for existing votes by voterKey (preferred) or email (fallback)
      let existingVotes;
      if (voterKey) {
        existingVotes = await tx.select().from(votes)
          .where(and(
            eq(votes.pollId, pollId),
            eq(votes.voterKey, voterKey)
          ));
      } else {
        existingVotes = await tx.select().from(votes)
          .where(and(
            eq(votes.pollId, pollId),
            eq(votes.voterEmail, voterEmail)
          ));
      }
      
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
        voterEditToken,
        voterKey: voterKey || null,
        voterSource: voterSource || null
      }));
      
      const createdVotes = await tx.insert(votes).values(votesToInsert).returning();
      
      return { votes: createdVotes, alreadyVoted: false };
    });
  }

  async createVote(insertVote: InsertVote, existingEditToken?: string | null): Promise<{ vote: Vote; editToken: string }> {
    const editToken = existingEditToken || randomBytes(32).toString('hex');
    const voteWithToken = { ...insertVote, voterEditToken: editToken };
    const createdVote = await this.vote(voteWithToken);
    return { vote: createdVote, editToken };
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

  async getVotesByVoterKey(pollId: string, voterKey: string): Promise<Vote[]> {
    return await db.select().from(votes)
      .where(and(eq(votes.pollId, pollId), eq(votes.voterKey, voterKey)));
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
    // Parallelize all 4 database queries for better performance
    const [themeSetting, brandingSetting, footerSetting, wcagSetting] = await Promise.all([
      this.getSetting('customization_theme'),
      this.getSetting('customization_branding'),
      this.getSetting('customization_footer'),
      this.getSetting('customization_wcag'),
    ]);

    const settings = {
      theme: themeSetting?.value || {},
      branding: brandingSetting?.value || {},
      footer: footerSetting?.value || {},
      wcag: wcagSetting?.value || {},
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
    if (settings.wcag) {
      await this.setSetting({ key: 'customization_wcag', value: settings.wcag });
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

  async getCalendarSettings(): Promise<CalendarSettings> {
    const setting = await this.getSetting('calendar_settings');
    
    if (!setting) {
      return calendarSettingsSchema.parse({});
    }
    
    return calendarSettingsSchema.parse(setting.value);
  }
  
  async setCalendarSettings(settings: Partial<CalendarSettings>): Promise<CalendarSettings> {
    const current = await this.getCalendarSettings();
    const merged = { ...current, ...settings };
    const validated = calendarSettingsSchema.parse(merged);
    
    await this.setSetting({ 
      key: 'calendar_settings', 
      value: validated,
      description: 'Calendar ICS export settings'
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
    // Fetch all data in parallel to avoid N+1 queries
    const [allPolls, allOptions, allVotes, allUsers] = await Promise.all([
      db.select().from(polls).orderBy(desc(polls.createdAt)),
      db.select().from(pollOptions).orderBy(pollOptions.id),
      db.select().from(votes),
      db.select().from(users)
    ]);
    
    // Create lookup maps for O(1) access
    const optionsByPollId = new Map<string, typeof allOptions>();
    for (const option of allOptions) {
      const existing = optionsByPollId.get(option.pollId) || [];
      existing.push(option);
      optionsByPollId.set(option.pollId, existing);
    }
    
    const votesByPollId = new Map<string, typeof allVotes>();
    for (const vote of allVotes) {
      const existing = votesByPollId.get(vote.pollId) || [];
      existing.push(vote);
      votesByPollId.set(vote.pollId, existing);
    }
    
    const usersById = new Map<number, typeof allUsers[0]>();
    for (const user of allUsers) {
      usersById.set(user.id, user);
    }
    
    // Map polls with their related data
    return allPolls.map(poll => ({
      ...poll,
      options: optionsByPollId.get(poll.id) || [],
      votes: votesByPollId.get(poll.id) || [],
      user: poll.userId ? usersById.get(poll.userId) : undefined
    }));
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
    // Run all count queries in parallel for better performance
    const [
      [totalUsersResult],
      [totalPollsResult],
      [activePollsResult],
      [inactivePollsResult],
      [totalVotesResult],
      [monthlyPollsResult],
      [weeklyPollsResult],
      [todayPollsResult],
      [schedulePollsResult],
      [surveyPollsResult],
      [organizationPollsResult],
      recentPollsWithUsers,
      recentVotesWithPolls,
      recentUsers,
    ] = await Promise.all([
      db.select({ count: count() }).from(users).where(eq(users.isTestData, false)),
      db.select({ count: count() }).from(polls).where(eq(polls.isTestData, false)),
      db.select({ count: count() }).from(polls).where(and(
        eq(polls.isActive, true),
        eq(polls.isTestData, false),
        sql`${polls.expiresAt} > NOW() OR ${polls.expiresAt} IS NULL`
      )),
      db.select({ count: count() }).from(polls).where(and(eq(polls.isActive, false), eq(polls.isTestData, false))),
      db.select({ count: count() }).from(votes).innerJoin(polls, eq(votes.pollId, polls.id)).where(eq(polls.isTestData, false)),
      db.select({ count: count() }).from(polls).where(and(eq(polls.isTestData, false), sql`${polls.createdAt} >= NOW() - INTERVAL '30 days'`)),
      db.select({ count: count() }).from(polls).where(and(eq(polls.isTestData, false), sql`${polls.createdAt} >= NOW() - INTERVAL '7 days'`)),
      db.select({ count: count() }).from(polls).where(and(eq(polls.isTestData, false), sql`${polls.createdAt} >= NOW() - INTERVAL '1 day'`)),
      db.select({ count: count() }).from(polls).where(and(eq(polls.type, 'schedule'), eq(polls.isTestData, false))),
      db.select({ count: count() }).from(polls).where(and(eq(polls.type, 'survey'), eq(polls.isTestData, false))),
      db.select({ count: count() }).from(polls).where(and(eq(polls.type, 'organization'), eq(polls.isTestData, false))),
      db.select({
        poll: polls,
        userName: users.name,
      }).from(polls)
        .leftJoin(users, eq(polls.userId, users.id))
        .where(eq(polls.isTestData, false))
        .orderBy(desc(polls.createdAt))
        .limit(5),
      db.select({
        vote: votes,
        poll: polls,
      }).from(votes)
        .innerJoin(polls, eq(votes.pollId, polls.id))
        .where(eq(polls.isTestData, false))
        .orderBy(desc(votes.createdAt))
        .limit(5),
      db.select({
        id: users.id,
        name: users.name,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.isTestData, false)).orderBy(desc(users.createdAt)).limit(3),
    ]);

    // Build activity list - no more N+1 queries
    const activity: Array<{ type: string; message: string; timestamp: Date; actor?: string; pollToken?: string }> = [];

    for (const { poll, userName } of recentPollsWithUsers) {
      const typeLabel = poll.type === 'schedule' ? 'Terminumfrage' : 
                        poll.type === 'organization' ? 'Orga' : 'Umfrage';
      activity.push({
        type: 'poll_created',
        message: `Neue ${typeLabel} erstellt: "${poll.title}"`,
        timestamp: poll.createdAt,
        actor: userName || undefined,
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
    // Delete polls that either:
    // 1. Have is_test_data = true
    // 2. Match common test patterns (for manually created test data)
    const testPatternCondition = sql`
      is_test_data = true 
      OR title LIKE 'Test Poll%'
      OR title LIKE 'Data Test Poll%'
      OR title LIKE 'E2E:%'
      OR (title = 'Schedule Poll' AND description IS NULL)
      OR (title = 'Orga Poll' AND description IS NULL)
      OR title LIKE 'Unlim-%'
      OR title LIKE 'Sommerfest %' AND title ~ '[A-Z0-9_]{5,}$'
    `;
    
    // Get all test poll IDs
    const testPolls = await db.select({ id: polls.id }).from(polls).where(testPatternCondition);
    const testPollIds = testPolls.map(p => p.id);
    
    let deletedVotes = 0;
    let deletedOptions = 0;
    let deletedPolls = 0;
    
    // Only proceed if there are test polls to delete
    if (testPollIds.length > 0) {
      // Count votes before deletion
      const [voteCount] = await db.select({ count: count() }).from(votes)
        .where(sql`${votes.pollId} IN (SELECT id FROM polls WHERE ${testPatternCondition})`);
      deletedVotes = voteCount.count;
      
      // Count options before deletion
      const [optionCount] = await db.select({ count: count() }).from(pollOptions)
        .where(sql`${pollOptions.pollId} IN (SELECT id FROM polls WHERE ${testPatternCondition})`);
      deletedOptions = optionCount.count;
      
      // Delete in correct order: votes first, then options, then polls
      await db.delete(votes).where(
        sql`${votes.pollId} IN (SELECT id FROM polls WHERE ${testPatternCondition})`
      );
      
      await db.delete(pollOptions).where(
        sql`${pollOptions.pollId} IN (SELECT id FROM polls WHERE ${testPatternCondition})`
      );
      
      await db.delete(polls).where(testPatternCondition);
      deletedPolls = testPollIds.length;
    }
    
    // Delete test users (by flag or pattern)
    const testUserCondition = sql`is_test_data = true OR email LIKE 'test-%@example.com' OR email LIKE 'creator-%@example.com' OR email LIKE 'voter-%@example.com'`;
    const testUsers = await db.select({ id: users.id }).from(users).where(testUserCondition);
    const deletedUsers = testUsers.length;
    
    if (testUsers.length > 0) {
      await db.delete(users).where(testUserCondition);
    }
    
    return { deletedPolls, deletedUsers, deletedVotes, deletedOptions };
  }

  async getTestDataStats(): Promise<{ testPolls: number; testUsers: number; testVotes: number; testOptions: number }> {
    // Count polls matching test patterns (same as purgeTestData)
    const testPatternCondition = sql`
      is_test_data = true 
      OR title LIKE 'Test Poll%'
      OR title LIKE 'Data Test Poll%'
      OR title LIKE 'E2E:%'
      OR (title = 'Schedule Poll' AND description IS NULL)
      OR (title = 'Orga Poll' AND description IS NULL)
      OR title LIKE 'Unlim-%'
      OR title LIKE 'Sommerfest %' AND title ~ '[A-Z0-9_]{5,}$'
    `;
    
    const [testPollsResult] = await db.select({ count: count() }).from(polls).where(testPatternCondition);
    
    // Count users matching test patterns
    const testUserCondition = sql`is_test_data = true OR email LIKE 'test-%@example.com' OR email LIKE 'creator-%@example.com' OR email LIKE 'voter-%@example.com'`;
    const [testUsersResult] = await db.select({ count: count() }).from(users).where(testUserCondition);
    
    const [testVotesResult] = await db.select({ count: count() }).from(votes)
      .where(sql`${votes.pollId} IN (SELECT id FROM polls WHERE ${testPatternCondition})`);
    const [testOptionsResult] = await db.select({ count: count() }).from(pollOptions)
      .where(sql`${pollOptions.pollId} IN (SELECT id FROM polls WHERE ${testPatternCondition})`);
    
    return {
      testPolls: testPollsResult.count,
      testUsers: testUsersResult.count,
      testVotes: testVotesResult.count,
      testOptions: testOptionsResult.count,
    };
  }

  // GDPR deletion requests
  async requestDeletion(userId: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ deletionRequestedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async cancelDeletionRequest(userId: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ deletionRequestedAt: null })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getUsersWithDeletionRequests(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(sql`${users.deletionRequestedAt} IS NOT NULL`)
      .orderBy(users.deletionRequestedAt);
  }

  async confirmDeletion(userId: number): Promise<void> {
    await this.deleteUser(userId);
  }

  // Email templates
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates).orderBy(emailTemplates.type);
  }

  async getEmailTemplate(type: EmailTemplateType): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.type, type));
    return template || undefined;
  }

  async upsertEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const existing = await this.getEmailTemplate(template.type as EmailTemplateType);
    
    if (existing) {
      const [updated] = await db
        .update(emailTemplates)
        .set({ ...template, updatedAt: new Date() })
        .where(eq(emailTemplates.type, template.type))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(emailTemplates).values(template).returning();
      return created;
    }
  }

  async resetEmailTemplate(type: EmailTemplateType): Promise<EmailTemplate | undefined> {
    // This will be handled by the email template service which knows the defaults
    await db.delete(emailTemplates).where(eq(emailTemplates.type, type));
    return undefined;
  }

  // ClamAV scan logs
  async createClamavScanLog(log: InsertClamavScanLog): Promise<ClamavScanLog> {
    const [created] = await db.insert(clamavScanLogs).values(log).returning();
    return created;
  }

  async getClamavScanLogs(options?: { 
    limit?: number; 
    offset?: number;
    status?: 'clean' | 'infected' | 'error';
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ logs: ClamavScanLog[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    
    let whereConditions: any[] = [];
    
    if (options?.status) {
      whereConditions.push(eq(clamavScanLogs.scanStatus, options.status));
    }
    if (options?.startDate) {
      whereConditions.push(sql`${clamavScanLogs.createdAt} >= ${options.startDate}`);
    }
    if (options?.endDate) {
      whereConditions.push(sql`${clamavScanLogs.createdAt} <= ${options.endDate}`);
    }
    
    const whereClause = whereConditions.length > 0 
      ? and(...whereConditions) 
      : undefined;
    
    const [totalResult] = await db
      .select({ count: count() })
      .from(clamavScanLogs)
      .where(whereClause);
    
    const logs = await db
      .select()
      .from(clamavScanLogs)
      .where(whereClause)
      .orderBy(desc(clamavScanLogs.createdAt))
      .limit(limit)
      .offset(offset);
    
    return { logs, total: totalResult.count };
  }

  async getClamavScanLog(id: number): Promise<ClamavScanLog | undefined> {
    const [log] = await db.select().from(clamavScanLogs).where(eq(clamavScanLogs.id, id));
    return log || undefined;
  }

  async markClamavScanNotified(id: number): Promise<ClamavScanLog> {
    const [updated] = await db
      .update(clamavScanLogs)
      .set({ adminNotifiedAt: new Date() })
      .where(eq(clamavScanLogs.id, id))
      .returning();
    return updated;
  }

  async getClamavScanStats(): Promise<{
    totalScans: number;
    cleanScans: number;
    infectedScans: number;
    errorScans: number;
    lastScanAt: Date | null;
  }> {
    const [totalResult] = await db.select({ count: count() }).from(clamavScanLogs);
    const [cleanResult] = await db.select({ count: count() }).from(clamavScanLogs)
      .where(eq(clamavScanLogs.scanStatus, 'clean'));
    const [infectedResult] = await db.select({ count: count() }).from(clamavScanLogs)
      .where(eq(clamavScanLogs.scanStatus, 'infected'));
    const [errorResult] = await db.select({ count: count() }).from(clamavScanLogs)
      .where(eq(clamavScanLogs.scanStatus, 'error'));
    
    const [lastScan] = await db
      .select({ createdAt: clamavScanLogs.createdAt })
      .from(clamavScanLogs)
      .orderBy(desc(clamavScanLogs.createdAt))
      .limit(1);
    
    return {
      totalScans: totalResult.count,
      cleanScans: cleanResult.count,
      infectedScans: infectedResult.count,
      errorScans: errorResult.count,
      lastScanAt: lastScan?.createdAt || null,
    };
  }
}

export const storage = new DatabaseStorage();
