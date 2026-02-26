import { Router } from "express";
import { requireAuth } from "./common";
import {
  createPollFromDescription,
  getAiSettings,
  saveAiSettings,
} from "../services/aiService";
import {
  aiRateLimitMiddleware,
  checkAiRateLimit,
  logAiUsage,
} from "../services/aiRateLimiterService";
import { aiSettingsSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

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
      apiConfigured: !!process.env.AI_API_KEY,
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

// POST /api/v1/ai/create-poll — rate-limited, creates poll suggestion from description
router.post("/create-poll", aiRateLimitMiddleware, async (req, res) => {
  const schema = z.object({
    description: z.string().min(5).max(500),
    language: z.enum(["de", "en"]).default("de"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Ungültige Eingabe", details: parsed.error.errors });
  }

  const { description, language } = parsed.data;
  const userId = (req as any).aiUserId ?? null;
  const sessionId = (req as any).aiSessionId ?? "unknown";
  const settings = await getAiSettings();
  const model = process.env.AI_MODEL || settings.model;

  try {
    const suggestion = await createPollFromDescription(description, language);

    await logAiUsage({
      userId,
      sessionId,
      endpoint: "create-poll",
      model,
      success: true,
    });

    res.json({ suggestion });
  } catch (err: any) {
    const errorCode = err?.message || "AI_REQUEST_FAILED";

    await logAiUsage({
      userId,
      sessionId,
      endpoint: "create-poll",
      model,
      success: false,
      errorMessage: errorCode,
    });

    const messages: Record<string, { status: number; message: string }> = {
      AI_DISABLED: { status: 503, message: "KI-Funktion ist deaktiviert" },
      AI_NOT_CONFIGURED: { status: 503, message: "KI-API nicht konfiguriert" },
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
    res.json({
      settings,
      apiConfigured: !!process.env.AI_API_KEY,
      fallbackConfigured: !!process.env.AI_API_KEY_FALLBACK,
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

    await saveAiSettings(parsed.data);
    res.json({ success: true, settings: parsed.data });
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
