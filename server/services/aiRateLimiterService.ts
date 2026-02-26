import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { aiUsageLogs } from "@shared/schema";
import { and, gte, eq, isNull, sql } from "drizzle-orm";
import { getAiSettings } from "./aiService";

export interface AiRateLimitResult {
  allowed: boolean;
  remaining: number | null; // null = unlimited
  resetAt: Date | null;
  reason?: string;
}

export async function checkAiRateLimit(
  userId: number | null,
  role: "guest" | "user" | "admin",
  sessionId?: string
): Promise<AiRateLimitResult> {
  const settings = await getAiSettings();

  if (!settings.enabled) {
    return { allowed: false, remaining: 0, resetAt: null, reason: "AI_DISABLED" };
  }

  const limits =
    role === "admin"
      ? settings.adminLimits
      : role === "user"
      ? settings.userLimits
      : settings.guestLimits;

  if (!limits.enabled || limits.requestsPerHour === 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: null,
      reason: role === "guest" ? "GUEST_NOT_ALLOWED" : "ROLE_DISABLED",
    };
  }

  if (limits.requestsPerHour === null) {
    return { allowed: true, remaining: null, resetAt: null };
  }

  const windowStart = new Date(Date.now() - 60 * 60 * 1000);

  let countResult;
  if (userId !== null) {
    countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiUsageLogs)
      .where(
        and(
          eq(aiUsageLogs.userId, userId),
          gte(aiUsageLogs.createdAt, windowStart)
        )
      );
  } else if (sessionId) {
    countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiUsageLogs)
      .where(
        and(
          isNull(aiUsageLogs.userId),
          eq(aiUsageLogs.sessionId, sessionId),
          gte(aiUsageLogs.createdAt, windowStart)
        )
      );
  } else {
    return { allowed: false, remaining: 0, resetAt: null, reason: "NO_SESSION" };
  }

  const usedThisHour = countResult[0]?.count ?? 0;
  const limit = limits.requestsPerHour;
  const remaining = Math.max(0, limit - usedThisHour);

  if (usedThisHour >= limit) {
    const resetAt = new Date(Date.now() + 60 * 60 * 1000);
    return { allowed: false, remaining: 0, resetAt, reason: "RATE_LIMIT_EXCEEDED" };
  }

  return { allowed: true, remaining: remaining - 1, resetAt: null };
}

export async function logAiUsage(opts: {
  userId: number | null;
  sessionId?: string;
  endpoint: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  try {
    await db.insert(aiUsageLogs).values({
      userId: opts.userId ?? null,
      sessionId: opts.sessionId ?? null,
      endpoint: opts.endpoint,
      model: opts.model,
      promptTokens: opts.promptTokens ?? null,
      completionTokens: opts.completionTokens ?? null,
      success: opts.success,
      errorMessage: opts.errorMessage ?? null,
    });
  } catch (err) {
    console.error("[AI Rate Limiter] Failed to log usage:", err);
  }
}

export function aiRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const userId = (req.session as any)?.userId ?? null;
  const user = (req as any).user;
  const role: "guest" | "user" | "admin" =
    userId === null
      ? "guest"
      : user?.role === "admin"
      ? "admin"
      : "user";

  const sessionId =
    req.cookies?.["polly.sid"] ||
    req.headers["x-session-id"] as string ||
    req.ip ||
    "unknown";

  checkAiRateLimit(userId, role, sessionId)
    .then((result) => {
      if (!result.allowed) {
        const messages: Record<string, string> = {
          AI_DISABLED: "KI-Funktion ist deaktiviert",
          GUEST_NOT_ALLOWED: "Gäste können die KI-Funktion nicht nutzen. Bitte melden Sie sich an.",
          ROLE_DISABLED: "KI-Funktion ist für Ihre Rolle deaktiviert",
          RATE_LIMIT_EXCEEDED: "KI-Kontingent für diese Stunde aufgebraucht",
          NO_SESSION: "Keine gültige Session",
        };
        const message = messages[result.reason || ""] || "KI-Anfrage nicht erlaubt";
        res.status(429).json({
          error: message,
          reason: result.reason,
          resetAt: result.resetAt?.toISOString(),
        });
        return;
      }

      if (result.remaining !== null) {
        res.setHeader("X-AI-RateLimit-Remaining", result.remaining.toString());
      } else {
        res.setHeader("X-AI-RateLimit-Remaining", "unlimited");
      }

      (req as any).aiUserId = userId;
      (req as any).aiRole = role;
      (req as any).aiSessionId = sessionId;
      next();
    })
    .catch((err) => {
      console.error("[AI Rate Limiter] Error:", err);
      next();
    });
}
