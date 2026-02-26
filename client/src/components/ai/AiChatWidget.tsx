import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mic, ArrowRight, Sparkles, Loader2, Calendar, Vote, ClipboardList, CheckCircle, RefreshCw, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AiStatus {
  enabled: boolean;
  apiConfigured: boolean;
  canUse: boolean;
  remaining: number | null;
  reason?: string;
  resetAt?: string;
}

interface PollSuggestion {
  title: string;
  description: string;
  options: string[];
}

type PollType = "schedule" | "survey" | "organization";

const TABS: { id: PollType; labelKey: string; icon: typeof Calendar; colorClass: string; href: string }[] = [
  { id: "schedule", labelKey: "home.findDate", icon: Calendar, colorClass: "schedule", href: "/create-poll" },
  { id: "survey", labelKey: "home.createSurvey", icon: Vote, colorClass: "survey", href: "/create-survey" },
  { id: "organization", labelKey: "home.createOrg", icon: ClipboardList, colorClass: "organization", href: "/create-organization" },
];

const PROMPTS_DE = [
  "Möchtest du ein Sommerfest planen und die Organisation für die Helfer bereitstellen?",
  "Soll ich dir helfen, einen Elternabend-Termin zu koordinieren?",
  "Planst du eine Teambesprechung und suchst den besten Termin für alle?",
  "Möchtest du eine Zufriedenheitsumfrage für dein Team erstellen?",
  "Soll ich eine Mittagspausen-Einteilung für deine Gruppe organisieren?",
];

const PROMPTS_EN = [
  "Do you want to plan a summer party and organize helpers?",
  "Shall I help you coordinate a parent-teacher meeting?",
  "Planning a team meeting and looking for the best time slot for everyone?",
  "Would you like to create a satisfaction survey for your team?",
  "Shall I set up a lunch break schedule for your group?",
];

const TYPE_SPEED = 40;
const ERASE_SPEED = 20;
const PAUSE_AFTER_TYPE = 2200;
const PAUSE_AFTER_ERASE = 400;

function useTypewriter(lines: string[], paused: boolean) {
  const [display, setDisplay] = useState("");
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [erasing, setErasing] = useState(false);
  const [pausePhase, setPausePhase] = useState<"none" | "after-type" | "after-erase">("none");

  useEffect(() => {
    if (paused || lines.length === 0) return;

    if (pausePhase === "after-type") {
      const t = setTimeout(() => { setErasing(true); setPausePhase("none"); }, PAUSE_AFTER_TYPE);
      return () => clearTimeout(t);
    }
    if (pausePhase === "after-erase") {
      const t = setTimeout(() => {
        setLineIdx((i) => (i + 1) % lines.length);
        setCharIdx(0);
        setPausePhase("none");
      }, PAUSE_AFTER_ERASE);
      return () => clearTimeout(t);
    }

    if (!erasing) {
      const target = lines[lineIdx];
      if (charIdx < target.length) {
        const t = setTimeout(() => {
          setDisplay(target.slice(0, charIdx + 1));
          setCharIdx((c) => c + 1);
        }, TYPE_SPEED);
        return () => clearTimeout(t);
      } else {
        setPausePhase("after-type");
      }
    } else {
      if (display.length > 0) {
        const t = setTimeout(() => {
          setDisplay((d) => d.slice(0, -1));
        }, ERASE_SPEED);
        return () => clearTimeout(t);
      } else {
        setErasing(false);
        setPausePhase("after-erase");
      }
    }
  }, [paused, lines, lineIdx, charIdx, erasing, pausePhase, display]);

  const currentFull = lines[lineIdx] ?? "";
  return { display, currentFull };
}

export function AiChatWidget() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<PollType>("schedule");
  const [inputValue, setInputValue] = useState("");
  const [suggestion, setSuggestion] = useState<PollSuggestion | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isFilled = inputValue.trim().length > 0;

  const lang = i18n.language?.startsWith("de") ? "de" : "en";
  const prompts = lang === "de" ? PROMPTS_DE : PROMPTS_EN;

  const { display: placeholderDisplay, currentFull } = useTypewriter(prompts, isFilled);

  const { data: status } = useQuery<AiStatus>({
    queryKey: ["/api/v1/ai/status"],
    refetchInterval: false,
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab" && !isFilled && currentFull) {
        e.preventDefault();
        setInputValue(currentFull);
      }
    },
    [isFilled, currentFull]
  );

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/v1/ai/create-poll", {
        description: inputValue,
        language: lang,
      }),
    onSuccess: async (res) => {
      const data = await res.json();
      setSuggestion(data.suggestion);
    },
    onError: async () => {
      setSuggestion(null);
    },
  });

  const handleSubmit = () => {
    if (!inputValue.trim() || inputValue.trim().length < 5) return;
    setSuggestion(null);
    mutation.mutate();
  };

  const handleApply = () => {
    if (!suggestion) return;
    const tab = TABS.find((t) => t.id === activeTab);
    const params = new URLSearchParams({
      aiTitle: suggestion.title,
      aiDescription: suggestion.description,
      aiOptions: JSON.stringify(suggestion.options),
    });
    setLocation(`${tab?.href ?? "/create-poll"}?${params.toString()}`);
  };

  const handleKeySubmit = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!status?.enabled || !status?.apiConfigured) return null;

  const activeTabData = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="text-sm text-muted-foreground">{t("home.aiChatHint")}</span>
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
        >
          Beta
        </Badge>
      </div>

      <div className="rounded-2xl border-2 border-primary/30 bg-card shadow-lg overflow-hidden focus-within:border-primary/60 transition-colors duration-200">
        {/* Tabs */}
        <div className="flex border-b border-border/60">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? `bg-${tab.colorClass}/10 text-${tab.colorClass} border-b-2 border-${tab.colorClass}`
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setSuggestion(null);
            }}
            onKeyDown={(e) => {
              handleKeyDown(e);
              handleKeySubmit(e);
            }}
            rows={3}
            className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm text-foreground placeholder-transparent focus:outline-none"
            style={{ minHeight: "88px" }}
            disabled={mutation.isPending}
          />
          {!isFilled && (
            <div
              className="pointer-events-none absolute top-4 left-4 right-4 text-sm text-muted-foreground/60 select-none"
              aria-hidden="true"
            >
              {placeholderDisplay}
              <span className="animate-pulse">|</span>
              {currentFull && (
                <span className="ml-2 text-xs text-primary/40 hidden sm:inline">
                  Tab zum Übernehmen
                </span>
              )}
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-muted/20">
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-muted-foreground/50 text-xs cursor-not-allowed select-none"
                  >
                    <Mic className="w-4 h-4" />
                    <span className="hidden sm:inline">Sprache</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{t("home.aiMicTooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center gap-2">
            {!status.canUse && status.reason && (
              <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-500" />
                {status.reason === "GUEST_NOT_ALLOWED"
                  ? t("home.aiLoginRequired")
                  : t("home.aiLimitReached")}
              </span>
            )}
            {status.canUse && status.remaining !== null && status.remaining !== undefined && (
              <span className="text-xs text-muted-foreground">
                {status.remaining} {t("home.aiRemaining")}
              </span>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={!status.canUse || !isFilled || inputValue.trim().length < 5 || mutation.isPending}
              className="gap-1.5 h-8 px-3"
            >
              {mutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{mutation.isPending ? t("home.aiGenerating") : t("home.aiStart")}</span>
              {!mutation.isPending && <ArrowRight className="w-3 h-3" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Suggestion result */}
      {suggestion && (
        <div className="mt-3 rounded-xl border border-border bg-card/80 p-4 space-y-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              {t("home.aiSuggestion")}
            </div>
            <button
              type="button"
              onClick={() => { setSuggestion(null); mutation.mutate(); }}
              disabled={mutation.isPending}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              {t("home.aiRegenerate")}
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{t("home.aiTitle")}</p>
              <p className="text-sm font-semibold">{suggestion.title}</p>
            </div>
            {suggestion.description && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">{t("home.aiDescription")}</p>
                <p className="text-sm text-muted-foreground">{suggestion.description}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {t("home.aiOptions")} ({suggestion.options.length})
              </p>
              <ul className="space-y-1">
                {suggestion.options.map((opt, i) => (
                  <li key={i} className="text-sm flex items-start gap-1.5">
                    <span className="text-muted-foreground text-xs mt-0.5 shrink-0">{i + 1}.</span>
                    {opt}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Button onClick={handleApply} className="w-full gap-2" size="sm">
            <CheckCircle className="w-4 h-4" />
            {t("home.aiApply")} → {t(activeTabData.labelKey)}
          </Button>
        </div>
      )}

      {mutation.isError && !suggestion && (
        <p className="mt-2 text-center text-xs text-red-500 dark:text-red-400">
          {t("home.aiError")}
        </p>
      )}
    </div>
  );
}
