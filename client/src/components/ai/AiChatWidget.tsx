import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mic, ArrowRight, Sparkles, Loader2, CheckCircle, RefreshCw, AlertCircle, EyeOff, Eye, Minus, Send, X, Pencil, Lock, UserMinus, UserX, HelpCircle, ListChecks, Square, GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { VoiceRecordingOverlay } from "./VoiceRecordingOverlay";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface AiStatus {
  enabled: boolean;
  apiConfigured: boolean;
  canUse: boolean;
  remaining: number | null;
  reason?: string;
  resetAt?: string;
}

export interface AiSuggestionSettings {
  resultsPublic?: boolean;
  allowVoteEdit?: boolean;
  allowVoteWithdrawal?: boolean;
  allowMaybe?: boolean;
  allowMultipleSlots?: boolean;
}

export interface AiSuggestion {
  pollType: "schedule" | "survey" | "organization";
  title: string;
  description: string;
  options: string[];
  settings?: AiSuggestionSettings;
}

const POLL_TYPE_ROUTES: Record<AiSuggestion["pollType"], string> = {
  schedule: "/create-poll",
  survey: "/create-survey",
  organization: "/create-organization",
};

const POLL_TYPE_LABELS_DE: Record<AiSuggestion["pollType"], string> = {
  schedule: "Terminumfrage",
  survey: "Umfrage",
  organization: "Orga-Liste",
};

const SETTINGS_DEFAULTS: Record<AiSuggestion["pollType"], AiSuggestionSettings> = {
  schedule:     { resultsPublic: true,  allowVoteEdit: true,  allowVoteWithdrawal: true },
  survey:       { resultsPublic: true,  allowVoteEdit: false, allowVoteWithdrawal: false, allowMaybe: true },
  organization: { resultsPublic: true,  allowVoteEdit: true,  allowVoteWithdrawal: true,  allowMultipleSlots: true },
};

const PROMPTS_DE = [
  "Möchtest du ein Sommerfest planen und die Organisation für Helfer bereitstellen?",
  "Soll ich dir helfen, einen Elternabend-Termin zu koordinieren?",
  "Planst du eine Teambesprechung und suchst den besten Termin für alle?",
  "Möchtest du eine Zufriedenheitsumfrage für dein Team erstellen?",
  "Soll ich eine Mittagspausen-Einteilung für deine Gruppe organisieren?",
  "Planst du einen Workshop und brauchst eine Anmeldeliste mit Zeitslots?",
  "Möchtest du einen Fußballabend mit Freunden terminlich abstimmen?",
  "Suchst du nach dem besten Wochentag für ein regelmäßiges Meeting?",
  "Brauchst du eine Feedback-Umfrage nach eurer letzten Veranstaltung?",
  "Soll ich einen Reinigungsplan mit Schichten für dein Büro erstellen?",
  "Möchtest du eine Umfrage zu Essensvorlieben für euer Teamlunch machen?",
  "Planst du ein Abteilungstreffen und brauchst Terminvorschläge?",
];

const PROMPTS_EN = [
  "Do you want to plan a summer party and organize helpers with sign-up slots?",
  "Shall I help you coordinate a parent-teacher meeting time?",
  "Planning a team meeting and looking for the best time slot for everyone?",
  "Would you like to create a satisfaction survey for your team?",
  "Shall I set up a lunch break schedule with time slots for your group?",
  "Planning a workshop and need a sign-up sheet with time options?",
  "Want to schedule a movie night with friends — which date works best?",
  "Looking for the best weekday for a recurring standup meeting?",
  "Need a feedback survey after your last company event?",
  "Shall I create a cleaning rota with shifts for your office?",
  "Want to survey your team's food preferences for the next team lunch?",
  "Planning a department offsite and need to find a date that works?",
];

function getQuickSuggestions(
  lang: "de" | "en",
  pollType: AiSuggestion["pollType"],
  settings: AiSuggestionSettings
): string[] {
  const chips: string[] = [];

  if (lang === "de") {
    if (settings.resultsPublic) {
      chips.push("Ergebnisse nur für den Ersteller sichtbar machen");
    } else {
      chips.push("Ergebnisse für alle Teilnehmer öffentlich machen");
    }
    if (settings.allowVoteEdit) {
      chips.push("Abgaben sollen endgültig sein – keine Änderungen mehr möglich");
    } else {
      chips.push("Teilnehmer sollen ihre Abgabe nachträglich ändern können");
    }
    if (settings.allowVoteWithdrawal) {
      chips.push("Abmeldungen sperren – Buchungen sollen verbindlich sein");
    } else {
      chips.push("Teilnehmer sollen sich nachträglich abmelden können");
    }
    if (pollType === "organization") {
      if (settings.allowMultipleSlots) {
        chips.push("Jede Person darf sich nur für einen einzigen Slot anmelden");
      } else {
        chips.push("Mehrere Slots pro Teilnehmer erlauben");
      }
      chips.push("Begrenze die Plätze pro Station auf 5 Personen");
      chips.push("Füge weitere Stationen oder Zeitslots hinzu");
    } else if (pollType === "schedule") {
      if (settings.allowMaybe) {
        chips.push("Nur Ja/Nein als Antworten – kein 'Vielleicht'");
      } else {
        chips.push("'Vielleicht' als Antwortmöglichkeit hinzufügen");
      }
      chips.push("Füge weitere Terminoptionen hinzu");
      chips.push("Beschränke die Termine auf Werktage");
    } else if (pollType === "survey") {
      if (settings.allowMaybe) {
        chips.push("Nur Ja/Nein als Antworten – kein 'Vielleicht'");
      } else {
        chips.push("'Vielleicht' als Abstimmungsoption hinzufügen");
      }
      chips.push("Füge weitere Antwortmöglichkeiten hinzu");
    }
  } else {
    if (settings.resultsPublic) {
      chips.push("Make results visible only to the creator");
    } else {
      chips.push("Make results visible to all participants");
    }
    if (settings.allowVoteEdit) {
      chips.push("Submissions should be final – no changes allowed after submitting");
    } else {
      chips.push("Allow participants to change their submission later");
    }
    if (settings.allowVoteWithdrawal) {
      chips.push("Disable withdrawals – sign-ups should be binding");
    } else {
      chips.push("Allow participants to withdraw their sign-up later");
    }
    if (pollType === "organization") {
      if (settings.allowMultipleSlots) {
        chips.push("Each person may only sign up for one slot");
      } else {
        chips.push("Allow participants to sign up for multiple slots");
      }
      chips.push("Limit spots per slot to 5 people");
      chips.push("Add more stations or time slots");
    } else if (pollType === "schedule") {
      if (settings.allowMaybe) {
        chips.push("Only Yes/No answers – remove 'Maybe' option");
      } else {
        chips.push("Add 'Maybe' as an answer option");
      }
      chips.push("Add more date and time options");
      chips.push("Restrict the options to weekdays only");
    } else if (pollType === "survey") {
      if (settings.allowMaybe) {
        chips.push("Only Yes/No answers – remove 'Maybe' option");
      } else {
        chips.push("Add 'Maybe' as a voting option");
      }
      chips.push("Add more answer options");
    }
  }

  return chips;
}

function SortableOptionItem({ id, index, text }: { id: string; index: number; text: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-1.5"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors shrink-0 touch-none"
        aria-label="Ziehen zum Sortieren"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </span>
      <span className="bg-primary/10 text-primary text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-medium">
        {index + 1}
      </span>
      <span className="text-sm">{text}</span>
    </li>
  );
}

const TYPE_SPEED = 38;
const ERASE_SPEED = 18;
const PAUSE_AFTER_TYPE = 2400;
const PAUSE_AFTER_ERASE = 350;

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
        const t = setTimeout(() => setDisplay((d) => d.slice(0, -1)), ERASE_SPEED);
        return () => clearTimeout(t);
      } else {
        setErasing(false);
        setPausePhase("after-erase");
      }
    }
  }, [paused, lines, lineIdx, charIdx, erasing, pausePhase, display]);

  return { display, currentFull: lines[lineIdx] ?? "" };
}

function SettingsToggles({
  settings,
  pollType,
  onToggle,
  t,
}: {
  settings: AiSuggestionSettings;
  pollType: AiSuggestion["pollType"];
  onToggle: (key: keyof AiSuggestionSettings) => void;
  t: (key: string) => string;
}) {
  type Toggle = {
    key: keyof AiSuggestionSettings;
    trueIcon: React.ReactNode;
    falseIcon: React.ReactNode;
    trueLabel: string;
    falseLabel: string;
    trueClass: string;
    falseClass: string;
  };

  const green = "bg-green-500/15 border-green-500/30 text-green-600 dark:text-green-400";
  const amber = "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400";
  const muted = "bg-muted/50 border-border text-muted-foreground";

  const common: Toggle[] = [
    {
      key: "resultsPublic",
      trueIcon: <Eye className="w-3 h-3" />,
      falseIcon: <EyeOff className="w-3 h-3" />,
      trueLabel: t("aiWidget.settingsResultsPublic"),
      falseLabel: t("aiWidget.settingsResultsPrivate"),
      trueClass: green,
      falseClass: muted,
    },
    {
      key: "allowVoteEdit",
      trueIcon: <Pencil className="w-3 h-3" />,
      falseIcon: <Lock className="w-3 h-3" />,
      trueLabel: t("aiWidget.settingsAllowVoteEdit"),
      falseLabel: t("aiWidget.settingsVoteEditLocked"),
      trueClass: green,
      falseClass: muted,
    },
    {
      key: "allowVoteWithdrawal",
      trueIcon: <UserMinus className="w-3 h-3" />,
      falseIcon: <UserX className="w-3 h-3" />,
      trueLabel: t("aiWidget.settingsAllowWithdrawal"),
      falseLabel: t("aiWidget.settingsNoWithdrawal"),
      trueClass: green,
      falseClass: muted,
    },
  ];

  const extra: Toggle[] = pollType === "survey"
    ? [{
        key: "allowMaybe",
        trueIcon: <HelpCircle className="w-3 h-3" />,
        falseIcon: <Minus className="w-3 h-3" />,
        trueLabel: t("aiWidget.settingsMaybeAllowed"),
        falseLabel: t("aiWidget.settingsNoMaybe"),
        trueClass: amber,
        falseClass: muted,
      }]
    : pollType === "organization"
    ? [{
        key: "allowMultipleSlots",
        trueIcon: <ListChecks className="w-3 h-3" />,
        falseIcon: <Square className="w-3 h-3" />,
        trueLabel: t("aiWidget.settingsMultipleSlots"),
        falseLabel: t("aiWidget.settingsSingleSlot"),
        trueClass: green,
        falseClass: muted,
      }]
    : [];

  const toggles = [...common, ...extra];

  return (
    <div className="flex flex-wrap gap-1.5 pt-2">
      {toggles.map((tog) => {
        const val = settings[tog.key] ?? false;
        const cls = val ? tog.trueClass : tog.falseClass;
        const icon = val ? tog.trueIcon : tog.falseIcon;
        const label = val ? tog.trueLabel : tog.falseLabel;
        return (
          <button
            key={tog.key}
            type="button"
            onClick={() => onToggle(tog.key)}
            className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium cursor-pointer transition-all hover:opacity-75 select-none ${cls}`}
          >
            {icon}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function AiChatWidget() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [inputValue, setInputValue] = useState("");
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [localSettings, setLocalSettings] = useState<AiSuggestionSettings>({});
  const [followUpValue, setFollowUpValue] = useState("");
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [orderedOptions, setOrderedOptions] = useState<string[]>([]);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const followUpRef = useRef<HTMLTextAreaElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const originalInputRef = useRef<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isFilled = inputValue.trim().length > 0;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const lang = i18n.language?.startsWith("de") ? "de" : "en";
  const prompts = lang === "de" ? PROMPTS_DE : PROMPTS_EN;

  const { display: placeholderDisplay, currentFull } = useTypewriter(prompts, isFilled);

  const { data: status, isLoading: statusLoading } = useQuery<AiStatus>({
    queryKey: ["/api/v1/ai/status"],
    refetchInterval: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!suggestion) return;
    const defaults = SETTINGS_DEFAULTS[suggestion.pollType];
    setLocalSettings({ ...defaults, ...(suggestion.settings ?? {}) });
    setOrderedOptions(suggestion.options ?? []);
  }, [suggestion]);

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const transcribeVoice = useCallback(async (audioBlob: Blob) => {
    if (audioBlob.size < 1024) return;
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      const response = await fetch("/api/v1/ai/transcribe", { method: "POST", body: formData });
      const result = await response.json();
      if (result.success && result.text) {
        setInputValue((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed} ${result.text.trim()}` : result.text.trim();
        });
      }
    } catch (error) {
      console.error("[Voice] Transcription failed:", error);
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({ title: t("home.aiMicError"), variant: "destructive" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setAudioStream(stream);
      setIsListening(true);
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
          setAudioStream(null);
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 0) await transcribeVoice(audioBlob);
        audioChunksRef.current = [];
      };

      mediaRecorder.start(100);
    } catch (error: any) {
      console.error("[Voice] Failed to start recording:", error);
      const msg = error?.name === "NotAllowedError"
        ? t("home.aiMicError")
        : error?.name === "NotFoundError"
        ? t("home.aiMicError")
        : t("home.aiMicError");
      toast({ title: msg, variant: "destructive" });
      setIsListening(false);
    }
  }, [transcribeVoice, toast, t]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) stopRecording();
    else startRecording();
  }, [isListening, startRecording, stopRecording]);

  const toggleSetting = (key: keyof AiSuggestionSettings) => {
    setLocalSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
    mutationFn: () => {
      originalInputRef.current = inputValue.trim();
      return apiRequest("POST", "/api/v1/ai/create-poll", { description: inputValue, language: lang });
    },
    onSuccess: async (res) => {
      const data = await res.json();
      setSuggestion(data.suggestion as AiSuggestion);
      setFollowUpValue("");
      setRefineError(null);
      setTimeout(() => textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
      setTimeout(() => followUpRef.current?.focus({ preventScroll: true }), 400);
    },
    onError: (err: any) => {
      setSuggestion(null);
      setRefineError(null);
    },
  });

  const refineMutation = useMutation({
    mutationFn: (refinement: string) => {
      setRefineError(null);
      return apiRequest("POST", "/api/v1/ai/create-poll", {
        description: originalInputRef.current || inputValue.trim(),
        language: lang,
        refinement,
        previousSuggestion: suggestion,
      });
    },
    onSuccess: async (res) => {
      const data = await res.json();
      setSuggestion(data.suggestion as AiSuggestion);
      setFollowUpValue("");
      setSelectedChips([]);
      setRefineError(null);
      setTimeout(() => textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
      setTimeout(() => followUpRef.current?.focus({ preventScroll: true }), 400);
    },
    onError: (err: any) => {
      let message = lang === "de"
        ? "Anpassung fehlgeschlagen. Bitte erneut versuchen."
        : "Refinement failed. Please try again.";
      try {
        const errMsg = err?.message || "";
        const jsonStart = errMsg.indexOf("{");
        if (jsonStart !== -1) {
          const body = JSON.parse(errMsg.slice(jsonStart));
          if (body?.error) message = body.error;
        }
      } catch {}
      setRefineError(message);
    },
  });

  const handleSubmit = () => {
    if (!inputValue.trim() || inputValue.trim().length < 5) return;
    setSuggestion(null);
    setFollowUpValue("");
    setSelectedChips([]);
    mutation.mutate();
  };

  const handleRefine = () => {
    const parts = [...selectedChips, followUpValue.trim()].filter(Boolean);
    if (parts.length === 0 || !suggestion) return;
    refineMutation.mutate(parts.join(". "));
  };

  const handleApply = () => {
    if (!suggestion) return;
    sessionStorage.setItem("ai-suggestion", JSON.stringify({ ...suggestion, options: orderedOptions, settings: localSettings }));
    setLocation(POLL_TYPE_ROUTES[suggestion.pollType]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedOptions((items) => {
        const from = items.findIndex((_, i) => `opt-${i}` === active.id);
        const to = items.findIndex((_, i) => `opt-${i}` === over.id);
        return arrayMove(items, from, to);
      });
    }
  };

  const handleKeySubmit = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFollowUpKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleRefine();
    }
  };

  if (status && (!status.enabled || !status.apiConfigured)) return null;

  const isRefining = refineMutation.isPending;
  const pollTypeLabel = suggestion
    ? (lang === "de" ? POLL_TYPE_LABELS_DE[suggestion.pollType] : suggestion.pollType)
    : "";

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
        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setSuggestion(null); setFollowUpValue(""); setSelectedChips([]); }}
            onKeyDown={(e) => { handleKeyDown(e); handleKeySubmit(e); }}
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
                  Tab ↹
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
                    onClick={toggleListening}
                    disabled={isTranscribing || mutation.isPending}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors select-none disabled:opacity-40 disabled:cursor-not-allowed ${
                      isListening
                        ? "text-primary animate-pulse"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isTranscribing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">{t("home.aiMicTooltip")}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{t("home.aiMicTooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {inputValue.length > 0 && (
              <span className={`text-xs tabular-nums transition-colors ${
                inputValue.length > 9800 ? "text-red-500" :
                inputValue.length > 9000 ? "text-amber-500" :
                "text-muted-foreground/40"
              }`}>
                {inputValue.length.toLocaleString()} / 10 000
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!status?.canUse && status?.reason && (
              <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-500" />
                {status?.reason === "GUEST_NOT_ALLOWED"
                  ? t("home.aiLoginRequired")
                  : t("home.aiLimitReached")}
              </span>
            )}
            {status?.canUse && status?.remaining != null && (
              <span className="text-xs text-muted-foreground">
                {status.remaining} {t("home.aiRemaining")}
              </span>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={statusLoading || !status?.canUse || !isFilled || inputValue.trim().length < 5 || mutation.isPending}
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
        <div
          ref={suggestionRef}
          className="mt-3 rounded-xl border border-border bg-card/80 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 overflow-hidden"
        >
          {/* Suggestion content */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  {t("home.aiSuggestion")}
                </div>
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                  {pollTypeLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={() => { setSuggestion(null); setFollowUpValue(""); mutation.mutate(); }}
                disabled={mutation.isPending}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                {t("home.aiRegenerate")}
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-lg font-bold text-foreground leading-tight">{suggestion.title}</p>
              {suggestion.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{suggestion.description}</p>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  {t("home.aiOptions")} ({orderedOptions.length})
                </p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={orderedOptions.map((_, i) => `opt-${i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="space-y-1.5">
                      {orderedOptions.map((opt, i) => (
                        <SortableOptionItem key={`opt-${i}`} id={`opt-${i}`} index={i} text={opt} />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              </div>

              <SettingsToggles
                settings={localSettings}
                pollType={suggestion.pollType}
                onToggle={toggleSetting}
                t={t}
              />
            </div>
          </div>

          {/* Apply button section */}
          <div className="px-4 pb-4 pt-3 bg-primary/5 border-t-2 border-primary/20">
            <Button
              onClick={handleApply}
              className="w-full h-12 text-base font-semibold gap-2.5 shadow-md hover:shadow-lg transition-shadow"
            >
              <ArrowRight className="w-5 h-5" />
              {`${t("home.aiApply")} → ${pollTypeLabel}`}
            </Button>
          </div>

          {/* Follow-up refinement box */}
          <div className="border-t border-border/60 bg-muted/10">
            <div className="px-4 pt-3 pb-1">
              <p className="text-sm font-semibold text-foreground/80">
                {t("aiWidget.followUpTitle")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("aiWidget.followUpHint")}
              </p>
            </div>

            {/* Quick suggestion chips — dynamic, always opposite of current settings */}
            {(() => {
              const chips = getQuickSuggestions(lang === "de" ? "de" : "en", suggestion.pollType, localSettings);
              if (chips.length === 0) return null;
              const visibleChips = chips.filter((c) => !selectedChips.includes(c));
              return (
                <div className="px-3 pb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-px flex-1 bg-border/50" />
                    <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{t("aiWidget.quickSuggestionsLabel")}</span>
                    <div className="h-px flex-1 bg-border/50" />
                  </div>
                  {visibleChips.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {visibleChips.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setSelectedChips((prev) => [...prev, chip])}
                          className="text-xs px-2.5 py-1 rounded-lg border border-transparent bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">Alle Optionen ausgewählt ✓</p>
                  )}
                </div>
              );
            })()}

            {/* Selected chips as removable tags */}
            {selectedChips.length > 0 && (
              <div className="mx-3 mb-2 bg-primary/5 rounded-xl p-2.5">
                <p className="text-[10px] text-primary/60 mb-1.5 font-medium">Wird angepasst:</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedChips.map((chip) => (
                    <span
                      key={chip}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary/15 border border-primary/40 text-primary font-medium"
                    >
                      {chip}
                      <button
                        type="button"
                        onClick={() => setSelectedChips((prev) => prev.filter((c) => c !== chip))}
                        className="ml-0.5 rounded-full hover:bg-primary/20 transition-colors p-0.5"
                        aria-label="Entfernen"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-end gap-2 px-3 pb-3 pt-1">
              <textarea
                ref={followUpRef}
                value={followUpValue}
                onChange={(e) => setFollowUpValue(e.target.value)}
                onKeyDown={handleFollowUpKeyDown}
                rows={2}
                placeholder={
                  selectedChips.length > 0
                    ? t("aiWidget.followUpPlaceholderOptional")
                    : t("aiWidget.followUpPlaceholder")
                }
                disabled={isRefining}
                className="flex-1 resize-none bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors disabled:opacity-50"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleRefine}
                disabled={
                  (selectedChips.length === 0 && followUpValue.trim().length < 3) ||
                  isRefining ||
                  !status?.canUse
                }
                className="h-[52px] px-3 shrink-0 gap-1.5"
              >
                {isRefining ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {isRefining ? t("aiWidget.followUpLoading") : t("aiWidget.followUpSubmit")}
                </span>
              </Button>
            </div>
            {followUpValue.length > 0 && (
              <div className="px-3 pb-1 flex justify-end">
                <span className={`text-xs tabular-nums transition-colors ${
                  followUpValue.length > 2800 ? "text-red-500" :
                  followUpValue.length > 2500 ? "text-amber-500" :
                  "text-muted-foreground/40"
                }`}>
                  {followUpValue.length.toLocaleString()} / 3 000
                </span>
              </div>
            )}
            {refineError && (
              <div className="mx-3 mb-3 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600 dark:text-red-400">{refineError}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {mutation.isError && !suggestion && (
        <div className="mt-2 flex items-start justify-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 dark:text-red-400">
            {(() => {
              try {
                const errMsg = (mutation.error as any)?.message || "";
                const jsonStart = errMsg.indexOf("{");
                if (jsonStart !== -1) {
                  const body = JSON.parse(errMsg.slice(jsonStart));
                  if (body?.error) return body.error;
                }
              } catch {}
              return t("home.aiError");
            })()}
          </p>
        </div>
      )}

      <VoiceRecordingOverlay
        isVisible={isListening || isTranscribing}
        onStop={stopRecording}
        audioStream={audioStream}
        isTranscribing={isTranscribing}
        isListening={isListening}
      />
    </div>
  );
}
