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

export interface PollSuggestion {
  title: string;
  description: string;
  options: string[];
}

const SYSTEM_PROMPT = `You are a helpful assistant for creating polls and surveys. 
The user will describe what kind of poll they want, and you must respond ONLY with a valid JSON object.
Do NOT include any explanation or markdown — just the raw JSON.
The JSON must have this exact structure:
{
  "title": "Poll title here",
  "description": "Brief description here",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
}
Rules:
- title: short, clear, max 80 characters
- description: optional context, max 200 characters, can be empty string
- options: 2-8 options, concise and distinct
- Respond in the same language as the user's request (German if German, English if English)`;

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
        max_tokens: 512,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) throw new Error("AI_EMPTY_RESPONSE");

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI_INVALID_JSON");

      const parsed = JSON.parse(jsonMatch[0]) as PollSuggestion;

      if (!parsed.title || !Array.isArray(parsed.options) || parsed.options.length < 2) {
        throw new Error("AI_INVALID_STRUCTURE");
      }

      return {
        title: String(parsed.title).slice(0, 80),
        description: String(parsed.description || "").slice(0, 200),
        options: parsed.options.map((o) => String(o).slice(0, 100)).slice(0, 8),
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
