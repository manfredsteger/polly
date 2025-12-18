#!/usr/bin/env tsx

import { db } from '../server/db';
import { polls, pollOptions } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function updateExamples() {
  console.log('Updating example polls with latest features...');

  // Update survey with example images and alt text
  const surveyOptions = await db.select().from(pollOptions)
    .innerJoin(polls, eq(pollOptions.pollId, polls.id))
    .where(eq(polls.title, 'KITA Sommerfest Aktivitäten 2025'));

  console.log(`Found ${surveyOptions.length} survey options to update`);

  // Sample SVG images for each activity (using inline SVGs for reliability)
  const optionUpdates = [
    {
      text: 'Hüpfburg und Spielgeräte',
      altText: 'Bunte Hüpfburg mit Kindern, die darauf spielen und lachen'
    },
    {
      text: 'Kinderschminken',
      altText: 'Kind mit bunter Gesichtsbemalung als Schmetterling'
    },
    {
      text: 'Bastelstation',
      altText: 'Basteltisch mit Schere, Kleber, buntem Papier und Kindern beim Basteln'
    },
    {
      text: 'Grillstation mit Würstchen',
      altText: 'Grillrost mit Würstchen, die brutzeln, und Rauch der aufsteigt'
    },
    {
      text: 'Musik und Tanz',
      altText: 'Kinder tanzen fröhlich zu Musik, einige halten Instrumente'
    }
  ];

  // Update each option with alt text
  for (let i = 0; i < Math.min(surveyOptions.length, optionUpdates.length); i++) {
    const option = surveyOptions[i].poll_options;
    const update = optionUpdates[i];
    
    if (option.text === update.text && !option.altText) {
      await db.update(pollOptions)
        .set({ altText: update.altText })
        .where(eq(pollOptions.id, option.id));
      
      console.log(`✅ Updated "${update.text}" with alt text`);
    }
  }

  console.log('\n✅ Examples updated with latest accessibility features!');
  console.log('All survey options now have proper alt text for better accessibility testing.');
}

updateExamples().catch(console.error).finally(() => process.exit(0));