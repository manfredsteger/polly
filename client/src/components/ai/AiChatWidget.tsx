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

export type AiOptionItem = string | { text: string; isFreeText?: boolean };

export interface AiSuggestion {
  pollType: "schedule" | "survey" | "organization";
  title: string;
  description: string;
  options: AiOptionItem[];
  settings?: AiSuggestionSettings;
}

function getOptionText(opt: AiOptionItem): string {
  return typeof opt === "string" ? opt : opt.text;
}

const POLL_TYPE_ROUTES: Record<AiSuggestion["pollType"], string> = {
  schedule: "/create-poll",
  survey: "/create-survey",
  organization: "/create-organization",
};

const POLL_TYPE_LABEL_KEYS: Record<AiSuggestion["pollType"], string> = {
  schedule: "aiWidget.pollTypeSchedule",
  survey: "aiWidget.pollTypeSurvey",
  organization: "aiWidget.pollTypeOrganization",
};

const SETTINGS_DEFAULTS: Record<AiSuggestion["pollType"], AiSuggestionSettings> = {
  schedule:     { resultsPublic: true,  allowVoteEdit: true,  allowVoteWithdrawal: true },
  survey:       { resultsPublic: true,  allowVoteEdit: false, allowVoteWithdrawal: false, allowMaybe: true },
  organization: { resultsPublic: true,  allowVoteEdit: true,  allowVoteWithdrawal: true,  allowMultipleSlots: true },
};

function getPrompts(t: (key: string) => string): string[] {
  return Array.from({ length: 12 }, (_, i) => t(`aiWidget.prompts.${i}`));
}

function getQuickSuggestions(
  t: (key: string) => string,
  pollType: AiSuggestion["pollType"],
  settings: AiSuggestionSettings
): string[] {
  const chips: string[] = [];

  if (settings.resultsPublic) {
    chips.push(t("aiWidget.quickSuggestions.resultsOnlyCreator"));
  } else {
    chips.push(t("aiWidget.quickSuggestions.resultsPublicAll"));
  }
  if (settings.allowVoteEdit) {
    chips.push(t("aiWidget.quickSuggestions.submissionsFinal"));
  } else {
    chips.push(t("aiWidget.quickSuggestions.allowEditSubmission"));
  }
  if (settings.allowVoteWithdrawal) {
    chips.push(t("aiWidget.quickSuggestions.disableWithdrawals"));
  } else {
    chips.push(t("aiWidget.quickSuggestions.allowWithdrawal"));
  }
  if (pollType === "organization") {
    if (settings.allowMultipleSlots) {
      chips.push(t("aiWidget.quickSuggestions.singleSlotOnly"));
    } else {
      chips.push(t("aiWidget.quickSuggestions.allowMultipleSlots"));
    }
    chips.push(t("aiWidget.quickSuggestions.limitSpots"));
    chips.push(t("aiWidget.quickSuggestions.addMoreStations"));
  } else if (pollType === "schedule") {
    if (settings.allowMaybe) {
      chips.push(t("aiWidget.quickSuggestions.yesNoOnly"));
    } else {
      chips.push(t("aiWidget.quickSuggestions.addMaybe"));
    }
    chips.push(t("aiWidget.quickSuggestions.addMoreDates"));
    chips.push(t("aiWidget.quickSuggestions.weekdaysOnly"));
  } else if (pollType === "survey") {
    if (settings.allowMaybe) {
      chips.push(t("aiWidget.quickSuggestions.yesNoOnly"));
    } else {
      chips.push(t("aiWidget.quickSuggestions.addMaybeVoting"));
    }
    chips.push(t("aiWidget.quickSuggestions.addMoreOptions"));
  }

  return chips;
}

function SortableOptionItem({ id, index, option }: { id: string; index: number; option: AiOptionItem }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const displayText = getOptionText(option);
  const isFreeText = typeof option === "object" && option.isFreeText;
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
        aria-label={t("aiWidget.dragToSort")}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </span>
      <span className="bg-primary/10 text-primary text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-medium">
        {index + 1}
      </span>
      <span className="text-sm">{displayText}</span>
      {isFreeText && (
        <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full shrink-0">
          {t("aiWidget.freeText")}
        </span>
      )}
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
  const lang = i18n.language?.startsWith("de") ? "de" : "en";
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [inputValue, setInputValue] = useState("");
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [localSettings, setLocalSettings] = useState<AiSuggestionSettings>({});
  const [followUpValue, setFollowUpValue] = useState("");
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [orderedOptions, setOrderedOptions] = useState<AiOptionItem[]>([]);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const followUpRef = useRef<HTMLInputElement>(null);
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

  const prompts = getPrompts(t);

  const { display: placeholderDisplay, currentFull } = useTypewriter(prompts, isFilled);

  const { data: status, isLoading: statusLoading, isError: statusError } = useQuery<AiStatus>({
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

  const voiceTargetRef = useRef<"main" | "followup">("main");
  const activeRecordingTargetRef = useRef<"main" | "followup">("main");

  const transcribeVoice = useCallback(async (audioBlob: Blob) => {
    if (audioBlob.size < 1024) return;
    setIsTranscribing(true);
    const target = activeRecordingTargetRef.current;
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      const response = await fetch("/api/v1/ai/transcribe", { method: "POST", body: formData });
      const result = await response.json();
      if (result.success && result.text) {
        const setter = target === "followup" ? setFollowUpValue : setInputValue;
        setter((prev) => {
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
    activeRecordingTargetRef.current = voiceTargetRef.current;
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
      let message = t("aiWidget.refineFailed");
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

  const handleFollowUpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleRefine();
    }
  };

  const toggleFollowUpListening = useCallback(() => {
    voiceTargetRef.current = "followup";
    if (isListening) stopRecording();
    else startRecording();
  }, [isListening, startRecording, stopRecording]);

  if (statusLoading || statusError || (status && (!status.enabled || !status.apiConfigured))) return null;

  const isRefining = refineMutation.isPending;
  const pollTypeLabel = suggestion
    ? t(POLL_TYPE_LABEL_KEYS[suggestion.pollType])
    : "";

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-3">
        <h2 className="text-xl font-semibold text-foreground inline-flex items-center gap-2 mb-1">
          {t("home.aiChatTitle")}
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
          >
            {t("home.betaBadge")}
          </Badge>
        </h2>
        <p className="text-sm text-muted-foreground">{t("home.aiChatHint")}</p>
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
                    onClick={() => { voiceTargetRef.current = "main"; toggleListening(); }}
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
                        <SortableOptionItem key={`opt-${i}`} id={`opt-${i}`} index={i} option={opt} />
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

          {/* Follow-up refinement box */}
          <div className="border-t border-border/60">
            <div className="px-4 pt-4 pb-3">
              <p className="text-base font-semibold text-foreground">
                {t("aiWidget.followUpTitle")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("aiWidget.followUpHint")}
              </p>
            </div>

            {/* Free-text input with voice + Anpassen */}
            <div className="px-4 pb-4">
              <div className="flex items-center gap-0 border border-border/60 dark:border-border rounded-xl bg-muted/30 dark:bg-muted/20 overflow-hidden focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary/50 transition-colors">
                <button
                  type="button"
                  onClick={toggleFollowUpListening}
                  disabled={isTranscribing || isRefining}
                  className={`flex items-center justify-center w-10 h-10 shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    isListening && voiceTargetRef.current === "followup"
                      ? "text-primary animate-pulse"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={t("home.aiMicTooltip")}
                >
                  {isTranscribing && voiceTargetRef.current === "followup" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>
                <input
                  ref={followUpRef}
                  type="text"
                  value={followUpValue}
                  onChange={(e) => setFollowUpValue(e.target.value)}
                  onKeyDown={handleFollowUpKeyDown}
                  placeholder={
                    selectedChips.length > 0
                      ? t("aiWidget.followUpPlaceholderOptional")
                      : t("aiWidget.followUpPlaceholder")
                  }
                  disabled={isRefining}
                  className="flex-1 min-w-0 bg-transparent px-0 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
                />
                {followUpValue.length > 0 && (
                  <span className={`text-xs tabular-nums px-1 shrink-0 ${
                    followUpValue.length > 2800 ? "text-red-500" :
                    followUpValue.length > 2500 ? "text-amber-500" :
                    "text-muted-foreground/40"
                  }`}>
                    {followUpValue.length.toLocaleString()}/3000
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRefine}
                  disabled={
                    (selectedChips.length === 0 && followUpValue.trim().length < 3) ||
                    isRefining ||
                    !status?.canUse
                  }
                  className="h-9 px-3 shrink-0 gap-1.5 mr-1 text-primary hover:text-primary hover:bg-primary/10"
                >
                  {isRefining ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">{isRefining ? t("aiWidget.followUpLoading") : t("aiWidget.followUpSubmit")}</span>
                </Button>
              </div>
            </div>
            {refineError && (
              <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">{refineError}</p>
              </div>
            )}

            {/* Quick suggestion chips */}
            {(() => {
              const chips = getQuickSuggestions(t, suggestion.pollType, localSettings);
              if (chips.length === 0) return null;
              const visibleChips = chips.filter((c) => !selectedChips.includes(c));
              return (
                <div className="px-4 pb-3">
                  <p className="text-base font-semibold text-foreground mb-2">{t("aiWidget.quickSuggestionsLabel")}</p>
                  {visibleChips.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {visibleChips.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setSelectedChips((prev) => [...prev, chip])}
                          className="text-left text-sm px-4 py-2.5 rounded-xl border-2 border-dashed border-muted-foreground/40 dark:border-muted-foreground/30 bg-muted/20 dark:bg-muted/10 hover:bg-primary/10 hover:border-primary/50 hover:border-solid text-foreground transition-all cursor-pointer"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground/60 italic">{t("aiWidget.allOptionsSelected")}</p>
                  )}
                </div>
              );
            })()}

            {/* Selected chips as removable tags */}
            {selectedChips.length > 0 && (
              <div className="px-4 pb-3">
                <p className="text-base font-semibold text-foreground mb-2">{t("aiWidget.beingAdjusted")}</p>
                <div className="flex flex-col gap-2">
                  {selectedChips.map((chip) => (
                    <span
                      key={chip}
                      className="inline-flex items-center justify-between text-sm px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium"
                    >
                      <span>{chip}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedChips((prev) => prev.filter((c) => c !== chip))}
                        className="ml-2 rounded-full hover:bg-primary-foreground/20 transition-colors p-0.5"
                        aria-label={t("aiWidget.remove")}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Apply button — pill style like settings toggles, but much larger */}
            <div className="px-4 pb-4 pt-2 flex justify-center">
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex items-center gap-2.5 text-lg font-bold px-8 py-3 rounded-full border-2 bg-green-500/15 border-green-500/30 text-green-600 dark:text-green-400 cursor-pointer transition-all hover:bg-green-500/25 hover:border-green-500/50 select-none"
              >
                <ArrowRight className="w-5 h-5" />
                {`${t("home.aiApply")} → ${pollTypeLabel}`}
              </button>
            </div>
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
