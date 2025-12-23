/**
 * Polly - Demo Data Seeder
 * Creates sample polls for quick evaluation and testing
 */

import { db } from "./db";
import { polls, pollOptions, votes } from "@shared/schema";
import { nanoid } from "nanoid";

async function seedDemoData() {
  console.log("🌱 Seeding demo data...");

  // Check if demo data already exists
  const existingPolls = await db.select().from(polls).limit(1);
  if (existingPolls.length > 0) {
    console.log("📦 Demo data already exists, skipping...");
    return;
  }

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // ============================================
  // Demo Poll 1: Schedule Poll (Terminumfrage)
  // ============================================
  const schedulePublicToken = nanoid(12);
  const scheduleAdminToken = nanoid(12);

  const [schedulePoll] = await db.insert(polls).values({
    title: "Team-Meeting - Terminabstimmung",
    description: "Bitte wählen Sie Ihre verfügbaren Termine für unser nächstes Team-Meeting. Wir suchen einen Termin, der für möglichst viele passt.",
    type: "schedule",
    adminToken: scheduleAdminToken,
    publicToken: schedulePublicToken,
    isActive: true,
    isAnonymous: false,
    allowAnonymousVoting: true,
    allowVoteEdit: true,
    allowMaybe: true,
    resultsPublic: true,
    isTestData: true,
    expiresAt: twoWeeks,
  }).returning();

  // Schedule poll options (dates with times)
  const scheduleDates = [
    { offset: 3, hour: 10, label: "Vormittag" },
    { offset: 3, hour: 14, label: "Nachmittag" },
    { offset: 5, hour: 10, label: "Vormittag" },
    { offset: 5, hour: 14, label: "Nachmittag" },
    { offset: 7, hour: 10, label: "Vormittag" },
  ];

  const scheduleOptionIds: number[] = [];
  for (let i = 0; i < scheduleDates.length; i++) {
    const { offset, hour } = scheduleDates[i];
    const startTime = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    startTime.setHours(hour, 0, 0, 0);
    const endTime = new Date(startTime);
    endTime.setHours(hour + 2, 0, 0, 0);
    
    const [option] = await db.insert(pollOptions).values({
      pollId: schedulePoll.id,
      text: `Termin ${i + 1}`,
      startTime: startTime,
      endTime: endTime,
      order: i,
    }).returning();
    scheduleOptionIds.push(option.id);
  }

  // Add sample votes for schedule poll
  const scheduleVoters = [
    { name: "Max Mustermann", email: "max@example.com", votes: [0, 1, 2] },
    { name: "Anna Schmidt", email: "anna@example.com", votes: [1, 3, 4] },
    { name: "Peter Müller", email: "peter@example.com", votes: [0, 2, 4] },
  ];

  for (const voter of scheduleVoters) {
    const voterKey = nanoid(8);
    for (const optionIndex of voter.votes) {
      await db.insert(votes).values({
        pollId: schedulePoll.id,
        optionId: scheduleOptionIds[optionIndex],
        voterName: voter.name,
        voterEmail: voter.email,
        voterKey: voterKey,
        response: Math.random() > 0.3 ? "yes" : "maybe",
      });
    }
  }

  // ============================================
  // Demo Poll 2: Survey Poll (Umfrage)
  // ============================================
  const surveyPublicToken = nanoid(12);
  const surveyAdminToken = nanoid(12);

  const [surveyPoll] = await db.insert(polls).values({
    title: "Lieblings-Programmiersprache 2025",
    description: "Welche Programmiersprache nutzt ihr am liebsten? Mehrfachauswahl möglich.",
    type: "survey",
    adminToken: surveyAdminToken,
    publicToken: surveyPublicToken,
    isActive: true,
    isAnonymous: false,
    allowAnonymousVoting: true,
    allowVoteEdit: true,
    allowMultipleSlots: true,
    resultsPublic: true,
    isTestData: true,
  }).returning();

  const surveyOptions = [
    "TypeScript",
    "Python",
    "Rust",
    "Go",
    "Java",
    "C#",
  ];

  const surveyOptionIds: number[] = [];
  for (let i = 0; i < surveyOptions.length; i++) {
    const [option] = await db.insert(pollOptions).values({
      pollId: surveyPoll.id,
      text: surveyOptions[i],
      order: i,
    }).returning();
    surveyOptionIds.push(option.id);
  }

  // Add sample votes for survey poll
  const surveyVoters = [
    { name: "Lisa Weber", email: "lisa@example.com", votes: [0, 1] },
    { name: "Tom Fischer", email: "tom@example.com", votes: [0, 2, 3] },
    { name: "Sarah Koch", email: "sarah@example.com", votes: [1, 4] },
    { name: "Michael Bauer", email: "michael@example.com", votes: [0] },
    { name: "Julia Hoffmann", email: "julia@example.com", votes: [2, 3] },
  ];

  for (const voter of surveyVoters) {
    const voterKey = nanoid(8);
    for (const optionIndex of voter.votes) {
      await db.insert(votes).values({
        pollId: surveyPoll.id,
        optionId: surveyOptionIds[optionIndex],
        voterName: voter.name,
        voterEmail: voter.email,
        voterKey: voterKey,
        response: "yes",
      });
    }
  }

  // ============================================
  // Demo Poll 3: Organization Poll (Orga-Liste)
  // ============================================
  const orgaPublicToken = nanoid(12);
  const orgaAdminToken = nanoid(12);

  const [orgaPoll] = await db.insert(polls).values({
    title: "Mitbringliste Team-Event",
    description: "Bitte tragt euch ein, was ihr zum Team-Event mitbringt. Pro Item ist die Anzahl der Plätze begrenzt.",
    type: "organization",
    adminToken: orgaAdminToken,
    publicToken: orgaPublicToken,
    isActive: true,
    isAnonymous: false,
    allowAnonymousVoting: true,
    allowVoteEdit: true,
    allowVoteWithdrawal: true,
    allowMultipleSlots: false,
    resultsPublic: true,
    isTestData: true,
    expiresAt: nextWeek,
  }).returning();

  const orgaOptions = [
    { text: "Salat", slots: 2 },
    { text: "Grillgut (Würstchen)", slots: 2 },
    { text: "Grillgut (Vegetarisch)", slots: 2 },
    { text: "Brot & Brötchen", slots: 2 },
    { text: "Getränke (Softdrinks)", slots: 2 },
    { text: "Getränke (Bier/Wein)", slots: 1 },
    { text: "Nachtisch/Kuchen", slots: 3 },
    { text: "Besteck & Geschirr", slots: 1 },
  ];

  const orgaOptionIds: number[] = [];
  for (let i = 0; i < orgaOptions.length; i++) {
    const [option] = await db.insert(pollOptions).values({
      pollId: orgaPoll.id,
      text: orgaOptions[i].text,
      maxCapacity: orgaOptions[i].slots,
      order: i,
    }).returning();
    orgaOptionIds.push(option.id);
  }

  // Add sample signups for orga poll
  const orgaSignups = [
    { name: "Karin Lehmann", email: "karin@example.com", option: 0 },
    { name: "Stefan Braun", email: "stefan@example.com", option: 1 },
    { name: "Monika Schulz", email: "monika@example.com", option: 2 },
    { name: "Frank Meyer", email: "frank@example.com", option: 4 },
    { name: "Claudia Werner", email: "claudia@example.com", option: 6 },
  ];

  for (const signup of orgaSignups) {
    await db.insert(votes).values({
      pollId: orgaPoll.id,
      optionId: orgaOptionIds[signup.option],
      voterName: signup.name,
      voterEmail: signup.email,
      voterKey: nanoid(8),
      response: "yes",
    });
  }

  // ============================================
  // Demo Poll 4: Anonymous Survey
  // ============================================
  const anonPublicToken = nanoid(12);
  const anonAdminToken = nanoid(12);

  const [anonPoll] = await db.insert(polls).values({
    title: "Arbeitsklima-Feedback (Anonym)",
    description: "Wie zufrieden seid ihr mit dem aktuellen Arbeitsklima? Diese Umfrage ist vollständig anonym.",
    type: "survey",
    adminToken: anonAdminToken,
    publicToken: anonPublicToken,
    isActive: true,
    isAnonymous: true,
    allowAnonymousVoting: true,
    allowVoteEdit: false,
    allowMultipleSlots: false,
    resultsPublic: false,
    isTestData: true,
  }).returning();

  const satisfactionOptions = [
    "Sehr zufrieden",
    "Zufrieden",
    "Neutral",
    "Unzufrieden",
    "Sehr unzufrieden",
  ];

  for (let i = 0; i < satisfactionOptions.length; i++) {
    await db.insert(pollOptions).values({
      pollId: anonPoll.id,
      text: satisfactionOptions[i],
      order: i,
    });
  }

  console.log("✅ Demo data created successfully!");
  console.log("");
  console.log("📋 Demo Polls (Public Links):");
  console.log(`   Terminumfrage:     /poll/${schedulePublicToken}`);
  console.log(`   Umfrage:           /poll/${surveyPublicToken}`);
  console.log(`   Orga-Liste:        /poll/${orgaPublicToken}`);
  console.log(`   Anonyme Umfrage:   /poll/${anonPublicToken}`);
  console.log("");
  console.log("🔑 Admin Links:");
  console.log(`   Terminumfrage:     /admin/${scheduleAdminToken}`);
  console.log(`   Umfrage:           /admin/${surveyAdminToken}`);
  console.log(`   Orga-Liste:        /admin/${orgaAdminToken}`);
  console.log(`   Anonyme Umfrage:   /admin/${anonAdminToken}`);
}

seedDemoData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
