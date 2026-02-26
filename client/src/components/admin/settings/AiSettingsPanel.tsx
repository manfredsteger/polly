import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Bot, Zap, Info, CheckCircle, XCircle, Infinity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AiSettings } from "@shared/schema";

const GWDG_MODELS = [
  { id: "llama-3.3-70b-instruct", name: "LLaMA 3.3 70B", note: "Empfohlen" },
  { id: "gemma-3-27b-it", name: "Gemma 3 27B", note: "Schnell" },
  { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 70B", note: "Reasoning" },
  { id: "qwen3-235b-a22b", name: "Qwen3 235B", note: "Sehr stark" },
  { id: "mistral-large-3-675b-instruct-2512", name: "Mistral Large 675B", note: "Größtes Modell" },
  { id: "meta-llama-3.1-8b-instruct", name: "LLaMA 3.1 8B", note: "Sehr schnell" },
];

interface Props {
  onBack: () => void;
}

interface AdminAiData {
  settings: AiSettings;
  apiConfigured: boolean;
  fallbackConfigured: boolean;
  envModel: string | null;
  envApiUrl: string | null;
}

function RoleLimitControl({
  label,
  enabled,
  requestsPerHour,
  onEnabledChange,
  onLimitChange,
}: {
  label: string;
  enabled: boolean;
  requestsPerHour: number | null;
  onEnabledChange: (v: boolean) => void;
  onLimitChange: (v: number | null) => void;
}) {
  const [unlimited, setUnlimited] = useState(requestsPerHour === null);
  const [localValue, setLocalValue] = useState(requestsPerHour ?? 5);

  const handleUnlimitedToggle = (checked: boolean) => {
    setUnlimited(checked);
    onLimitChange(checked ? null : localValue);
  };

  const handleValueChange = (val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      setLocalValue(num);
      onLimitChange(num);
    }
  };

  return (
    <div className="p-3 rounded-lg border border-border bg-muted/20">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled && (
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={unlimited}
              onCheckedChange={handleUnlimitedToggle}
              id={`unlimited-${label}`}
            />
            <Label htmlFor={`unlimited-${label}`} className="text-xs text-muted-foreground flex items-center gap-1">
              <Infinity className="w-3 h-3" /> Unbegrenzt
            </Label>
          </div>
          {!unlimited && (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                max={1000}
                value={localValue}
                onChange={(e) => handleValueChange(e.target.value)}
                className="w-20 h-7 text-xs"
              />
              <span className="text-xs text-muted-foreground">/Stunde</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AiSettingsPanel({ onBack }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<AdminAiData>({
    queryKey: ["/api/v1/ai/admin/settings"],
  });

  const [localSettings, setLocalSettings] = useState<AiSettings | null>(null);
  const settings: AiSettings | null = localSettings ?? data?.settings ?? null;

  const saveMutation = useMutation({
    mutationFn: (s: AiSettings) =>
      apiRequest("PUT", "/api/v1/ai/admin/settings", s),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/ai/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/ai/status"] });
      toast({ title: "KI-Einstellungen gespeichert" });
    },
    onError: () => {
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    },
  });

  const update = (patch: Partial<AiSettings>) => {
    if (!settings) return;
    setLocalSettings({ ...settings, ...patch });
  };

  const handleSave = () => {
    if (!settings) return;
    saveMutation.mutate(settings);
  };

  if (isLoading || !settings) {
    return <div className="p-8 text-center text-muted-foreground">Lade...</div>;
  }

  const apiOk = data?.apiConfigured;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
        </Button>
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">KI-Assistent</h2>
          <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
            Beta
          </Badge>
        </div>
      </div>

      {!apiOk && (
        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <Info className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            <strong>AI_API_KEY</strong> ist nicht gesetzt. Hinterlege den GWDG SAIA Bearer Token als Secret,
            damit die KI-Funktion genutzt werden kann.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4" /> Allgemein
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>KI-Funktion aktivieren</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aktiviert den KI-Assistenten für alle konfigurierten Rollen
                </p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => update({ enabled: v })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Modell</Label>
              <Select
                value={settings.model}
                onValueChange={(v) => update({ model: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GWDG_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span>{m.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">({m.note})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {data?.envModel && (
                <p className="text-xs text-muted-foreground">
                  Env-Override aktiv: <code className="font-mono">{data.envModel}</code>
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                {apiOk ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-muted-foreground">
                  API-Key: {apiOk ? "Konfiguriert" : "Nicht gesetzt"}
                </span>
              </div>
              {data?.fallbackConfigured && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-muted-foreground">Fallback-Key: Konfiguriert</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rate-Limiting pro Rolle</CardTitle>
            <CardDescription>
              Kontingente pro Stunde. Unbegrenzt = keine Begrenzung, 0 = deaktiviert.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <RoleLimitControl
              label="Gäste (nicht angemeldet)"
              enabled={settings.guestLimits.enabled}
              requestsPerHour={settings.guestLimits.requestsPerHour}
              onEnabledChange={(v) =>
                update({ guestLimits: { ...settings.guestLimits, enabled: v } })
              }
              onLimitChange={(v) =>
                update({ guestLimits: { ...settings.guestLimits, requestsPerHour: v } })
              }
            />
            <RoleLimitControl
              label="Angemeldete Nutzer"
              enabled={settings.userLimits.enabled}
              requestsPerHour={settings.userLimits.requestsPerHour}
              onEnabledChange={(v) =>
                update({ userLimits: { ...settings.userLimits, enabled: v } })
              }
              onLimitChange={(v) =>
                update({ userLimits: { ...settings.userLimits, requestsPerHour: v } })
              }
            />
            <RoleLimitControl
              label="Administratoren"
              enabled={settings.adminLimits.enabled}
              requestsPerHour={settings.adminLimits.requestsPerHour}
              onEnabledChange={(v) =>
                update({ adminLimits: { ...settings.adminLimits, enabled: v } })
              }
              onLimitChange={(v) =>
                update({ adminLimits: { ...settings.adminLimits, requestsPerHour: v } })
              }
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Speichert..." : "Einstellungen speichern"}
        </Button>
        <Button variant="outline" onClick={onBack}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
