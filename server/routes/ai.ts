import { Router } from "express";
import { requireAuth } from "./common";
import {
  createPollFromDescription,
  refinePollSuggestion,
  getAiSettings,
  saveAiSettings,
  getEffectiveApiKey,
  getEffectiveApiUrl,
} from "../services/aiService";
import {
  aiRateLimitMiddleware,
  checkAiRateLimit,
  logAiUsage,
} from "../services/aiRateLimiterService";
import { transcribeLargeFile } from "../services/whisperService";
import { aiSettingsSchema } from "@shared/schema";
import { z } from "zod";
import { storage } from "../storage";
import { emailService } from "../services/emailService";
import { pollCreationRateLimiter } from "../services/apiRateLimiterService";
import multer from "multer";

const router = Router();

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

// POST /api/v1/ai/transcribe — Audio → Text via GWDG Whisper
router.post("/transcribe", audioUpload.single("audio"), async (req, res) => {
  try {
    const transcribeSettings = await getAiSettings();
    if (!getEffectiveApiKey(transcribeSettings)) {
      return res.status(503).json({ success: false, error: "AI API nicht konfiguriert" });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: "Keine Audiodatei gefunden" });
    }

    const language = typeof req.body.language === "string" ? req.body.language : undefined;
    const mimeType = file.mimetype || "audio/webm";

    console.log(`[Transcribe] ${file.originalname}, ${(file.size / 1024 / 1024).toFixed(2)} MB, ${mimeType}`);

    const result = await transcribeLargeFile(file.buffer, mimeType, language);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    return res.json({ success: true, text: result.text, language: result.language });
  } catch (error) {
    console.error("[Transcribe] Error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unbekannter Fehler",
    });
  }
});

// GET /api/v1/ai/status — public (shows enabled state + quota for current user)
router.get("/status", async (req, res) => {
  try {
    const settings = await getAiSettings();
    const userId = (req.session as any)?.userId ?? null;
    const role: "guest" | "user" | "admin" =
      userId === null ? "guest" : "user";
    const sessionId =
      req.cookies?.["polly.sid"] ||
      (req.headers["x-session-id"] as string) ||
      req.ip ||
      "unknown";

    const rateCheck = await checkAiRateLimit(userId, role, sessionId);

    res.json({
      enabled: settings.enabled,
      apiConfigured: !!getEffectiveApiKey(settings),
      model: settings.model,
      canUse: rateCheck.allowed,
      remaining: rateCheck.remaining,
      reason: rateCheck.reason,
      resetAt: rateCheck.resetAt?.toISOString() ?? null,
      limits: {
        guest: settings.guestLimits,
        user: settings.userLimits,
        admin: settings.adminLimits,
      },
    });
  } catch (err) {
    console.error("[AI] Status error:", err);
    res.status(500).json({ error: "Interner Fehler" });
  }
});

// POST /api/v1/ai/create-poll — rate-limited, creates or refines poll suggestion
router.post("/create-poll", aiRateLimitMiddleware, async (req, res) => {
  const schema = z.object({
    description: z.string().min(5).max(10000),
    language: z.enum(["de", "en"]).default("de"),
    refinement: z.string().min(3).max(3000).optional(),
    previousSuggestion: z.object({
      pollType: z.enum(["schedule", "survey", "organization"]),
      title: z.string(),
      description: z.string(),
      options: z.array(z.union([z.string(), z.object({ text: z.string(), isFreeText: z.boolean().optional() })])),
      settings: z.record(z.boolean()).optional(),
    }).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Ungültige Eingabe", details: parsed.error.errors });
  }

  const { description, language, refinement, previousSuggestion } = parsed.data;
  const userId = (req as any).aiUserId ?? null;
  const sessionId = (req as any).aiSessionId ?? "unknown";
  const settings = await getAiSettings();
  const model = process.env.AI_MODEL || settings.model;
  const isRefinement = !!(refinement && previousSuggestion);

  try {
    const suggestion = isRefinement
      ? await refinePollSuggestion(description, previousSuggestion as any, refinement!, language)
      : await createPollFromDescription(description, language);

    await logAiUsage({
      userId,
      sessionId,
      endpoint: isRefinement ? "refine-poll" : "create-poll",
      model,
      success: true,
    });

    res.json({ suggestion });
  } catch (err: any) {
    const errorCode = err?.message || "AI_REQUEST_FAILED";

    await logAiUsage({
      userId,
      sessionId,
      endpoint: isRefinement ? "refine-poll" : "create-poll",
      model,
      success: false,
      errorMessage: errorCode,
    });

    const messages: Record<string, { status: number; message: string }> = {
      AI_DISABLED: { status: 503, message: "KI-Funktion ist deaktiviert" },
      AI_NOT_CONFIGURED: { status: 503, message: "KI-API nicht konfiguriert" },
      AI_MODEL_LOADING: { status: 503, message: "Das KI-Modell wird gerade gestartet. Bitte in einer Minute erneut versuchen." },
      AI_EMPTY_RESPONSE: { status: 502, message: "Keine Antwort von der KI erhalten" },
      AI_INVALID_JSON: { status: 502, message: "Ungültige Antwort der KI" },
      AI_INVALID_STRUCTURE: { status: 502, message: "KI-Antwort hat unerwartetes Format" },
      AI_REQUEST_FAILED: { status: 502, message: "KI-Anfrage fehlgeschlagen" },
    };

    const mapped = messages[errorCode] || { status: 500, message: "Interner Fehler" };
    console.error("[AI] create-poll error:", errorCode, err);
    res.status(mapped.status).json({ error: mapped.message, code: errorCode });
  }
});

// POST /api/v1/ai/apply — create a poll directly from an AI suggestion
router.post("/apply", pollCreationRateLimiter, async (req, res) => {
  const settingsSchema = z.object({
    resultsPublic: z.boolean().optional(),
    allowVoteEdit: z.boolean().optional(),
    allowVoteWithdrawal: z.boolean().optional(),
    allowMaybe: z.boolean().optional(),
    allowMultipleSlots: z.boolean().optional(),
  });

  const schema = z.object({
    suggestion: z.object({
      pollType: z.enum(["schedule", "survey", "organization"]),
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      options: z.array(z.union([z.string().min(1), z.object({ text: z.string().min(1), isFreeText: z.boolean().optional() })])).min(1),
      settings: settingsSchema.optional(),
    }),
    settings: settingsSchema,
    creatorEmail: z.string().email().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.errors });
  }

  const { suggestion, settings, creatorEmail: bodyEmail } = parsed.data;

  let userId: number | null = null;
  let creatorEmail: string | null = null;

  if ((req.session as any)?.userId) {
    const sessionUser = await storage.getUser((req.session as any).userId);
    if (!sessionUser) return res.status(401).json({ error: "Ungültige Session" });
    userId = sessionUser.id;
    creatorEmail = sessionUser.email;
  } else {
    creatorEmail = bodyEmail || null;
    if (creatorEmail) {
      const registeredUser = await storage.getUserByEmail(creatorEmail.toLowerCase().trim());
      if (registeredUser) {
        return res.status(409).json({
          error: "Diese E-Mail-Adresse gehört zu einem registrierten Konto. Bitte melden Sie sich an.",
          errorCode: "REQUIRES_LOGIN",
        });
      }
    }
  }

  // Transform options per poll type
  const transformedOptions = suggestion.options.map((rawOpt, index) => {
    const opt = typeof rawOpt === 'string' ? rawOpt : (rawOpt as any).text || String(rawOpt);
    if (suggestion.pollType === "schedule") {
      const match = opt.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
      if (match) {
        const [, day, month, year, startH, endH] = match;
        const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const startTime = new Date(d.toDateString() + " " + startH);
        const endTime = new Date(d.toDateString() + " " + endH);
        return {
          text: opt,
          startTime: isNaN(startTime.getTime()) ? null : startTime,
          endTime: isNaN(endTime.getTime()) ? null : endTime,
          maxCapacity: null,
          order: index,
          pollId: "",
        };
      }
      return { text: opt, startTime: null, endTime: null, maxCapacity: null, order: index, pollId: "" };
    }

    if (suggestion.pollType === "organization") {
      const timeMatch = opt.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
      const capMatch = opt.match(/\(max\.?\s*(\d+)/i);
      let cleanText = opt;
      if (timeMatch) {
        const timeIndex = opt.indexOf(timeMatch[0]);
        const before = opt.substring(0, timeIndex).trim();
        cleanText = before || opt;
      }
      cleanText = cleanText.replace(/\(max\.?\s*\d+[^)]*\)/gi, "").trim() || opt;
      return {
        text: cleanText,
        startTime: null,
        endTime: null,
        maxCapacity: capMatch ? parseInt(capMatch[1]) : null,
        order: index,
        pollId: "",
      };
    }

    return { text: opt, startTime: null, endTime: null, maxCapacity: null, order: index, pollId: "" };
  });

  // Merge settings: AI defaults overridden by user toggles
  const finalSettings = { ...suggestion.settings, ...settings };

  const pollData = {
    title: suggestion.title,
    description: suggestion.description || "",
    type: suggestion.pollType,
    userId,
    creatorEmail,
    expiresAt: undefined,
    enableExpiryReminder: false,
    expiryReminderHours: 24,
    allowMultipleSlots: finalSettings.allowMultipleSlots ?? (suggestion.pollType === "organization" ? false : true),
    allowVoteEdit: finalSettings.allowVoteEdit ?? false,
    allowVoteWithdrawal: finalSettings.allowVoteWithdrawal ?? false,
    resultsPublic: finalSettings.resultsPublic ?? true,
    isTestData: (req as any).isTestMode === true,
  };

  try {
    const result = await storage.createPoll(pollData, transformedOptions as any);

    if (creatorEmail) {
      const { getBaseUrl } = await import("../utils/baseUrl");
      const baseUrl = getBaseUrl();
      const publicLink = `${baseUrl}/poll/${result.poll.publicToken}`;
      const adminLink = `${baseUrl}/admin/${result.poll.adminToken}`;
      await emailService.sendPollCreationEmails(
        creatorEmail,
        suggestion.title,
        publicLink,
        adminLink,
        suggestion.pollType
      );
    }

    res.json({
      poll: { ...result.poll, options: result.options },
      publicToken: result.publicToken,
      adminToken: result.adminToken,
    });
  } catch (err) {
    console.error("[AI] apply error:", err);
    res.status(500).json({ error: "Fehler beim Erstellen der Umfrage" });
  }
});

// GET /api/v1/admin/ai/settings — admin only
router.get("/admin/settings", requireAuth, async (req, res) => {
  try {
    const user = await import("../storage").then((m) =>
      m.storage.getUser((req.session as any).userId)
    );
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Nur für Administratoren" });
    }

    const settings = await getAiSettings();
    const safeSettings = { ...settings, apiKey: undefined, apiKeyFallback: undefined };
    res.json({
      settings: safeSettings,
      apiConfigured: !!getEffectiveApiKey(settings),
      fallbackConfigured: !!(process.env.AI_API_KEY_FALLBACK || settings.apiKeyFallback),
      hasApiKey: !!settings.apiKey,
      hasApiKeyFallback: !!settings.apiKeyFallback,
      apiKeyViaEnv: !!process.env.AI_API_KEY,
      apiKeyFallbackViaEnv: !!process.env.AI_API_KEY_FALLBACK,
      apiUrlViaEnv: !!process.env.AI_API_URL,
      envModel: process.env.AI_MODEL || null,
      envApiUrl: process.env.AI_API_URL || null,
    });
  } catch (err) {
    console.error("[AI] Admin settings GET error:", err);
    res.status(500).json({ error: "Interner Fehler" });
  }
});

// PUT /api/v1/admin/ai/settings — admin only
router.put("/admin/settings", requireAuth, async (req, res) => {
  try {
    const user = await import("../storage").then((m) =>
      m.storage.getUser((req.session as any).userId)
    );
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Nur für Administratoren" });
    }

    const parsed = aiSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Ungültige Einstellungen", details: parsed.error.errors });
    }

    const existing = await getAiSettings();
    const toSave = { ...parsed.data };
    if (toSave.apiKey === "__CLEAR__") {
      toSave.apiKey = "";
    } else if (!toSave.apiKey && existing.apiKey) {
      toSave.apiKey = existing.apiKey;
    }
    if (toSave.apiKeyFallback === "__CLEAR__") {
      toSave.apiKeyFallback = "";
    } else if (!toSave.apiKeyFallback && existing.apiKeyFallback) {
      toSave.apiKeyFallback = existing.apiKeyFallback;
    }

    await saveAiSettings(toSave);
    const safeResponse = { ...toSave, apiKey: undefined, apiKeyFallback: undefined };
    res.json({ success: true, settings: safeResponse });
  } catch (err) {
    console.error("[AI] Admin settings PUT error:", err);
    res.status(500).json({ error: "Interner Fehler" });
  }
});

// GET /api/v1/admin/ai/usage — admin only, last 24h usage stats
router.get("/admin/usage", requireAuth, async (req, res) => {
  try {
    const user = await import("../storage").then((m) =>
      m.storage.getUser((req.session as any).userId)
    );
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Nur für Administratoren" });
    }

    const { db } = await import("../db");
    const { aiUsageLogs } = await import("@shared/schema");
    const { gte, sql } = await import("drizzle-orm");

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logs = await db
      .select()
      .from(aiUsageLogs)
      .where(gte(aiUsageLogs.createdAt, since24h))
      .orderBy(aiUsageLogs.createdAt);

    const total = logs.length;
    const successful = logs.filter((l) => l.success).length;
    const failed = total - successful;
    const uniqueUsers = new Set(logs.map((l) => l.userId).filter(Boolean)).size;
    const uniqueGuests = new Set(logs.map((l) => (!l.userId ? l.sessionId : null)).filter(Boolean)).size;

    res.json({
      total,
      successful,
      failed,
      uniqueUsers,
      uniqueGuests,
      logs: logs.slice(-50), // last 50 entries
    });
  } catch (err) {
    console.error("[AI] Admin usage GET error:", err);
    res.status(500).json({ error: "Interner Fehler" });
  }
});

export default router;
