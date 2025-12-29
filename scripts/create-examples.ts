#!/usr/bin/env tsx

import { db } from '../server/db';
import { polls, pollOptions, users } from '../shared/schema';
import { nanoid } from 'nanoid';

async function createExamples() {
  console.log('Creating example polls and surveys...');

  // Create example user if not exists
  const exampleUser = await db.insert(users).values({
    username: 'example-creator',
    name: 'Polly Beispiel-Ersteller',
    email: 'creator@example.com',
    role: 'user'
  }).onConflictDoNothing().returning();

  // 1. Create Example Survey with Images
  const surveyId = crypto.randomUUID();
  const surveyPublicToken = 'example-survey-public-' + nanoid(20);
  const surveyAdminToken = 'example-survey-admin-' + nanoid(20);

  await db.insert(polls).values({
    id: surveyId,
    title: 'Team Sommerfest Aktivitäten 2025',
    description: 'Welche Aktivitäten sollen wir beim diesjährigen Sommerfest anbieten? Stimmen Sie für Ihre Favoriten ab!',
    type: 'survey',
    publicToken: surveyPublicToken,
    adminToken: surveyAdminToken,
    creatorEmail: 'events@example.com',
    userId: exampleUser[0]?.id || null,
    isAnonymous: true
  }).onConflictDoNothing();

  await db.insert(pollOptions).values([
    {
      pollId: surveyId,
      text: 'Hüpfburg und Spielgeräte',
      imageUrl: null,
      altText: null,
      order: 0
    },
    {
      pollId: surveyId,
      text: 'Kinderschminken',
      imageUrl: null,
      altText: null,
      order: 1
    },
    {
      pollId: surveyId,
      text: 'Bastelstation',
      imageUrl: null,
      altText: null,
      order: 2
    },
    {
      pollId: surveyId,
      text: 'Grillstation mit Würstchen',
      imageUrl: null,
      altText: null,
      order: 3
    },
    {
      pollId: surveyId,
      text: 'Musik und Tanz',
      imageUrl: null,
      altText: null,
      order: 4
    }
  ]).onConflictDoNothing();

  // 2. Create Example Date Poll
  const pollId = crypto.randomUUID();
  const pollPublicToken = 'example-poll-public-' + nanoid(20);
  const pollAdminToken = 'example-poll-admin-' + nanoid(20);

  await db.insert(polls).values({
    id: pollId,
    title: 'Elternabend Terminplanung',
    description: 'Wann passt Ihnen der nächste Elternabend am besten? Wir möchten einen Termin finden, der für möglichst viele Eltern geeignet ist.',
    type: 'poll',
    publicToken: pollPublicToken,
    adminToken: pollAdminToken,
    creatorEmail: 'team@example.com',
    userId: exampleUser[0]?.id || null,
    isAnonymous: true
  }).onConflictDoNothing();

  // Create date options for next week
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + 7); // Next week

  const dateOptions = [
    { day: 1, time: '19:00-20:30', label: 'Montag' },
    { day: 2, time: '19:30-21:00', label: 'Dienstag' },
    { day: 3, time: '19:00-20:30', label: 'Mittwoch' },
    { day: 4, time: '19:30-21:00', label: 'Donnerstag' },
  ];

  const pollOptionsData = dateOptions.map((option, index) => {
    const optionDate = new Date(baseDate);
    optionDate.setDate(baseDate.getDate() - baseDate.getDay() + option.day);
    
    const startTime = new Date(optionDate);
    const [startHour, startMin] = option.time.split('-')[0].split(':');
    startTime.setHours(parseInt(startHour), parseInt(startMin), 0, 0);
    
    const endTime = new Date(optionDate);
    const [endHour, endMin] = option.time.split('-')[1].split(':');
    endTime.setHours(parseInt(endHour), parseInt(endMin), 0, 0);

    return {
      pollId: pollId,
      text: `${option.label}, ${optionDate.toLocaleDateString('de-DE')} (${option.time})`,
      imageUrl: null,
      altText: null,
      startTime: startTime,
      endTime: endTime,
      order: index
    };
  });

  await db.insert(pollOptions).values(pollOptionsData).onConflictDoNothing();

  console.log('\n✅ Example polls created successfully!');
  console.log('\n📊 EXAMPLE SURVEY - Sommerfest Aktivitäten:');
  console.log(`   Public URL:  http://localhost:5000/poll/${surveyPublicToken}`);
  console.log(`   Admin URL:   http://localhost:5000/admin/${surveyAdminToken}`);
  console.log(`   Results URL: http://localhost:5000/poll/${surveyPublicToken}#results`);
  
  console.log('\n📅 EXAMPLE POLL - Elternabend Terminplanung:');
  console.log(`   Public URL:  http://localhost:5000/poll/${pollPublicToken}`);
  console.log(`   Admin URL:   http://localhost:5000/admin/${pollAdminToken}`);
  console.log(`   Results URL: http://localhost:5000/poll/${pollPublicToken}#results`);
  
  console.log('\n💡 Save these URLs as bookmarks for easy testing!');
  console.log('   You can vote, check results, and test all features with these examples.');
}

createExamples().catch(console.error).finally(() => process.exit(0));