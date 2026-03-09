import OpenAI from "openai";
import { storage } from "../storage";
import { aiSettingsSchema, type AiSettings } from "@shared/schema";

let openaiClient: OpenAI | null = null;
let openaiClientFallback: OpenAI | null = null;

export function getEffectiveApiKey(settings: AiSettings, fallback = false): string {
  if (fallback) {
    return process.env.AI_API_KEY_FALLBACK || settings.apiKeyFallback || '';
  }
  return process.env.AI_API_KEY || settings.apiKey || '';
}

export function getEffectiveApiUrl(settings: AiSettings): string {
  return process.env.AI_API_URL || settings.apiUrl || 'https://saia.gwdg.de/v1';
}

function getClient(fallback = false): OpenAI | null {
  const apiKey = fallback
    ? process.env.AI_API_KEY_FALLBACK
    : process.env.AI_API_KEY;
  if (!apiKey) return null;
  const baseURL =
    process.env.AI_API_URL || "https://saia.gwdg.de/v1";
  return new OpenAI({ apiKey, baseURL });
}

async function getClientWithDbFallback(fallback = false): Promise<OpenAI | null> {
  const settings = await getAiSettings();
  const apiKey = getEffectiveApiKey(settings, fallback);
  if (!apiKey) return null;
  const baseURL = getEffectiveApiUrl(settings);
  return new OpenAI({ apiKey, baseURL });
}

let aiSettingsCache: { value: AiSettings; expiresAt: number } | null = null;
const AI_SETTINGS_TTL_MS = 60_000;

export async function getAiSettings(): Promise<AiSettings> {
  if (aiSettingsCache && Date.now() < aiSettingsCache.expiresAt) {
    return aiSettingsCache.value;
  }
  try {
    const setting = await storage.getSetting("ai_settings");
    if (setting?.value) {
      const raw = setting.value as Record<string, unknown>;
      const parsed = aiSettingsSchema.parse(raw);
      const result = applyEnvAutoEnable(parsed, raw);
      aiSettingsCache = { value: result, expiresAt: Date.now() + AI_SETTINGS_TTL_MS };
      return result;
    }
  } catch (_) {}
  const defaults = applyEnvAutoEnable(aiSettingsSchema.parse({}), {});
  aiSettingsCache = { value: defaults, expiresAt: Date.now() + AI_SETTINGS_TTL_MS };
  return defaults;
}

function applyEnvAutoEnable(settings: AiSettings, rawDbValue: Record<string, unknown>): AiSettings {
  if (!process.env.AI_API_KEY) return settings;
  if (settings.enabled) return settings;
  const adminExplicitlySetEnabled = 'enabled' in rawDbValue && rawDbValue.enabled === false;
  if (adminExplicitlySetEnabled) return settings;
  return { ...settings, enabled: true };
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  aiSettingsCache = null;
  openaiClient = null;
  openaiClientFallback = null;
  await storage.setSetting({ key: "ai_settings", value: settings });
}

export interface PollSuggestionSettings {
  resultsPublic?: boolean;
  allowVoteEdit?: boolean;
  allowVoteWithdrawal?: boolean;
  allowMaybe?: boolean;
  allowMultipleSlots?: boolean;
}

export interface SurveyOption {
  text: string;
  isFreeText?: boolean;
}

export interface PollSuggestion {
  title: string;
  description: string;
  options: string[] | SurveyOption[];
  pollType: "schedule" | "survey" | "organization";
  settings?: PollSuggestionSettings;
}

function buildSystemPrompt(todayStr: string): string {
  return `You are a helpful assistant for creating polls, surveys and organization lists.
The user will describe what they need, and you must respond ONLY with a valid JSON object.
Do NOT include any explanation or markdown — just the raw JSON.

Today's date: ${todayStr}. Use this to calculate realistic future dates.

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
  Use realistic future dates (within the next 2-4 weeks from today: ${todayStr}).
  If the user specifies a count or lists specific dates, generate exactly that many. Otherwise, suggest 3-5 options.
- survey: TWO formats depending on context:
  (A) CHOICE questions (preferences, opinions, ratings, food, activities — "Lieblingsessen", "Welcher Tag passt?", etc.):
      options are plain strings: ["Option A", "Option B", "Option C"]
      Participants pick yes/no/maybe for each option.
      If the user specifies a count or lists specific choices, generate exactly that many. Otherwise, suggest 4-6 options.
  (B) OPEN-ENDED / FEEDBACK forms (collecting text responses, feelings, suggestions, contact info, evaluation — keywords: Feedback, Meinung, Gefühle, Bedürfnisse, Wünsche, Vorschläge, offene Fragen, freier Text, NVC, Kita, Schule, Eltern, Team-Klima, Rückmeldung, anonymous input, open question):
      options are objects with "isFreeText": true — each is an open question participants type an answer to.
      Format: [{"text": "Question here?", "isFreeText": true}, ...]
      Participants fill in free text for each. No yes/no/maybe buttons.
      Use this format when the request is about gathering written feedback, opinions in free form, or contact details.
      Example for a Kita feedback survey: [{"text": "Folgende Situation habe ich erlebt / wahrgenommen:", "isFreeText": true}, {"text": "Ich fühle mich dadurch:", "isFreeText": true}, {"text": "Mein Bedürfnis ist / Mir ist wichtig:", "isFreeText": true}, {"text": "Folgende Lösung würde ich mir wünschen:", "isFreeText": true}, {"text": "Name und Kontaktdaten (freiwillig):", "isFreeText": true}]
  You may also MIX both formats in one survey (some string options + some isFreeText objects) when appropriate.
- organization: TWO formats depending on context:
  (A) FIXED-DATE events (party, festival, Sommerfest, Sportfest, workshop, Tag der offenen Tür, Firmenevent, etc. — any event with an implied specific day):
      ALWAYS include the concrete event date in EVERY slot. Format: "DD.MM.YYYY Description HH:MM - HH:MM (max. N)"
      Choose a realistic future date based on context (e.g., Sommerfest → a Saturday in summer; workshop → next or following week).
      Example for a Sommerfest on 20.06.2026: ["20.06.2026 Aufbau 08:00 - 10:00 (max. 5)", "20.06.2026 Betreuung 10:00 - 14:00 (max. 3)", "20.06.2026 Abbau 14:00 - 16:00 (max. 4)"]
  (B) ONGOING / RECURRING sign-up lists WITHOUT a fixed date (cleaning rota, recurring duty schedule, etc.):
      Omit the date. Format: "Description HH:MM - HH:MM (max. N)"
      Example: ["Aufbau 08:00 - 10:00 (max. 5)", "Betreuung 10:00 - 14:00 (max. 3)", "Abbau 14:00 - 16:00"]
  Always include capacity (max. N) when context implies limited spots.
  If the user specifies a count or lists specific stations/tasks, generate exactly that many slots. Otherwise, suggest 5-8 slots.

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
- allowMultipleSlots: true (participants may want to sign up for multiple slots; set to false only if the user explicitly requests single-slot-only booking)

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
- Always include the settings field with all relevant boolean values`;
}

function buildRefinePrompt(todayStr: string): string {
  return `You are a helpful assistant for creating polls, surveys and organization lists.
The user already has a poll suggestion and wants to modify it.
You will receive the current suggestion as JSON and the user's requested change.
Respond ONLY with a valid JSON object in the exact same structure as the current suggestion — no explanation, no markdown.

Today's date: ${todayStr}. Use this to calculate realistic future dates.

Apply the user's requested change to the suggestion. You may:
- Change the poll type if the user explicitly asks for it
- Add, remove, or modify options
- Update the title or description
- Change the settings (resultsPublic, allowMaybe, etc.)
- Adjust dates/times if requested

Keep everything else the same unless the user asks to change it.
The JSON must follow this exact structure:
{
  "pollType": "schedule" | "survey" | "organization",
  "title": "Title here",
  "description": "Description here",
  "options": ["Option 1", "Option 2", ...],
  "settings": {
    "resultsPublic": true or false,
    "allowVoteEdit": true or false,
    "allowVoteWithdrawal": true or false,
    "allowMaybe": true or false,
    "allowMultipleSlots": true or false
  }
}

For schedule options, use EXACTLY this format: "DD.MM.YYYY HH:MM - HH:MM"
For organization options with a fixed event date, use: "DD.MM.YYYY Description HH:MM - HH:MM (max. N)"
For organization options without a fixed date, use: "Description HH:MM - HH:MM (max. N)"
For survey options: plain strings for choice questions, or objects {"text": "...", "isFreeText": true} for open-ended text questions. Keep the same format as the existing options unless the user explicitly asks to change the survey type.
If the user asks to add more items, add them freely — even if the total exceeds the initial count. If the user asks to remove items, remove them. Always honor the user's requested count exactly.
Respond in the same language as the user's refinement request.`;
}

export async function refinePollSuggestion(
  originalDescription: string,
  previousSuggestion: PollSuggestion,
  refinement: string,
  language: string = "de"
): Promise<PollSuggestion> {
  const settings = await getAiSettings();

  if (!settings.enabled) {
    throw new Error("AI_DISABLED");
  }

  const model =
    process.env.AI_MODEL || settings.model || "llama-3.3-70b-instruct";

  const todayStr = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  const langHint =
    language === "de"
      ? "Please respond in German."
      : "Please respond in English.";

  const userMessage = `Original request: "${originalDescription}"

Current suggestion:
${JSON.stringify(previousSuggestion, null, 2)}

User wants to change: "${refinement}"

${langHint}`;

  let client = openaiClient || await getClientWithDbFallback(false);
  openaiClient = client;

  if (!client) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const activeClient = attempt === 0 ? client : (openaiClientFallback || await getClientWithDbFallback(true));
      if (!activeClient) throw new Error("AI_NOT_CONFIGURED");
      if (attempt === 1) openaiClientFallback = activeClient;

      const response = await activeClient.chat.completions.create({
        model,
        messages: [
          { role: "system", content: buildRefinePrompt(todayStr) },
          { role: "user", content: userMessage },
        ],
        temperature: 0.5,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) throw new Error("AI_EMPTY_RESPONSE");

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI_INVALID_JSON");

      const parsed = JSON.parse(jsonMatch[0]) as PollSuggestion;

      if (!parsed.title || !Array.isArray(parsed.options) || parsed.options.length < 1) {
        throw new Error("AI_INVALID_STRUCTURE");
      }

      const validTypes = ["schedule", "survey", "organization"];
      const pollType = validTypes.includes(parsed.pollType) ? parsed.pollType : previousSuggestion.pollType;

      const rawSettings = parsed.settings as Record<string, unknown> | undefined;
      const resolvedSettings: PollSuggestionSettings = {};

      if (rawSettings && typeof rawSettings === "object") {
        if (typeof rawSettings.resultsPublic === "boolean") resolvedSettings.resultsPublic = rawSettings.resultsPublic;
        if (typeof rawSettings.allowVoteEdit === "boolean") resolvedSettings.allowVoteEdit = rawSettings.allowVoteEdit;
        if (typeof rawSettings.allowVoteWithdrawal === "boolean") resolvedSettings.allowVoteWithdrawal = rawSettings.allowVoteWithdrawal;
        if (typeof rawSettings.allowMaybe === "boolean") resolvedSettings.allowMaybe = rawSettings.allowMaybe;
        if (typeof rawSettings.allowMultipleSlots === "boolean") resolvedSettings.allowMultipleSlots = rawSettings.allowMultipleSlots;
      }

      const normalizeOptions = (opts: any[]): (string | SurveyOption)[] =>
        opts.map((o) => {
          if (typeof o === "string") return o.slice(0, 120);
          if (o && typeof o === "object" && typeof o.text === "string") {
            return { text: o.text.slice(0, 120), isFreeText: !!o.isFreeText };
          }
          return String(o).slice(0, 120);
        }).slice(0, 50);

      return {
        pollType: pollType as PollSuggestion["pollType"],
        title: String(parsed.title).slice(0, 80),
        description: String(parsed.description || "").slice(0, 200),
        options: normalizeOptions(parsed.options as any[]),
        settings: resolvedSettings,
      };
    } catch (err: any) {
      lastError = err;
      if (err?.status === 503) {
        console.warn("[AI] Model not loaded (503), not retrying.");
        throw new Error("AI_MODEL_LOADING");
      }
      const isRateLimit =
        err?.status === 429 ||
        err?.message?.includes("rate") ||
        err?.message?.includes("quota");
      const fallbackSettings = await getAiSettings();
      if (isRateLimit && attempt === 0 && getEffectiveApiKey(fallbackSettings, true)) {
        console.warn("[AI] Primary key rate-limited, trying fallback key...");
        continue;
      }
      break;
    }
  }

  throw lastError || new Error("AI_REQUEST_FAILED");
}

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

  const todayStr = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  const langHint =
    language === "de"
      ? "Please respond in German."
      : "Please respond in English.";

  const userMessage = `${description}\n\n${langHint}`;

  let client = openaiClient || await getClientWithDbFallback(false);
  openaiClient = client;

  if (!client) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const activeClient = attempt === 0 ? client : (openaiClientFallback || await getClientWithDbFallback(true));
      if (!activeClient) throw new Error("AI_NOT_CONFIGURED");
      if (attempt === 1) openaiClientFallback = activeClient;

      const response = await activeClient.chat.completions.create({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt(todayStr) },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 2000,
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

      const normalizeOpts = (opts: any[]): (string | SurveyOption)[] =>
        opts.map((o) => {
          if (typeof o === "string") return o.slice(0, 120);
          if (o && typeof o === "object" && typeof o.text === "string") {
            return { text: o.text.slice(0, 120), isFreeText: !!o.isFreeText };
          }
          return String(o).slice(0, 120);
        }).slice(0, 50);

      return {
        pollType: pollType as PollSuggestion["pollType"],
        title: String(parsed.title).slice(0, 80),
        description: String(parsed.description || "").slice(0, 200),
        options: normalizeOpts(parsed.options as any[]),
        settings: resolvedSettings,
      };
    } catch (err: any) {
      lastError = err;
      if (err?.status === 503) {
        console.warn("[AI] Model not loaded (503), not retrying.");
        throw new Error("AI_MODEL_LOADING");
      }
      const isRateLimit =
        err?.status === 429 ||
        err?.message?.includes("rate") ||
        err?.message?.includes("quota");
      const fallbackSettings2 = await getAiSettings();
      if (isRateLimit && attempt === 0 && getEffectiveApiKey(fallbackSettings2, true)) {
        console.warn("[AI] Primary key rate-limited, trying fallback key...");
        continue;
      }
      break;
    }
  }

  throw lastError || new Error("AI_REQUEST_FAILED");
}
