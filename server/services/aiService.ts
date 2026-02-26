import OpenAI from "openai";
import { storage } from "../storage";
import { aiSettingsSchema, type AiSettings } from "@shared/schema";

let openaiClient: OpenAI | null = null;
let openaiClientFallback: OpenAI | null = null;

function getClient(fallback = false): OpenAI | null {
  const apiKey = fallback
    ? process.env.AI_API_KEY_FALLBACK
    : process.env.AI_API_KEY;
  if (!apiKey) return null;
  const baseURL =
    process.env.AI_API_URL || "https://saia.gwdg.de/v1";
  return new OpenAI({ apiKey, baseURL });
}

export async function getAiSettings(): Promise<AiSettings> {
  try {
    const setting = await storage.getSetting("ai_settings");
    if (setting?.value) {
      return aiSettingsSchema.parse(setting.value);
    }
  } catch (_) {}
  return aiSettingsSchema.parse({});
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  await storage.setSetting({ key: "ai_settings", value: settings });
}

export interface PollSuggestionSettings {
  resultsPublic?: boolean;
  allowVoteEdit?: boolean;
  allowVoteWithdrawal?: boolean;
  allowMaybe?: boolean;
  allowMultipleSlots?: boolean;
}

export interface PollSuggestion {
  title: string;
  description: string;
  options: string[];
  pollType: "schedule" | "survey" | "organization";
  settings?: PollSuggestionSettings;
}

const SYSTEM_PROMPT = `You are a helpful assistant for creating polls, surveys and organization lists.
The user will describe what they need, and you must respond ONLY with a valid JSON object.
Do NOT include any explanation or markdown — just the raw JSON.

Decide which poll type fits best:
- "schedule": finding a date/time (Terminumfrage) — when users want to coordinate meeting times, events, appointments
- "survey": collecting opinions/votes on topics (Umfrage) — when users want to ask questions or gather feedback
- "organization": sign-up sheets with time slots and capacity (Orga-Liste) — when users need helpers, volunteers, or slot booking

The JSON must have this exact structure:
{
  "pollType": "schedule" | "survey" | "organization",
  "title": "Title here",
  "description": "Helpful description of the purpose, max 200 characters",
  "options": ["Option 1", "Option 2", ...],
  "settings": {
    "resultsPublic": true or false,
    "allowVoteEdit": true or false,
    "allowVoteWithdrawal": true or false,
    "allowMaybe": true or false,
    "allowMultipleSlots": true or false
  }
}

Rules per poll type for the OPTIONS field:
- schedule: options must be date+time strings in EXACTLY this format: "DD.MM.YYYY HH:MM - HH:MM"
  Example: ["15.07.2026 09:00 - 10:00", "16.07.2026 14:00 - 15:30", "17.07.2026 10:00 - 11:00"]
  Use realistic future dates (within the next 2-4 weeks from today). Include 2-5 options.
- survey: options are answer choices, 2-8 options, concise and distinct
- organization: options are slot descriptions (e.g. "Aufbau 08:00 - 10:00", "Betreuung 10:00 - 14:00"), 2-8 slots

Rules for the SETTINGS field — you MUST decide based on context:

For SCHEDULE polls:
- resultsPublic: true (participants should see each other's availability)
- allowVoteEdit: true (people often need to change availability)
- allowVoteWithdrawal: true
- allowMaybe: true (common for schedule coordination)
- allowMultipleSlots: true

For ORGANIZATION polls:
- resultsPublic: true (participants MUST see who signed up for what slot — this is the whole point)
- allowVoteEdit: true (people may need to change slots)
- allowVoteWithdrawal: true (people may need to cancel)
- allowMaybe: false (not applicable for sign-up lists)
- allowMultipleSlots: false (usually one slot per person)

For SURVEY polls — decide based on sensitivity:
- SENSITIVE topics (keywords: satisfaction, Zufriedenheit, mood, Stimmung, feedback, Bewertung, evaluation, Beurteilung, salary, Gehalt, anonymous, anonym, team climate, Teamklima, confidential, vertraulich, well-being, Wohlbefinden, peer review, performance, opinion about people):
  - resultsPublic: false (participants should NOT see each other's answers — it would bias responses)
  - allowVoteEdit: false (anonymous answers should be final)
  - allowVoteWithdrawal: false
  - allowMaybe: false (use clear yes/no or rating scales)
- NEUTRAL topics (preferences, planning, choices, food, events, activities):
  - resultsPublic: true
  - allowVoteEdit: false
  - allowVoteWithdrawal: false
  - allowMaybe: true

General rules:
- title: short and clear, max 80 characters
- description: explain the purpose well so participants understand what they are voting on, max 200 characters
- Respond in the same language as the user's request (German if German, English if English)
- Today's date context: use plausible near-future dates for schedule options
- Always include the settings field with all relevant boolean values`;

export async function createPollFromDescription(
  description: string,
  language: string = "de"
): Promise<PollSuggestion> {
  const settings = await getAiSettings();

  if (!settings.enabled) {
    throw new Error("AI_DISABLED");
  }

  const model =
    process.env.AI_MODEL || settings.model || "llama-3.3-70b-instruct";

  const langHint =
    language === "de"
      ? "Please respond in German."
      : "Please respond in English.";

  const userMessage = `${description}\n\n${langHint}`;

  let client = openaiClient || getClient(false);
  openaiClient = client;

  if (!client) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const activeClient = attempt === 0 ? client : (openaiClientFallback || getClient(true));
      if (!activeClient) throw new Error("AI_NOT_CONFIGURED");
      if (attempt === 1) openaiClientFallback = activeClient;

      const response = await activeClient.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 600,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) throw new Error("AI_EMPTY_RESPONSE");

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI_INVALID_JSON");

      const parsed = JSON.parse(jsonMatch[0]) as PollSuggestion;

      if (!parsed.title || !Array.isArray(parsed.options) || parsed.options.length < 2) {
        throw new Error("AI_INVALID_STRUCTURE");
      }

      const validTypes = ["schedule", "survey", "organization"];
      const pollType = validTypes.includes(parsed.pollType) ? parsed.pollType : "survey";

      const rawSettings = parsed.settings as Record<string, unknown> | undefined;
      const resolvedSettings: PollSuggestionSettings = {};

      if (rawSettings && typeof rawSettings === "object") {
        if (typeof rawSettings.resultsPublic === "boolean") resolvedSettings.resultsPublic = rawSettings.resultsPublic;
        if (typeof rawSettings.allowVoteEdit === "boolean") resolvedSettings.allowVoteEdit = rawSettings.allowVoteEdit;
        if (typeof rawSettings.allowVoteWithdrawal === "boolean") resolvedSettings.allowVoteWithdrawal = rawSettings.allowVoteWithdrawal;
        if (typeof rawSettings.allowMaybe === "boolean") resolvedSettings.allowMaybe = rawSettings.allowMaybe;
        if (typeof rawSettings.allowMultipleSlots === "boolean") resolvedSettings.allowMultipleSlots = rawSettings.allowMultipleSlots;
      }

      return {
        pollType: pollType as PollSuggestion["pollType"],
        title: String(parsed.title).slice(0, 80),
        description: String(parsed.description || "").slice(0, 200),
        options: parsed.options.map((o) => String(o).slice(0, 120)).slice(0, 8),
        settings: resolvedSettings,
      };
    } catch (err: any) {
      lastError = err;
      const isRateLimit =
        err?.status === 429 ||
        err?.message?.includes("rate") ||
        err?.message?.includes("quota");
      if (isRateLimit && attempt === 0 && process.env.AI_API_KEY_FALLBACK) {
        console.warn("[AI] Primary key rate-limited, trying fallback key...");
        continue;
      }
      break;
    }
  }

  throw lastError || new Error("AI_REQUEST_FAILED");
}
