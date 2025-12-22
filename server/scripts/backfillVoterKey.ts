import { db } from '../storage';
import { votes, polls } from '@shared/schema';
import { eq, isNull, and, sql } from 'drizzle-orm';
import crypto from 'crypto';

function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex').substring(0, 32);
}

async function backfillVoterKeys() {
  console.log('Starting voterKey backfill...');
  
  const votesWithoutKey = await db.select().from(votes).where(isNull(votes.voterKey));
  console.log(`Found ${votesWithoutKey.length} votes without voterKey`);
  
  let updated = 0;
  for (const vote of votesWithoutKey) {
    let voterKey: string;
    let voterSource: 'user' | 'device';
    
    if (vote.userId) {
      voterKey = `user:${vote.userId}`;
      voterSource = 'user';
    } else if (vote.voterEmail) {
      voterKey = `email:${hashEmail(vote.voterEmail)}`;
      voterSource = 'device';
    } else {
      console.log(`Skipping vote ${vote.id} - no userId or email`);
      continue;
    }
    
    await db.update(votes)
      .set({ voterKey, voterSource })
      .where(eq(votes.id, vote.id));
    
    updated++;
    if (updated % 100 === 0) {
      console.log(`Updated ${updated} votes...`);
    }
  }
  
  console.log(`Backfilled ${updated} votes with voterKey`);
}

async function findAndReportDuplicates() {
  console.log('\nAnalyzing duplicates...');
  
  const allPolls = await db.select().from(polls);
  let totalDuplicates = 0;
  const duplicateGroups: Array<{pollId: string; voterKey: string; count: number; voteIds: number[]}> = [];
  
  for (const poll of allPolls) {
    const pollVotes = await db.select().from(votes).where(eq(votes.pollId, poll.id));
    
    const votesByKey = new Map<string, typeof pollVotes>();
    
    for (const vote of pollVotes) {
      const key = vote.voterKey || `email:${hashEmail(vote.voterEmail || '')}`;
      if (!votesByKey.has(key)) {
        votesByKey.set(key, []);
      }
      votesByKey.get(key)!.push(vote);
    }
    
    for (const [voterKey, keyVotes] of votesByKey.entries()) {
      if (keyVotes.length > 1) {
        const optionCounts = new Map<number, number>();
        for (const v of keyVotes) {
          optionCounts.set(v.optionId, (optionCounts.get(v.optionId) || 0) + 1);
        }
        
        for (const [optionId, count] of optionCounts.entries()) {
          if (count > 1) {
            const duplicateVotes = keyVotes.filter(v => v.optionId === optionId);
            totalDuplicates += count - 1;
            duplicateGroups.push({
              pollId: poll.id,
              voterKey,
              count,
              voteIds: duplicateVotes.map(v => v.id)
            });
          }
        }
      }
    }
  }
  
  console.log(`Found ${totalDuplicates} duplicate votes across ${duplicateGroups.length} groups`);
  
  return duplicateGroups;
}

async function cleanupDuplicates(duplicateGroups: Array<{pollId: string; voterKey: string; count: number; voteIds: number[]}>) {
  console.log('\nCleaning up duplicates...');
  
  let deleted = 0;
  for (const group of duplicateGroups) {
    const [keepId, ...deleteIds] = group.voteIds;
    console.log(`Poll ${group.pollId}, voterKey ${group.voterKey}: keeping vote ${keepId}, deleting ${deleteIds.join(', ')}`);
    
    for (const deleteId of deleteIds) {
      await db.delete(votes).where(eq(votes.id, deleteId));
      deleted++;
    }
  }
  
  console.log(`Deleted ${deleted} duplicate votes`);
}

async function main() {
  try {
    await backfillVoterKeys();
    
    const duplicates = await findAndReportDuplicates();
    
    if (duplicates.length > 0) {
      console.log('\nDuplicate groups found:');
      for (const group of duplicates) {
        console.log(`  - Poll ${group.pollId}, voterKey ${group.voterKey}: ${group.count} votes (IDs: ${group.voteIds.join(', ')})`);
      }
      
      const args = process.argv.slice(2);
      if (args.includes('--cleanup')) {
        await cleanupDuplicates(duplicates);
      } else {
        console.log('\nTo delete duplicates, run with --cleanup flag');
      }
    }
    
    console.log('\nDone!');
    process.exit(0);
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

main();
