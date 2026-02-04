import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { createTestPoll, createTestVote } from '../fixtures/testData';
import type { Express } from 'express';

export const testMeta = {
  category: 'polls' as const,
  name: 'Abstimmungs-Funktionalität',
  description: 'Prüft das Abstimmen, Bearbeiten und Validieren von Stimmen',
  severity: 'critical' as const,
};

describe('Polls - Voting', () => {
  let app: Express;
  let publicToken: string;
  let adminToken: string;
  let optionIds: number[];

  beforeAll(async () => {
    app = await createTestApp();
    
    const pollData = createTestPoll({ type: 'survey', resultsPublic: true });
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send(pollData);

    publicToken = createResponse.body.publicToken;
    adminToken = createResponse.body.adminToken;
    
    // Fetch poll to get options with IDs
    const pollResponse = await request(app)
      .get(`/api/v1/polls/public/${publicToken}`);
    optionIds = pollResponse.body.options.map((o: any) => o.id);
  });

  it('should submit a vote successfully', async () => {
    const voteData = createTestVote();
    
    // Use vote-bulk endpoint with correct format
    const response = await request(app)
      .post(`/api/v1/polls/${publicToken}/vote-bulk`)
      .send({
        voterName: voteData.voterName,
        voterEmail: voteData.voterEmail,
        votes: [
          { optionId: optionIds[0], response: 'yes' },
          { optionId: optionIds[1], response: 'no' },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('voterEditToken');
  });

  it('should reject vote without voter name', async () => {
    const response = await request(app)
      .post(`/api/v1/polls/${publicToken}/vote`)
      .send({
        voterEmail: 'test@example.com',
        votes: [{ optionId: optionIds[0], response: 'yes' }],
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should reject vote with invalid response value', async () => {
    const response = await request(app)
      .post(`/api/v1/polls/${publicToken}/vote`)
      .send({
        voterName: 'Test Voter',
        voterEmail: 'test@example.com',
        votes: [{ optionId: optionIds[0], response: 'invalid-response' }],
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should reject vote for non-existent poll', async () => {
    const response = await request(app)
      .post('/api/v1/polls/nonexistent-token/vote')
      .send({
        voterName: 'Test Voter',
        voterEmail: 'test@example.com',
        votes: [{ optionId: 1, response: 'yes' }],
      });

    // API may return 400 (validation) or 404 (not found)
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should return poll and stats in results', async () => {
    const response = await request(app)
      .get(`/api/v1/polls/${publicToken}/results`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('poll');
    expect(response.body).toHaveProperty('stats');
  });

  it('should persist votes and show them in results', async () => {
    // Create a fresh poll for this test
    const pollData = createTestPoll({ type: 'survey', resultsPublic: true });
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send(pollData);
    
    const testPublicToken = createResponse.body.publicToken;
    
    // Fetch poll to get option IDs
    const pollResponse = await request(app)
      .get(`/api/v1/polls/public/${testPublicToken}`);
    const testOptionIds = pollResponse.body.options.map((o: any) => o.id);
    
    // Submit a vote
    const voteResponse = await request(app)
      .post(`/api/v1/polls/${testPublicToken}/vote-bulk`)
      .send({
        voterName: 'Result Tester',
        voterEmail: `result-tester-${Date.now()}@example.com`,
        votes: [
          { optionId: testOptionIds[0], response: 'yes' },
          { optionId: testOptionIds[1], response: 'maybe' },
        ],
      });
    
    expect(voteResponse.status).toBe(200);
    
    // Verify votes appear in results
    const resultsResponse = await request(app)
      .get(`/api/v1/polls/${testPublicToken}/results`);
    
    expect(resultsResponse.status).toBe(200);
    
    // stats is an array of option statistics
    const stats = resultsResponse.body.stats;
    expect(stats).toBeDefined();
    expect(Array.isArray(stats)).toBe(true);
    
    // Find the option that got 'yes' vote
    const yesOption = stats.find((o: any) => o.optionId === testOptionIds[0]);
    expect(yesOption).toBeDefined();
    expect(yesOption.yesCount).toBeGreaterThanOrEqual(1);
  });

  it('should count multiple voters correctly', async () => {
    // Create a fresh poll
    const pollData = createTestPoll({ type: 'survey', resultsPublic: true });
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send(pollData);
    
    const testPublicToken = createResponse.body.publicToken;
    
    // Fetch options
    const pollResponse = await request(app)
      .get(`/api/v1/polls/public/${testPublicToken}`);
    const testOptionIds = pollResponse.body.options.map((o: any) => o.id);
    
    // Submit 3 different votes
    const timestamp = Date.now();
    for (let i = 1; i <= 3; i++) {
      await request(app)
        .post(`/api/v1/polls/${testPublicToken}/vote-bulk`)
        .send({
          voterName: `Voter ${i}`,
          voterEmail: `voter${i}-${timestamp}-${i}@example.com`,
          votes: [{ optionId: testOptionIds[0], response: 'yes' }],
        });
    }
    
    // Verify results
    const resultsResponse = await request(app)
      .get(`/api/v1/polls/${testPublicToken}/results`);
    
    expect(resultsResponse.status).toBe(200);
    
    // Verify yes count for first option
    const stats = resultsResponse.body.stats;
    const firstOption = stats.find((o: any) => o.optionId === testOptionIds[0]);
    expect(firstOption.yesCount).toBe(3);
  });

  it('should correctly aggregate different response types', async () => {
    // Create a fresh poll
    const pollData = createTestPoll({ type: 'survey', resultsPublic: true });
    const createResponse = await request(app)
      .post('/api/v1/polls')
      .send(pollData);
    
    const testPublicToken = createResponse.body.publicToken;
    
    // Fetch options
    const pollResponse = await request(app)
      .get(`/api/v1/polls/public/${testPublicToken}`);
    const testOptionIds = pollResponse.body.options.map((o: any) => o.id);
    
    const timestamp = Date.now();
    
    // Submit votes with different responses
    await request(app)
      .post(`/api/v1/polls/${testPublicToken}/vote-bulk`)
      .send({
        voterName: 'Yes Voter',
        voterEmail: `yes-${timestamp}@example.com`,
        votes: [{ optionId: testOptionIds[0], response: 'yes' }],
      });
    
    await request(app)
      .post(`/api/v1/polls/${testPublicToken}/vote-bulk`)
      .send({
        voterName: 'No Voter',
        voterEmail: `no-${timestamp}@example.com`,
        votes: [{ optionId: testOptionIds[0], response: 'no' }],
      });
    
    await request(app)
      .post(`/api/v1/polls/${testPublicToken}/vote-bulk`)
      .send({
        voterName: 'Maybe Voter',
        voterEmail: `maybe-${timestamp}@example.com`,
        votes: [{ optionId: testOptionIds[0], response: 'maybe' }],
      });
    
    // Verify aggregation
    const resultsResponse = await request(app)
      .get(`/api/v1/polls/${testPublicToken}/results`);
    
    const stats = resultsResponse.body.stats;
    const firstOption = stats.find((o: any) => o.optionId === testOptionIds[0]);
    
    expect(firstOption.yesCount).toBe(1);
    expect(firstOption.noCount).toBe(1);
    expect(firstOption.maybeCount).toBe(1);
  });

  describe('Vote Withdrawal', () => {
    it('should withdraw a vote from organization poll', async () => {
      // Create organization poll with withdrawal enabled
      const pollData = createTestPoll({ 
        type: 'organization', 
        allowVoteWithdrawal: true,
        resultsPublic: true 
      });
      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);
      
      const testPublicToken = createResponse.body.publicToken;
      
      // Fetch poll to get options
      const pollResponse = await request(app)
        .get(`/api/v1/polls/public/${testPublicToken}`);
      const testOptionIds = pollResponse.body.options.map((o: any) => o.id);
      
      const timestamp = Date.now();
      const voterEmail = `withdraw-test-${timestamp}@example.com`;
      
      // Submit a vote (booking a slot)
      const voteResponse = await request(app)
        .post(`/api/v1/polls/${testPublicToken}/vote-bulk`)
        .send({
          voterName: 'Withdrawal Tester',
          voterEmail: voterEmail,
          votes: [{ optionId: testOptionIds[0], response: 'yes' }],
        });
      
      expect(voteResponse.status).toBe(200);
      const voterEditToken = voteResponse.body.voterEditToken;
      
      // Verify vote exists in results
      let resultsResponse = await request(app)
        .get(`/api/v1/polls/${testPublicToken}/results`);
      let stats = resultsResponse.body.stats;
      let firstOption = stats.find((o: any) => o.optionId === testOptionIds[0]);
      expect(firstOption.yesCount).toBe(1);
      
      // Withdraw the vote using edit token (sent in body)
      const withdrawResponse = await request(app)
        .delete(`/api/v1/polls/${testPublicToken}/vote`)
        .send({ voterEditToken });
      
      expect(withdrawResponse.status).toBe(200);
      expect(withdrawResponse.body.withdrawnCount).toBe(1);
      
      // Verify vote is removed from results
      resultsResponse = await request(app)
        .get(`/api/v1/polls/${testPublicToken}/results`);
      stats = resultsResponse.body.stats;
      firstOption = stats.find((o: any) => o.optionId === testOptionIds[0]);
      expect(firstOption.yesCount).toBe(0);
    });

    it('should allow re-voting after withdrawal', async () => {
      // Create organization poll with withdrawal enabled
      const pollData = createTestPoll({ 
        type: 'organization', 
        allowVoteWithdrawal: true,
        resultsPublic: true 
      });
      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);
      
      const testPublicToken = createResponse.body.publicToken;
      
      // Fetch poll to get options
      const pollResponse = await request(app)
        .get(`/api/v1/polls/public/${testPublicToken}`);
      const testOptionIds = pollResponse.body.options.map((o: any) => o.id);
      
      const timestamp = Date.now();
      const voterEmail = `revote-test-${timestamp}@example.com`;
      
      // Submit initial vote
      const voteResponse = await request(app)
        .post(`/api/v1/polls/${testPublicToken}/vote-bulk`)
        .send({
          voterName: 'Revote Tester',
          voterEmail: voterEmail,
          votes: [{ optionId: testOptionIds[0], response: 'yes' }],
        });
      
      expect(voteResponse.status).toBe(200);
      const voterEditToken = voteResponse.body.voterEditToken;
      
      // Withdraw the vote (send token in body)
      const withdrawResponse = await request(app)
        .delete(`/api/v1/polls/${testPublicToken}/vote`)
        .send({ voterEditToken });
      
      expect(withdrawResponse.status).toBe(200);
      
      // Re-vote on a different option
      const revoteResponse = await request(app)
        .post(`/api/v1/polls/${testPublicToken}/vote-bulk`)
        .send({
          voterName: 'Revote Tester',
          voterEmail: voterEmail,
          votes: [{ optionId: testOptionIds[1], response: 'yes' }],
        });
      
      expect(revoteResponse.status).toBe(200);
      
      // Verify new vote is in results and old one is not
      const resultsResponse = await request(app)
        .get(`/api/v1/polls/${testPublicToken}/results`);
      const stats = resultsResponse.body.stats;
      
      const firstOption = stats.find((o: any) => o.optionId === testOptionIds[0]);
      const secondOption = stats.find((o: any) => o.optionId === testOptionIds[1]);
      
      expect(firstOption.yesCount).toBe(0);
      expect(secondOption.yesCount).toBe(1);
    });

    it('should reject withdrawal when disabled on poll', async () => {
      // Create poll with withdrawal disabled
      const pollData = createTestPoll({ 
        type: 'organization', 
        allowVoteWithdrawal: false,
        resultsPublic: true 
      });
      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);
      
      const testPublicToken = createResponse.body.publicToken;
      
      // Fetch poll to get options
      const pollResponse = await request(app)
        .get(`/api/v1/polls/public/${testPublicToken}`);
      const testOptionIds = pollResponse.body.options.map((o: any) => o.id);
      
      const timestamp = Date.now();
      const voterEmail = `no-withdraw-${timestamp}@example.com`;
      
      // Submit a vote
      const voteResponse = await request(app)
        .post(`/api/v1/polls/${testPublicToken}/vote-bulk`)
        .send({
          voterName: 'No Withdraw Tester',
          voterEmail: voterEmail,
          votes: [{ optionId: testOptionIds[0], response: 'yes' }],
        });
      
      expect(voteResponse.status).toBe(200);
      const voterEditToken = voteResponse.body.voterEditToken;
      
      // Attempt to withdraw - should fail
      const withdrawResponse = await request(app)
        .delete(`/api/v1/polls/${testPublicToken}/vote`)
        .send({ voterEditToken });
      
      expect(withdrawResponse.status).toBe(403);
      expect(withdrawResponse.body.error).toContain('nicht erlaubt');
    });

    it('should update slot capacity after withdrawal', async () => {
      // Create organization poll
      const pollData = createTestPoll({ 
        type: 'organization', 
        allowVoteWithdrawal: true,
        resultsPublic: true 
      });
      const createResponse = await request(app)
        .post('/api/v1/polls')
        .send(pollData);
      
      const testPublicToken = createResponse.body.publicToken;
      
      // Fetch poll to get options (Slot 1 has maxCapacity: 3)
      const pollResponse = await request(app)
        .get(`/api/v1/polls/public/${testPublicToken}`);
      const testOptionIds = pollResponse.body.options.map((o: any) => o.id);
      const slotOption = pollResponse.body.options[0];
      expect(slotOption.maxCapacity).toBe(3);
      
      const timestamp = Date.now();
      
      // Book 2 slots
      const voters = ['capacity-test-1', 'capacity-test-2'];
      const editTokens: string[] = [];
      
      for (let i = 0; i < voters.length; i++) {
        const voteResponse = await request(app)
          .post(`/api/v1/polls/${testPublicToken}/vote-bulk`)
          .send({
            voterName: voters[i],
            voterEmail: `${voters[i]}-${timestamp}@example.com`,
            votes: [{ optionId: testOptionIds[0], response: 'yes' }],
          });
        editTokens.push(voteResponse.body.voterEditToken);
      }
      
      // Verify 2 slots taken
      let resultsResponse = await request(app)
        .get(`/api/v1/polls/${testPublicToken}/results`);
      let stats = resultsResponse.body.stats;
      let firstOption = stats.find((o: any) => o.optionId === testOptionIds[0]);
      expect(firstOption.yesCount).toBe(2);
      
      // First voter withdraws (send token in body)
      const withdrawResponse = await request(app)
        .delete(`/api/v1/polls/${testPublicToken}/vote`)
        .send({ voterEditToken: editTokens[0] });
      
      expect(withdrawResponse.status).toBe(200);
      
      // Verify only 1 slot taken now (1 slot freed up)
      resultsResponse = await request(app)
        .get(`/api/v1/polls/${testPublicToken}/results`);
      stats = resultsResponse.body.stats;
      firstOption = stats.find((o: any) => o.optionId === testOptionIds[0]);
      expect(firstOption.yesCount).toBe(1);
    });
  });
});
