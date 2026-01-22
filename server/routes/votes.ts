import { Router } from "express";
import { storage } from "../storage";
import { emailService } from "../services/emailService";
import { liveVotingService } from "../services/liveVotingService";
import { deviceTokenService } from "../services/deviceTokenService";
import { z } from "zod";
import {
  extractUserId,
  bulkVoteSchema,
  recentEmailSends,
  EMAIL_COOLDOWN,
} from "./common";

const router = Router();

// Bulk vote (primary voting endpoint)
router.post('/polls/:token/vote', async (req, res) => {
  try {
    const poll = await storage.getPollByPublicToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (!poll.isActive) {
      return res.status(400).json({ 
        error: 'Diese Umfrage ist nicht mehr aktiv.',
        errorCode: 'POLL_INACTIVE'
      });
    }

    if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) {
      return res.status(400).json({ 
        error: 'Diese Umfrage ist abgelaufen.',
        errorCode: 'POLL_EXPIRED'
      });
    }

    const data = bulkVoteSchema.parse(req.body);
    
    const currentUserId = await extractUserId(req);
    let userId: number | null = null;
    
    if (currentUserId) {
      const currentUser = await storage.getUser(currentUserId);
      if (currentUser) {
        if (currentUser.email.toLowerCase() === data.voterEmail.toLowerCase()) {
          userId = currentUserId;
        } else {
          const targetUser = await storage.getUserByEmail(data.voterEmail.toLowerCase());
          if (targetUser) {
            return res.status(403).json({
              error: 'Diese E-Mail-Adresse gehört zu einem anderen Konto. Sie können nur mit Ihrer eigenen E-Mail abstimmen.',
              errorCode: 'EMAIL_BELONGS_TO_ANOTHER_USER'
            });
          }
        }
      }
    } else {
      const existingUser = await storage.getUserByEmail(data.voterEmail.toLowerCase().trim());
      if (existingUser) {
        return res.status(409).json({
          error: 'Diese E-Mail-Adresse gehört zu einem registrierten Konto. Bitte melden Sie sich an, um abzustimmen.',
          errorCode: 'REQUIRES_LOGIN'
        });
      }
    }

    const isTestMode = req.isTestMode === true;

    const existingVotes = await storage.getVotesByEmail(poll.id, data.voterEmail);
    if (existingVotes.length > 0 && !poll.allowVoteEdit) {
      return res.status(400).json({
        error: 'Sie haben bereits abgestimmt. Diese Umfrage erlaubt keine Bearbeitung.',
        errorCode: 'ALREADY_VOTED'
      });
    }

    const createdVotes = [];
    let voterEditToken = existingVotes[0]?.voterEditToken;

    for (const voteData of data.votes) {
      const existingVote = existingVotes.find(v => v.optionId === voteData.optionId);

      if (existingVote) {
        if (poll.allowVoteEdit) {
          const updated = await storage.updateVote(existingVote.id, voteData.response);
          createdVotes.push(updated);
        }
      } else {
        const result = await storage.createVote({
          pollId: poll.id,
          optionId: voteData.optionId,
          voterName: data.voterName,
          voterEmail: data.voterEmail,
          response: voteData.response,
          comment: voteData.comment,
          userId: userId,
          isTestData: isTestMode,
        }, voterEditToken);
        
        createdVotes.push(result.vote);
        voterEditToken = result.editToken;
      }
    }

    // For organization polls: Broadcast slot update via WebSocket
    if (poll.type === 'organization') {
      const freshPoll = await storage.getPollByPublicToken(poll.publicToken);
      if (freshPoll) {
        const slotUpdates: Record<number, { currentCount: number; maxCapacity: number | null }> = {};
        for (const option of freshPoll.options) {
          const signupCount = freshPoll.votes.filter(v => v.optionId === option.id && v.response === 'yes').length;
          slotUpdates[option.id] = {
            currentCount: signupCount,
            maxCapacity: option.maxCapacity
          };
        }
        liveVotingService.broadcastSlotUpdate(poll.publicToken, slotUpdates);
        if (poll.adminToken) {
          liveVotingService.broadcastSlotUpdate(poll.adminToken, slotUpdates);
        }
      }
    }

    // Send confirmation email (with anti-spam check)
    if (!isTestMode && data.voterEmail && createdVotes.length > 0) {
      const now = Date.now();
      const emailKey = `${poll.id}:${data.voterEmail.toLowerCase()}`;
      const lastSent = recentEmailSends.get(emailKey);
      
      if (!lastSent || (now - lastSent) > EMAIL_COOLDOWN) {
        const { getBaseUrl } = await import('../utils/baseUrl');
        const baseUrl = getBaseUrl();
        const publicLink = `${baseUrl}/poll/${poll.publicToken}`;
        const resultsLink = `${baseUrl}/poll/${poll.publicToken}#results`;
        
        emailService.sendVotingConfirmationEmail(
          data.voterEmail,
          data.voterName,
          poll.title,
          poll.type as 'schedule' | 'survey',
          publicLink,
          resultsLink
        ).catch(err => {
          console.error('Error sending voting confirmation email:', err);
        });
        
        recentEmailSends.set(emailKey, now);
        
        // Clean up old entries
        const entriesToDelete: string[] = [];
        recentEmailSends.forEach((timestamp, key) => {
          if (now - timestamp > 300000) { // 5 minutes
            entriesToDelete.push(key);
          }
        });
        entriesToDelete.forEach(key => recentEmailSends.delete(key));
      }
    }
    
    res.json({ 
      success: true, 
      votes: createdVotes,
      voterEditToken: poll.allowVoteEdit ? voterEditToken : null
    });
  } catch (error) {
    console.error('Error bulk voting:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid vote data', 
        details: error.errors 
      });
    }
    if (error instanceof Error && error.message === 'DUPLICATE_EMAIL_VOTE') {
      return res.status(400).json({ 
        error: 'Diese E-Mail-Adresse hat bereits bei dieser Umfrage abgestimmt.',
        errorCode: 'DUPLICATE_EMAIL_VOTE'
      });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk vote endpoint (alias for backward compatibility)
// Uses the same logic as /vote - just a different path
router.post('/polls/:token/vote-bulk', async (req, res) => {
  try {
    const poll = await storage.getPollByPublicToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (!poll.isActive) {
      return res.status(400).json({ 
        error: 'Diese Umfrage ist nicht mehr aktiv.',
        errorCode: 'POLL_INACTIVE'
      });
    }

    if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) {
      return res.status(400).json({ 
        error: 'Diese Umfrage ist abgelaufen.',
        errorCode: 'POLL_EXPIRED'
      });
    }

    const data = bulkVoteSchema.parse(req.body);
    
    const currentUserId = await extractUserId(req);
    let userId: number | null = null;
    
    if (currentUserId) {
      const currentUser = await storage.getUser(currentUserId);
      if (currentUser) {
        if (currentUser.email.toLowerCase() === data.voterEmail.toLowerCase()) {
          userId = currentUserId;
        } else {
          const targetUser = await storage.getUserByEmail(data.voterEmail.toLowerCase());
          if (targetUser) {
            return res.status(403).json({
              error: 'Diese E-Mail-Adresse gehört zu einem anderen Konto. Sie können nur mit Ihrer eigenen E-Mail abstimmen.',
              errorCode: 'EMAIL_BELONGS_TO_ANOTHER_USER'
            });
          }
        }
      }
    } else {
      const existingUser = await storage.getUserByEmail(data.voterEmail.toLowerCase().trim());
      if (existingUser) {
        return res.status(409).json({
          error: 'Diese E-Mail-Adresse gehört zu einem registrierten Konto. Bitte melden Sie sich an, um abzustimmen.',
          errorCode: 'REQUIRES_LOGIN'
        });
      }
    }

    const isTestMode = req.isTestMode === true;

    const existingVotes = await storage.getVotesByEmail(poll.id, data.voterEmail);
    if (existingVotes.length > 0 && !poll.allowVoteEdit) {
      return res.status(400).json({
        error: 'Sie haben bereits abgestimmt. Diese Umfrage erlaubt keine Bearbeitung.',
        errorCode: 'ALREADY_VOTED'
      });
    }

    const createdVotes = [];
    let voterEditToken = existingVotes[0]?.voterEditToken;

    for (const voteData of data.votes) {
      const existingVote = existingVotes.find(v => v.optionId === voteData.optionId);

      if (existingVote) {
        if (poll.allowVoteEdit) {
          const updated = await storage.updateVote(existingVote.id, voteData.response);
          createdVotes.push(updated);
        }
      } else {
        const result = await storage.createVote({
          pollId: poll.id,
          optionId: voteData.optionId,
          voterName: data.voterName,
          voterEmail: data.voterEmail,
          response: voteData.response,
          comment: voteData.comment,
          userId: userId,
          isTestData: isTestMode,
        }, voterEditToken);
        
        createdVotes.push(result.vote);
        voterEditToken = result.editToken;
      }
    }

    // For organization polls: Broadcast slot update via WebSocket
    if (poll.type === 'organization') {
      const freshPoll = await storage.getPollByPublicToken(poll.publicToken);
      if (freshPoll) {
        const slotUpdates: Record<number, { currentCount: number; maxCapacity: number | null }> = {};
        for (const option of freshPoll.options) {
          const signupCount = freshPoll.votes.filter(v => v.optionId === option.id && v.response === 'yes').length;
          slotUpdates[option.id] = {
            currentCount: signupCount,
            maxCapacity: option.maxCapacity
          };
        }
        liveVotingService.broadcastSlotUpdate(poll.publicToken, slotUpdates);
        if (poll.adminToken) {
          liveVotingService.broadcastSlotUpdate(poll.adminToken, slotUpdates);
        }
      }
    }

    // Send confirmation email (with anti-spam check)
    if (!isTestMode && data.voterEmail && createdVotes.length > 0) {
      const now = Date.now();
      const emailKey = `${poll.id}:${data.voterEmail.toLowerCase()}`;
      const lastSent = recentEmailSends.get(emailKey);
      
      if (!lastSent || (now - lastSent) > EMAIL_COOLDOWN) {
        const { getBaseUrl } = await import('../utils/baseUrl');
        const baseUrl = getBaseUrl();
        const publicLink = `${baseUrl}/poll/${poll.publicToken}`;
        const resultsLink = `${baseUrl}/poll/${poll.publicToken}#results`;
        
        emailService.sendVotingConfirmationEmail(
          data.voterEmail,
          data.voterName,
          poll.title,
          poll.type as 'schedule' | 'survey',
          publicLink,
          resultsLink
        ).catch(err => {
          console.error('Error sending voting confirmation email:', err);
        });
        
        recentEmailSends.set(emailKey, now);
        
        // Clean up old entries
        const entriesToDelete: string[] = [];
        recentEmailSends.forEach((timestamp, key) => {
          if (now - timestamp > 300000) { // 5 minutes
            entriesToDelete.push(key);
          }
        });
        entriesToDelete.forEach(key => recentEmailSends.delete(key));
      }
    }
    
    res.json({ 
      success: true, 
      votes: createdVotes,
      voterEditToken: poll.allowVoteEdit ? voterEditToken : null
    });
  } catch (error) {
    console.error('Error bulk voting:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid vote data', 
        details: error.errors 
      });
    }
    if (error instanceof Error && error.message === 'DUPLICATE_EMAIL_VOTE') {
      return res.status(400).json({ 
        error: 'Diese E-Mail-Adresse hat bereits bei dieser Umfrage abgestimmt.',
        errorCode: 'DUPLICATE_EMAIL_VOTE'
      });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Withdraw all votes for a poll (delete votes)
router.delete('/polls/:token/vote', async (req, res) => {
  try {
    const poll = await storage.getPollByPublicToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Umfrage nicht gefunden' });
    }

    if (!poll.allowVoteWithdrawal) {
      return res.status(403).json({ 
        error: 'Das Zurückziehen von Stimmen ist bei dieser Umfrage nicht erlaubt.',
        errorCode: 'WITHDRAWAL_NOT_ALLOWED'
      });
    }

    if (!poll.isActive) {
      return res.status(400).json({ 
        error: 'Diese Umfrage ist bereits beendet.',
        errorCode: 'POLL_INACTIVE'
      });
    }

    const { voterEmail, voterEditToken } = req.body;
    const currentUserId = await extractUserId(req);
    
    let votesToDelete: any[] = [];
    
    if (currentUserId) {
      const user = await storage.getUser(currentUserId);
      if (user) {
        const votesByEmail = await storage.getVotesByEmail(poll.id, user.email);
        votesToDelete = votesByEmail;
        console.log(`[Vote Withdrawal] Found ${votesToDelete.length} votes for user ${user.email} in poll ${poll.id}`);
      }
    }
    
    if (votesToDelete.length === 0 && voterEditToken) {
      const votesByToken = await storage.getVotesByEditToken(voterEditToken);
      votesToDelete = votesByToken.filter(v => v.pollId === poll.id);
      console.log(`[Vote Withdrawal] Found ${votesToDelete.length} votes by edit token in poll ${poll.id}`);
    }
    
    if (votesToDelete.length === 0 && voterEmail && !currentUserId) {
      const votesByEmail = await storage.getVotesByEmail(poll.id, voterEmail);
      votesToDelete = votesByEmail;
      console.log(`[Vote Withdrawal] Found ${votesToDelete.length} votes by email ${voterEmail} in poll ${poll.id}`);
    }
    
    if (votesToDelete.length === 0) {
      return res.status(404).json({ 
        error: 'Keine Stimmen gefunden, die zurückgezogen werden können.',
        errorCode: 'NO_VOTES_FOUND'
      });
    }
    
    for (const vote of votesToDelete) {
      await storage.deleteVote(vote.id);
    }
    
    console.log(`[Vote] Withdrew ${votesToDelete.length} votes from poll ${poll.id}`);
    
    // For organization polls: Broadcast slot update via WebSocket after withdrawal
    if (poll.type === 'organization') {
      const freshPoll = await storage.getPollByPublicToken(poll.publicToken);
      if (freshPoll) {
        const slotUpdates: Record<number, { currentCount: number; maxCapacity: number | null }> = {};
        for (const option of freshPoll.options) {
          const signupCount = freshPoll.votes.filter(v => v.optionId === option.id && v.response === 'yes').length;
          slotUpdates[option.id] = {
            currentCount: signupCount,
            maxCapacity: option.maxCapacity
          };
        }
        liveVotingService.broadcastSlotUpdate(poll.publicToken, slotUpdates);
        if (poll.adminToken) {
          liveVotingService.broadcastSlotUpdate(poll.adminToken, slotUpdates);
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: `${votesToDelete.length} Stimme(n) erfolgreich zurückgezogen.`,
      withdrawnCount: votesToDelete.length
    });
  } catch (error) {
    console.error('Error withdrawing votes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get voter's votes by edit token
router.get('/votes/edit/:editToken', async (req, res) => {
  try {
    const editToken = req.params.editToken;
    const voterVotes = await storage.getVotesByEditToken(editToken);
    
    if (voterVotes.length === 0) {
      return res.status(404).json({ error: 'No votes found for this edit token' });
    }

    const fullPoll = await storage.getPoll(voterVotes[0].pollId);
    if (!fullPoll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // SECURITY: Only return poll metadata and options, NOT other voters' data
    const securePoll = {
      id: fullPoll.id,
      title: fullPoll.title,
      description: fullPoll.description,
      type: fullPoll.type,
      isActive: fullPoll.isActive,
      expiresAt: fullPoll.expiresAt,
      createdAt: fullPoll.createdAt,
      options: fullPoll.options.map(opt => ({
        id: opt.id,
        text: opt.text,
        imageUrl: opt.imageUrl,
        altText: opt.altText,
        startTime: opt.startTime,
        endTime: opt.endTime,
        order: opt.order
      }))
    };

    res.json({
      poll: securePoll,
      votes: voterVotes,
      voterName: voterVotes[0].voterName,
      voterEmail: voterVotes[0].voterEmail,
      allowVoteWithdrawal: fullPoll.allowVoteWithdrawal
    });
  } catch (error) {
    console.error('Error getting voter votes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update voter's votes by edit token
router.put('/votes/edit/:editToken', async (req, res) => {
  try {
    const editToken = req.params.editToken;
    const { votes: updatedVotes } = req.body;

    if (!updatedVotes || !Array.isArray(updatedVotes)) {
      return res.status(400).json({ error: 'Invalid votes data' });
    }

    const existingVotes = await storage.getVotesByEditToken(editToken);
    if (existingVotes.length === 0) {
      return res.status(404).json({ error: 'No votes found for this edit token' });
    }

    const updatedResults = [];
    for (const updatedVote of updatedVotes) {
      const existingVote = existingVotes.find((v: any) => v.optionId === updatedVote.optionId);
      if (existingVote) {
        const updated = await storage.updateVote(existingVote.id, updatedVote.response);
        updatedResults.push(updated);
      }
    }

    res.json({ success: true, votes: updatedResults });
  } catch (error) {
    console.error('Error updating voter votes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend voting confirmation email for vote editing
router.post('/polls/:token/resend-email', async (req, res) => {
  try {
    const poll = await storage.getPollByPublicToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const existingVotes = await storage.getVotesByEmail(poll.id, email);
    if (existingVotes.length === 0) {
      return res.status(404).json({ error: 'No votes found for this email address' });
    }

    const voterName = existingVotes[0].voterName;

    const { getBaseUrl } = await import('../utils/baseUrl');
    const baseUrl = getBaseUrl();
    const publicLink = `${baseUrl}/poll/${poll.publicToken}`;
    const resultsLink = `${baseUrl}/poll/${poll.publicToken}#results`;

    try {
      await emailService.sendVotingConfirmationEmail(
        email,
        voterName,
        poll.title,
        poll.type as 'schedule' | 'survey',
        publicLink,
        resultsLink
      );
      res.json({ success: true, message: 'Email sent successfully' });
    } catch (emailError: any) {
      console.error('Failed to send resend email:', emailError);
      
      if (emailError.message && emailError.message.includes('Spam message rejected')) {
        res.json({ 
          success: false, 
          message: 'Email delivery blocked by spam filter',
          errorCode: 'EMAIL_BLOCKED_BY_SPAM_FILTER',
          instructions: 'Please contact the poll administrator or try again later.'
        });
      } else {
        res.status(500).json({ error: 'Failed to send email due to server configuration' });
      }
    }
  } catch (error) {
    console.error('Error resending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Check if current user/device has already voted on a poll
router.get('/polls/:token/my-votes', async (req, res) => {
  try {
    const poll = await storage.getPollByPublicToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    // Calculate voterKey from session or device token
    const deviceToken = req.cookies?.deviceToken;
    const userAgent = req.headers['user-agent'] || 'unknown';
    const sessionUserId = req.session?.userId || null;
    const { voterKey, voterSource, newDeviceToken } = deviceTokenService.getVoterKey(
      sessionUserId,
      deviceToken,
      userAgent
    );
    
    // Set device token cookie if a new one was generated
    if (newDeviceToken) {
      res.cookie('deviceToken', newDeviceToken, deviceTokenService.getCookieOptions());
    }
    
    // Find existing votes by voterKey
    const existingVotes = await storage.getVotesByVoterKey(poll.id, voterKey);
    
    // Also check by userId if logged in (for backwards compatibility)
    let userVotes: typeof existingVotes = [];
    if (sessionUserId) {
      userVotes = await storage.getVotesByUserId(poll.id, sessionUserId);
    }
    
    // Merge votes (remove duplicates by optionId)
    const allVotes = [...existingVotes];
    for (const userVote of userVotes) {
      if (!allVotes.some(v => v.optionId === userVote.optionId)) {
        allVotes.push(userVote);
      }
    }
    
    res.json({
      hasVoted: allVotes.length > 0,
      votes: allVotes.map(v => ({
        optionId: v.optionId,
        response: v.response,
        voterName: v.voterName,
        voterEmail: v.voterEmail,
        comment: v.comment,
        voterEditToken: v.voterEditToken
      })),
      allowVoteEdit: poll.allowVoteEdit,
      allowVoteWithdrawal: poll.allowVoteWithdrawal,
      voterKey,
      voterSource
    });
  } catch (error) {
    console.error('Error checking votes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
