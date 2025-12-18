/**
 * KITA Poll - Demo Data Seeder
 * Creates sample polls for quick evaluation and testing
 */

import { db } from "./db";
import { polls, pollOptions } from "@shared/schema";
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

  // Demo Poll 1: Schedule Poll (Terminumfrage)
  const schedulePublicToken = nanoid(12);
  const scheduleAdminToken = nanoid(12);

  const [schedulePoll] = await db.insert(polls).values({
    title: "Elternabend - Terminabstimmung",
    description: "Bitte wählen Sie Ihre verfügbaren Termine für den kommenden Elternabend.",
    type: "schedule",
    adminToken: scheduleAdminToken,
    publicToken: schedulePublicToken,
    isActive: true,
    isAnonymous: false,
    allowAnonymousVoting: true,
  }).returning();

  // Schedule poll options (dates)
  const scheduleDates = [
    new Date(nextWeek.getTime()),
    new Date(nextWeek.getTime() + 2 * 24 * 60 * 60 * 1000),
    new Date(nextWeek.getTime() + 4 * 24 * 60 * 60 * 1000),
  ];

  for (let i = 0; i < scheduleDates.length; i++) {
    const startTime = new Date(scheduleDates[i]);
    startTime.setHours(18, 0, 0, 0);
    const endTime = new Date(scheduleDates[i]);
    endTime.setHours(20, 0, 0, 0);
    
    await db.insert(pollOptions).values({
      pollId: schedulePoll.id,
      text: `Option ${i + 1}`,
      startTime: startTime,
      endTime: endTime,
      order: i,
    });
  }

  // Demo Poll 2: Survey Poll (Umfrage)
  const surveyPublicToken = nanoid(12);
  const surveyAdminToken = nanoid(12);

  const [surveyPoll] = await db.insert(polls).values({
    title: "Ausflugsziel für den Sommertag",
    description: "Wohin soll unser Sommerausflug dieses Jahr gehen?",
    type: "survey",
    adminToken: surveyAdminToken,
    publicToken: surveyPublicToken,
    isActive: true,
    isAnonymous: false,
    allowAnonymousVoting: true,
  }).returning();

  const surveyOptions = [
    "Tierpark Hellabrunn",
    "Botanischer Garten",
    "Olympiapark",
    "Englischer Garten Picknick",
  ];

  for (let i = 0; i < surveyOptions.length; i++) {
    await db.insert(pollOptions).values({
      pollId: surveyPoll.id,
      text: surveyOptions[i],
      order: i,
    });
  }

  // Demo Poll 3: Organization Poll (Orga-Liste)
  const orgaPublicToken = nanoid(12);
  const orgaAdminToken = nanoid(12);

  const [orgaPoll] = await db.insert(polls).values({
    title: "Kuchenspenden Sommerfest",
    description: "Bitte tragen Sie sich für eine Kuchenspende ein. Pro Kuchen maximal 2 Anmeldungen.",
    type: "organization",
    adminToken: orgaAdminToken,
    publicToken: orgaPublicToken,
    isActive: true,
    isAnonymous: false,
    allowAnonymousVoting: true,
    allowMultipleSlots: false,
  }).returning();

  const orgaOptions = [
    { text: "Schokoladenkuchen", slots: 2 },
    { text: "Obstkuchen", slots: 2 },
    { text: "Käsekuchen", slots: 2 },
    { text: "Marmorkuchen", slots: 2 },
    { text: "Muffins (12 Stück)", slots: 3 },
  ];

  for (let i = 0; i < orgaOptions.length; i++) {
    await db.insert(pollOptions).values({
      pollId: orgaPoll.id,
      text: orgaOptions[i].text,
      maxCapacity: orgaOptions[i].slots,
      order: i,
    });
  }

  console.log("✅ Demo data created successfully!");
  console.log("");
  console.log("📋 Demo Polls (Public Links):");
  console.log(`   Terminumfrage: /poll/${schedulePublicToken}`);
  console.log(`   Umfrage:       /poll/${surveyPublicToken}`);
  console.log(`   Orga-Liste:    /poll/${orgaPublicToken}`);
  console.log("");
  console.log("🔑 Admin Links:");
  console.log(`   Terminumfrage: /poll/${scheduleAdminToken}`);
  console.log(`   Umfrage:       /poll/${surveyAdminToken}`);
  console.log(`   Orga-Liste:    /poll/${orgaAdminToken}`);
}

seedDemoData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
