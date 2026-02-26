import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bot, Sparkles, Loader2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface AiPollCreatorProps {
  onApply: (suggestion: PollSuggestion) => void;
  pollType?: "schedule" | "survey" | "organization";
}

function BetaBadge() {
  return (
    <Badge
      variant="secondary"
      className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30"
    >
      Beta
    </Badge>
  );
}

function QuotaInfo({ remaining }: { remaining: number | null }) {
  if (remaining === null) return <span className="text-xs text-muted-foreground">Unbegrenzt</span>;
  if (remaining === 0)
    return <span className="text-xs text-red-500">Kontingent aufgebraucht</span>;
  return (
    <span className="text-xs text-muted-foreground">
      {remaining} Anfrage{remaining !== 1 ? "n" : ""} übrig
    </span>
  );
}

export function AiPollCreatorButton({
  onApply,
  pollType,
}: AiPollCreatorProps) {
  const [open, setOpen] = useState(false);

  const { data: status } = useQuery<AiStatus>({
    queryKey: ["/api/v1/ai/status"],
    refetchInterval: false,
  });

  if (!status?.enabled || !status?.apiConfigured) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 border-primary/30 hover:border-primary/60"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        Mit KI erstellen
        <BetaBadge />
      </Button>

      <AiPollCreatorDialog
        open={open}
        onClose={() => setOpen(false)}
        onApply={(s) => {
          onApply(s);
          setOpen(false);
        }}
        status={status}
        pollType={pollType}
      />
    </>
  );
}

function AiPollCreatorDialog({
  open,
  onClose,
  onApply,
  status,
  pollType,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (s: PollSuggestion) => void;
  status: AiStatus;
  pollType?: "schedule" | "survey" | "organization";
}) {
  const { i18n } = useTranslation();
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [suggestion, setSuggestion] = useState<PollSuggestion | null>(null);

  const lang = i18n.language?.startsWith("de") ? "de" : "en";

  const placeholders: Record<string, string> = {
    schedule: "z.B. Teambesprechung für nächste Woche planen, 5–6 Personen, bevorzugt Dienstag oder Donnerstag morgens",
    survey: "z.B. Zufriedenheitsumfrage für unsere letzte Teamveranstaltung",
    organization: "z.B. Mittagspausen-Schichten für 3 Personen, Montag bis Freitag",
  };

  const placeholder =
    (pollType && placeholders[pollType]) ||
    "Beschreibe deine Umfrage oder Terminabfrage...";

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/v1/ai/create-poll", { description, language: lang }),
    onSuccess: async (res) => {
      const data = await res.json();
      setSuggestion(data.suggestion);
    },
    onError: async (err: any) => {
      let msg = "KI-Anfrage fehlgeschlagen";
      try {
        const data = await err.json?.();
        if (data?.error) msg = data.error;
      } catch (_) {}
      toast({ title: msg, variant: "destructive" });
    },
  });

  const handleGenerate = () => {
    if (description.trim().length < 5) return;
    setSuggestion(null);
    mutation.mutate();
  };

  const canUse = status.canUse;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setSuggestion(null); setDescription(""); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            KI-Assistent
            <BetaBadge />
          </DialogTitle>
          <DialogDescription>
            Beschreibe deine Umfrage — die KI schlägt Titel, Beschreibung und Optionen vor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">GWDG SAIA · DSGVO-konform · Server in Deutschland</span>
            <QuotaInfo remaining={status.remaining ?? null} />
          </div>

          {!canUse && (
            <Alert className="border-red-500/30 bg-red-50 dark:bg-red-950/20">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <AlertDescription className="text-red-700 dark:text-red-400 text-sm">
                {status.reason === "GUEST_NOT_ALLOWED"
                  ? "Bitte melde dich an, um den KI-Assistenten zu nutzen."
                  : status.reason === "RATE_LIMIT_EXCEEDED"
                  ? `Stundenlimit erreicht. Versuche es ${status.resetAt ? `ab ${new Date(status.resetAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr` : "später"} erneut.`
                  : "KI-Assistent momentan nicht verfügbar."}
              </AlertDescription>
            </Alert>
          )}

          <Textarea
            placeholder={placeholder}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="resize-none"
            disabled={!canUse || mutation.isPending}
          />

          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={!canUse || description.trim().length < 5 || mutation.isPending}
              className="gap-2"
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {mutation.isPending ? "Erstelle..." : "Vorschlag generieren"}
            </Button>
            {suggestion && (
              <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={mutation.isPending}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Neu generieren
              </Button>
            )}
          </div>

          {suggestion && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
                <CheckCircle className="w-4 h-4" /> Vorschlag
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Titel</p>
                <p className="text-sm font-medium">{suggestion.title}</p>
              </div>
              {suggestion.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Beschreibung</p>
                  <p className="text-sm">{suggestion.description}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Optionen ({suggestion.options.length})</p>
                <ul className="space-y-1">
                  {suggestion.options.map((opt, i) => (
                    <li key={i} className="text-sm flex items-start gap-1.5">
                      <span className="text-muted-foreground text-xs mt-0.5">{i + 1}.</span>
                      {opt}
                    </li>
                  ))}
                </ul>
              </div>
              <Button onClick={() => onApply(suggestion)} className="w-full gap-2" size="sm">
                <CheckCircle className="w-4 h-4" /> Vorschlag übernehmen
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
