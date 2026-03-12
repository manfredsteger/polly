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
import { ArrowLeft, Bot, Zap, Info, CheckCircle, XCircle, Infinity, Key, Globe, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AiSettings } from "@shared/schema";

const GWDG_MODELS = [
  { id: "llama-3.3-70b-instruct", name: "LLaMA 3.3 70B", noteKey: "modelRecommended" },
  { id: "gemma-3-27b-it", name: "Gemma 3 27B", noteKey: "modelFast" },
  { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 70B", noteKey: "modelReasoning" },
  { id: "qwen3-235b-a22b", name: "Qwen3 235B", noteKey: "modelVeryStrong" },
  { id: "mistral-large-3-675b-instruct-2512", name: "Mistral Large 675B", noteKey: "modelLargest" },
  { id: "meta-llama-3.1-8b-instruct", name: "LLaMA 3.1 8B", noteKey: "modelVeryFast" },
];

interface Props {
  onBack: () => void;
}

interface AdminAiData {
  settings: AiSettings;
  apiConfigured: boolean;
  fallbackConfigured: boolean;
  hasApiKey: boolean;
  hasApiKeyFallback: boolean;
  apiKeyViaEnv: boolean;
  apiKeyFallbackViaEnv: boolean;
  apiUrlViaEnv: boolean;
  envModel: string | null;
  envApiUrl: string | null;
}

function RoleLimitControl({
  label,
  enabled,
  requestsPerHour,
  onEnabledChange,
  onLimitChange,
  t,
}: {
  label: string;
  enabled: boolean;
  requestsPerHour: number | null;
  onEnabledChange: (v: boolean) => void;
  onLimitChange: (v: number | null) => void;
  t: (key: string) => string;
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
              <Infinity className="w-3 h-3" /> {t('admin.aiSettings.unlimited')}
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
              <span className="text-xs text-muted-foreground">{t('admin.aiSettings.perHour')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EnvBadge() {
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
      ENV
    </Badge>
  );
}

export function AiSettingsPanel({ onBack }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<AdminAiData>({
    queryKey: ["/api/v1/ai/admin/settings"],
  });

  const [localSettings, setLocalSettings] = useState<AiSettings | null>(null);
  const [newApiKey, setNewApiKey] = useState("");
  const [newApiKeyFallback, setNewApiKeyFallback] = useState("");
  const [newApiUrl, setNewApiUrl] = useState("");
  const settings: AiSettings | null = localSettings ?? data?.settings ?? null;

  const saveMutation = useMutation({
    mutationFn: (s: AiSettings) =>
      apiRequest("PUT", "/api/v1/ai/admin/settings", s),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/ai/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/ai/status"] });
      setNewApiKey("");
      setNewApiKeyFallback("");
      setNewApiUrl("");
      toast({ title: t('admin.aiSettings.savedToast') });
    },
    onError: () => {
      toast({ title: t('admin.aiSettings.saveError'), variant: "destructive" });
    },
  });

  const update = (patch: Partial<AiSettings>) => {
    if (!settings) return;
    setLocalSettings({ ...settings, ...patch });
  };

  const handleSave = () => {
    if (!settings) return;
    const toSave = { ...settings };
    if (newApiKey) toSave.apiKey = newApiKey;
    if (newApiKeyFallback) toSave.apiKeyFallback = newApiKeyFallback;
    if (newApiUrl) toSave.apiUrl = newApiUrl;
    saveMutation.mutate(toSave);
  };

  const handleClearApiKey = () => {
    if (!settings) return;
    const toSave = { ...settings, apiKey: "__CLEAR__" };
    saveMutation.mutate(toSave);
  };

  const handleClearApiKeyFallback = () => {
    if (!settings) return;
    const toSave = { ...settings, apiKeyFallback: "__CLEAR__" };
    saveMutation.mutate(toSave);
  };

  if (isLoading || !settings) {
    return <div className="p-8 text-center text-muted-foreground">{t('admin.aiSettings.loading')}</div>;
  }

  const apiOk = data?.apiConfigured;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('admin.aiSettings.back')}
        </Button>
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">{t('admin.aiSettings.title')}</h2>
          <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
            Beta
          </Badge>
        </div>
      </div>

      {!apiOk && (
        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <Info className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            {t('admin.aiSettings.noApiKeyWarning')}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="w-4 h-4" /> {t('admin.aiSettings.apiConfiguration')}
            </CardTitle>
            <CardDescription>
              {t('admin.aiSettings.envPrecedence')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label>{t('admin.aiSettings.apiKey')}</Label>
                {data?.apiKeyViaEnv && <EnvBadge />}
              </div>
              {data?.apiKeyViaEnv ? (
                <div className="flex items-center gap-2">
                  <Input
                    value="••••••••••••••••"
                    readOnly
                    disabled
                    className="bg-muted font-mono text-xs"
                  />
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      placeholder={data?.hasApiKey ? t('admin.aiSettings.apiKeyPlaceholderSaved') : t('admin.aiSettings.apiKeyPlaceholder')}
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      className="font-mono text-xs"
                    />
                    {data?.hasApiKey ? (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    )}
                    {data?.hasApiKey && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={handleClearApiKey}
                        title={t('admin.aiSettings.deleteKeyTitle')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  {!data?.hasApiKey && (
                    <p className="text-xs text-muted-foreground">
                      {t('admin.aiSettings.envAlternative')}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label>{t('admin.aiSettings.fallbackKey')}</Label>
                {data?.apiKeyFallbackViaEnv && <EnvBadge />}
              </div>
              {data?.apiKeyFallbackViaEnv ? (
                <div className="flex items-center gap-2">
                  <Input
                    value="••••••••••••••••"
                    readOnly
                    disabled
                    className="bg-muted font-mono text-xs"
                  />
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      placeholder={data?.hasApiKeyFallback ? t('admin.aiSettings.apiKeyPlaceholderSaved') : t('admin.aiSettings.fallbackPlaceholder')}
                      value={newApiKeyFallback}
                      onChange={(e) => setNewApiKeyFallback(e.target.value)}
                      className="font-mono text-xs"
                    />
                    {data?.hasApiKeyFallback && (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={handleClearApiKeyFallback}
                          title={t('admin.aiSettings.deleteFallbackTitle')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.aiSettings.fallbackUsageNote')}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label>{t('admin.aiSettings.apiUrl')}</Label>
                {data?.apiUrlViaEnv && <EnvBadge />}
              </div>
              {data?.apiUrlViaEnv ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={data?.envApiUrl || ""}
                    readOnly
                    disabled
                    className="bg-muted font-mono text-xs"
                  />
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    type="url"
                    placeholder="https://saia.gwdg.de/v1"
                    value={newApiUrl || settings.apiUrl || ""}
                    onChange={(e) => {
                      setNewApiUrl(e.target.value);
                      update({ apiUrl: e.target.value });
                    }}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('admin.aiSettings.defaultUrl')} <code className="font-mono">https://saia.gwdg.de/v1</code>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4" /> {t('admin.aiSettings.general')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.aiSettings.enableAi')}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('admin.aiSettings.enableAiDescription')}
                </p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => update({ enabled: v })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('admin.aiSettings.model')}</Label>
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
                      <span className="ml-2 text-xs text-muted-foreground">({t(`admin.aiSettings.${m.noteKey}`)})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {data?.envModel && (
                <p className="text-xs text-muted-foreground">
                  {t('admin.aiSettings.envOverride')} <code className="font-mono">{data.envModel}</code>
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
                  {t('admin.aiSettings.apiKey')}: {apiOk ? t('admin.aiSettings.apiKeyConfigured') : t('admin.aiSettings.apiKeyNotSet')}
                </span>
                {apiOk && data?.apiKeyViaEnv && (
                  <span className="text-xs text-muted-foreground">(ENV)</span>
                )}
                {apiOk && data?.hasApiKey && !data?.apiKeyViaEnv && (
                  <span className="text-xs text-muted-foreground">(DB)</span>
                )}
              </div>
              {data?.fallbackConfigured && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-muted-foreground">{t('admin.aiSettings.fallbackKeyConfigured')}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('admin.aiSettings.rateLimiting')}</CardTitle>
            <CardDescription>
              {t('admin.aiSettings.rateLimitingDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <RoleLimitControl
              label={t('admin.aiSettings.guests')}
              enabled={settings.guestLimits.enabled}
              requestsPerHour={settings.guestLimits.requestsPerHour}
              onEnabledChange={(v) =>
                update({ guestLimits: { ...settings.guestLimits, enabled: v } })
              }
              onLimitChange={(v) =>
                update({ guestLimits: { ...settings.guestLimits, requestsPerHour: v } })
              }
              t={t}
            />
            <RoleLimitControl
              label={t('admin.aiSettings.authenticatedUsers')}
              enabled={settings.userLimits.enabled}
              requestsPerHour={settings.userLimits.requestsPerHour}
              onEnabledChange={(v) =>
                update({ userLimits: { ...settings.userLimits, enabled: v } })
              }
              onLimitChange={(v) =>
                update({ userLimits: { ...settings.userLimits, requestsPerHour: v } })
              }
              t={t}
            />
            <RoleLimitControl
              label={t('admin.aiSettings.administrators')}
              enabled={settings.adminLimits.enabled}
              requestsPerHour={settings.adminLimits.requestsPerHour}
              onEnabledChange={(v) =>
                update({ adminLimits: { ...settings.adminLimits, enabled: v } })
              }
              onLimitChange={(v) =>
                update({ adminLimits: { ...settings.adminLimits, requestsPerHour: v } })
              }
              t={t}
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? t('admin.aiSettings.saving') : t('admin.aiSettings.saveSettings')}
        </Button>
        <Button variant="outline" onClick={onBack}>
          {t('admin.aiSettings.cancel')}
        </Button>
      </div>
    </div>
  );
}
