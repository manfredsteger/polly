#!/usr/bin/env tsx

import { db } from '../server/db';
import { polls, pollOptions } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

async function addImagesToExamples() {
  console.log('Adding beautiful SVG images to example survey...');

  // Find the survey poll
  const survey = await db.select().from(polls)
    .where(eq(polls.title, 'KITA Sommerfest Aktivitäten 2025'))
    .limit(1);

  if (survey.length === 0) {
    console.log('Survey not found. Please run create-examples.ts first.');
    return;
  }

  // Get all options for this survey
  const options = await db.select().from(pollOptions)
    .where(eq(pollOptions.pollId, survey[0].id))
    .orderBy(pollOptions.order);

  console.log(`Found ${options.length} options to update with images`);

  // Image mappings
  const imageUpdates = [
    {
      text: 'Hüpfburg und Spielgeräte',
      imageUrl: '/survey-images/huepfburg.svg',
      altText: 'Bunte Hüpfburg mit fröhlichen Kindern, die darauf spielen und in die Luft springen'
    },
    {
      text: 'Kinderschminken',
      imageUrl: '/survey-images/kinderschminken.svg',
      altText: 'Kind mit bunter Schmetterlings-Gesichtsbemalung, umgeben von Pinseln und Farben'
    },
    {
      text: 'Bastelstation',
      imageUrl: '/survey-images/bastelstation.svg',
      altText: 'Kind bastelt fröhlich an einem Haus-Bild, umgeben von Schere, Kleber und buntem Papier'
    },
    {
      text: 'Grillstation mit Würstchen',
      imageUrl: '/survey-images/grillstation.svg',
      altText: 'Koch mit Schürze grillt Würstchen, Rauch steigt auf, Kinder warten gespannt am Picknicktisch'
    },
    {
      text: 'Musik und Tanz',
      imageUrl: '/survey-images/musik-tanz.svg',
      altText: 'Kinder tanzen ausgelassen zu Musik, eines spielt Tamburin, Musiknoten schweben in der Luft'
    }
  ];

  // Update each option with image and enhanced alt text
  for (let i = 0; i < Math.min(options.length, imageUpdates.length); i++) {
    const option = options[i];
    const update = imageUpdates.find(u => u.text === option.text);
    
    if (update) {
      await db.update(pollOptions)
        .set({ 
          imageUrl: update.imageUrl,
          altText: update.altText
        })
        .where(eq(pollOptions.id, option.id));
      
      console.log(`✅ Updated "${update.text}" with beautiful SVG image and alt text`);
    }
  }

  console.log('\n🎨 Example survey now has beautiful, colorful SVG images!');
  console.log('Each image is professionally designed and includes detailed alt text for accessibility.');
  console.log('\nBookmark URLs:');
  console.log(`📊 Survey: http://localhost:5000/poll/example-survey-public-2HBD_6QRkmWXAFW0C1dE`);
  console.log(`🔧 Admin:  http://localhost:5000/admin/example-survey-admin-S3O3K40gXfe3v_xGgl2T`);
}

addImagesToExamples().catch(console.error).finally(() => process.exit(0));