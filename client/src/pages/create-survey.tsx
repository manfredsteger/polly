import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Vote, Mail, Plus, Trash2, CheckCircle, QrCode, Link as LinkIcon, Info, Bell, ChevronDown, MessageSquare, GripVertical } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { ImageUpload } from "@/components/ImageUpload";
import { useAuth } from "@/contexts/AuthContext";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SurveyOption {
  id: string;
  text: string;
  imageUrl?: string;
  altText?: string;
  isFreeText?: boolean;
  order: number;
}

let optionIdCounter = 0;
function nextOptionId() {
  return `opt-${++optionIdCounter}-${Date.now()}`;
}

function SortableWrapper({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-1">
      <button
        type="button"
        className="mt-4 p-1 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

interface SurveyFormData {
  title: string;
  description: string;
  creatorEmail: string;
  options: SurveyOption[];
  allowVoteEdit: boolean;
  allowVoteWithdrawal: boolean;
  resultsPublic: boolean;
  allowMaybe: boolean;
  expiresAt: string | null;
}

export default function CreateSurvey() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creatorEmail, setCreatorEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [enableExpiryReminder, setEnableExpiryReminder] = useState(false);
  const [expiryReminderHours, setExpiryReminderHours] = useState(24);
  const [allowVoteEdit, setAllowVoteEdit] = useState(false);
  const [allowVoteWithdrawal, setAllowVoteWithdrawal] = useState(false);
  const [resultsPublic, setResultsPublic] = useState(true);
  const [allowMaybe, setAllowMaybe] = useState(true);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [options, setOptions] = useState<SurveyOption[]>([
    { id: nextOptionId(), text: "", order: 0 },
    { id: nextOptionId(), text: "", order: 1 },
  ]);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOptions((prev) => {
      const oldIndex = prev.findIndex((o) => o.id === active.id);
      const newIndex = prev.findIndex((o) => o.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const formPersistence = useFormPersistence<SurveyFormData>({ key: 'create-survey' });
  const hasRestoredRef = useRef(false);
  const autoSubmitTriggeredRef = useRef(false);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    
    const stored = formPersistence.getStoredData();
    if (stored && stored.data) {
      hasRestoredRef.current = true;
      setTitle(stored.data.title || "");
      setDescription(stored.data.description || "");
      setCreatorEmail(stored.data.creatorEmail || "");
      setAllowVoteEdit(stored.data.allowVoteEdit ?? false);
      setAllowVoteWithdrawal(stored.data.allowVoteWithdrawal ?? false);
      setResultsPublic(stored.data.resultsPublic ?? true);
      setAllowMaybe(stored.data.allowMaybe ?? true);
      if (stored.data.options && stored.data.options.length >= 2) {
        setOptions(stored.data.options.map((o: any) => ({ ...o, id: o.id || nextOptionId() })));
      }
      if (stored.data.expiresAt) {
        setExpiresAt(new Date(stored.data.expiresAt));
      }
      
      if (stored.pendingSubmit) {
        toast({
          title: t('pollCreation.welcomeBack'),
          description: t('pollCreation.formRestored'),
        });
      }
    }
  }, []);

  // Read AI suggestion from sessionStorage if present
  useEffect(() => {
    const raw = sessionStorage.getItem("ai-suggestion");
    if (!raw) return;
    try {
      const suggestion = JSON.parse(raw);
      if (suggestion.pollType !== "survey") return;
      sessionStorage.removeItem("ai-suggestion");
      if (suggestion.title) setTitle(suggestion.title);
      if (suggestion.description) setDescription(suggestion.description);
      if (Array.isArray(suggestion.options) && suggestion.options.length >= 1) {
        setOptions(suggestion.options.map((opt: any, i: number) => {
          if (typeof opt === "string") return { id: nextOptionId(), text: opt, order: i };
          return { id: nextOptionId(), text: opt.text || "", isFreeText: opt.isFreeText ?? false, order: i };
        }));
      }
      const s = suggestion.settings;
      if (s && typeof s === "object") {
        if (typeof s.resultsPublic === "boolean") setResultsPublic(s.resultsPublic);
        if (typeof s.allowVoteEdit === "boolean") setAllowVoteEdit(s.allowVoteEdit);
        if (typeof s.allowVoteWithdrawal === "boolean") setAllowVoteWithdrawal(s.allowVoteWithdrawal);
        if (typeof s.allowMaybe === "boolean") setAllowMaybe(s.allowMaybe);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (autoSubmitTriggeredRef.current) return;
    if (!hasRestoredRef.current) return;
    if (!isAuthenticated) return;
    
    const stored = formPersistence.getStoredData();
    const validOptions = options.filter(o => o.text.trim());
    if (stored?.pendingSubmit && stored.data && title && validOptions.length >= 2) {
      autoSubmitTriggeredRef.current = true;
      
      const storedExpiresAt = stored.data.expiresAt;
      formPersistence.clearStoredData();
      
      toast({
        title: t('pollCreation.autoSubmitting'),
        description: t('createSurvey.autoSubmitDescription'),
      });
      
      setTimeout(() => {
        const surveyData = {
          title: title.trim(),
          description: description.trim() || undefined,
          type: "survey" as const,
          expiresAt: storedExpiresAt || undefined,
          allowVoteEdit: allowVoteEdit,
          allowVoteWithdrawal: allowVoteWithdrawal,
          resultsPublic: resultsPublic,
          options: validOptions.map((option, index) => ({
            text: option.text,
            imageUrl: option.imageUrl,
            altText: option.altText,
            order: index,
          })),
        };
        createSurveyMutation.mutate(surveyData);
      }, 500);
    }
  }, [isAuthenticated, title, options]);

  const createSurveyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/v1/polls", data);
      return response.json();
    },
    onSuccess: (data) => {
      formPersistence.clearStoredData();
      
      const successData = {
        poll: data.poll,
        publicLink: `/poll/${data.publicToken}`,
        adminLink: `/admin/${data.adminToken}`,
        pollType: 'survey'
      };
      sessionStorage.setItem('poll-success-data', JSON.stringify(successData));
      
      setLocation("/success");
    },
    onError: async (error: any) => {
      let errorMessage = t('createSurvey.createError');
      let requiresLogin = false;
      
      if (error?.message) {
        try {
          const errorData = JSON.parse(error.message.split(': ').slice(1).join(': '));
          if (errorData.errorCode === 'REQUIRES_LOGIN') {
            errorMessage = errorData.error;
            requiresLogin = true;
          }
        } catch {}
      }
      
      toast({
        title: requiresLogin ? t('pollCreation.loginRequired') : t('pollCreation.error'),
        description: requiresLogin 
          ? t('pollCreation.loginRequiredDescription')
          : errorMessage,
        variant: "destructive",
      });
      
      if (requiresLogin) {
        formPersistence.saveBeforeRedirect(
          { title, description, creatorEmail, options, allowVoteEdit, allowVoteWithdrawal, resultsPublic, allowMaybe, expiresAt: expiresAt ? expiresAt.toISOString() : null },
          '/create-survey'
        );
        
        setTimeout(() => {
          const emailParam = creatorEmail ? `&email=${encodeURIComponent(creatorEmail)}` : '';
          setLocation(`/anmelden?returnTo=/create-survey${emailParam}`);
        }, 2000);
      }
    },
  });

  const addOption = () => {
    setOptions([...options, { id: nextOptionId(), text: "", order: options.length }]);
  };

  const addFreeTextQuestion = () => {
    setOptions([...options, { id: nextOptionId(), text: "", isFreeText: true, order: options.length }]);
  };

  const removeOption = (index: number) => {
    const nonFreeText = options.filter(o => !o.isFreeText);
    const freeText = options.filter(o => o.isFreeText);
    const item = options[index];
    if (item.isFreeText) {
      setOptions(options.filter((_, i) => i !== index));
    } else if (nonFreeText.length > 2 || freeText.length > 0) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, text: string) => {
    const updatedOptions = [...options];
    updatedOptions[index].text = text;
    setOptions(updatedOptions);
  };

  const updateOptionImage = (index: number, imageUrl: string) => {
    const updatedOptions = [...options];
    updatedOptions[index].imageUrl = imageUrl;
    setOptions(updatedOptions);
  };

  const updateOptionAltText = (index: number, altText: string) => {
    const updatedOptions = [...options];
    updatedOptions[index].altText = altText;
    setOptions(updatedOptions);
  };

  const removeOptionImage = (index: number) => {
    const updatedOptions = [...options];
    delete updatedOptions[index].imageUrl;
    delete updatedOptions[index].altText;
    setOptions(updatedOptions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: t('pollCreation.error'),
        description: t('pollCreation.pleaseEnterTitle'),
        variant: "destructive",
      });
      return;
    }

    const validOptions = options.filter(opt => opt.text.trim());
    const validNormalOptions = validOptions.filter(opt => !opt.isFreeText);
    const validFreeTextOptions = validOptions.filter(opt => opt.isFreeText);
    // Need at least: 2 normal options, OR 1 free-text question (pure feedback form), OR 1 normal + 1 free-text
    if (validOptions.length < 1 || (validFreeTextOptions.length === 0 && validNormalOptions.length < 2)) {
      toast({
        title: t('pollCreation.error'),
        description: t('createSurvey.minOptionsError'),
        variant: "destructive",
      });
      return;
    }

    if (!isAuthenticated && !creatorEmail.trim()) {
      toast({
        title: t('pollCreation.error'),
        description: t('pollCreation.pleaseEnterEmail'),
        variant: "destructive",
      });
      return;
    }

    const surveyData = {
      title: title.trim(),
      description: description.trim() || undefined,
      type: "survey" as const,
      creatorEmail: isAuthenticated ? undefined : creatorEmail.trim(),
      expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
      enableExpiryReminder: expiresAt ? enableExpiryReminder : false,
      expiryReminderHours: expiresAt && enableExpiryReminder ? expiryReminderHours : undefined,
      allowVoteEdit,
      allowVoteWithdrawal,
      resultsPublic,
      allowMaybe,
      options: validOptions.map((option, index) => {
        const opt: any = {
          text: option.text.trim(),
          isFreeText: option.isFreeText ?? false,
          order: index,
        };
        if (!option.isFreeText && option.imageUrl && option.imageUrl.trim()) {
          opt.imageUrl = option.imageUrl.trim();
          if (option.altText && option.altText.trim()) {
            opt.altText = option.altText.trim();
          }
        }
        return opt;
      }),
    };

    createSurveyMutation.mutate(surveyData);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('pollCreation.back')}
        </Button>
        <h1 className="text-3xl font-bold text-foreground">{t('createSurvey.pageTitle')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('createSurvey.pageSubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Vote className="w-5 h-5 mr-2 text-polly-orange" />
              {t('pollCreation.basicInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="title">{t('createSurvey.titleLabel')}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('createSurvey.titlePlaceholder')}
                className="mt-1"
                required
                data-testid="input-title"
              />
            </div>
            
            <div>
              <Label htmlFor="description">{t('pollCreation.descriptionOptional')}</Label>
              <MarkdownEditor
                id="description"
                value={description}
                onChange={setDescription}
                placeholder={t('createSurvey.descriptionPlaceholder')}
                className="mt-1"
                rows={4}
              />
            </div>

            <div>
              <Label>{t('pollCreation.expiryDateOptional')}</Label>
              <div className="mt-1">
                <DatePicker
                  date={expiresAt}
                  onDateChange={setExpiresAt}
                  placeholder={t('pollCreation.datePlaceholder')}
                  minDate={new Date()}
                  data-testid="input-expires-at"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('pollCreation.expiryHint')}
              </p>
            </div>

            {expiresAt && (() => {
              const hoursUntilExpiry = Math.max(0, (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));
              const isTooShort = hoursUntilExpiry < 6;
              const maxReminderHours = Math.min(168, Math.floor(hoursUntilExpiry * 0.8));
              
              return (
                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        {t('pollCreation.expiryReminder')}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {isTooShort 
                          ? t('pollCreation.expiryTooShort', { hours: hoursUntilExpiry.toFixed(0) })
                          : t('pollCreation.expiryReminderDescription')
                        }
                      </p>
                    </div>
                    <Switch
                      checked={enableExpiryReminder && !isTooShort}
                      onCheckedChange={setEnableExpiryReminder}
                      disabled={isTooShort}
                      data-testid="switch-expiry-reminder"
                    />
                  </div>
                  
                  {enableExpiryReminder && !isTooShort && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Label htmlFor="reminderHours" className="shrink-0">{t('pollCreation.sendReminder')}</Label>
                        <Input
                          id="reminderHours"
                          type="number"
                          min={1}
                          max={maxReminderHours}
                          value={Math.min(expiryReminderHours, maxReminderHours)}
                          onChange={(e) => setExpiryReminderHours(Math.min(parseInt(e.target.value) || 24, maxReminderHours))}
                          className="w-20"
                          data-testid="input-reminder-hours"
                        />
                        <span className="text-sm text-muted-foreground">{t('pollCreation.hoursBeforeExpiry')}</span>
                      </div>
                      {expiryReminderHours > maxReminderHours && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {t('pollCreation.maxReminderHours', { hours: maxReminderHours })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            
            <div className="pt-4 border-t">
              <button
                type="button"
                onClick={() => setSettingsExpanded(p => !p)}
                className="flex items-center justify-between w-full text-left"
                aria-expanded={settingsExpanded}
              >
                <span className="text-sm font-medium text-muted-foreground">{t('pollCreation.settings')}</span>
                <div className="flex items-center gap-2">
                  {!settingsExpanded && (
                    <div className="flex gap-1">
                      {allowVoteEdit && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t('pollCreation.allowVoteEdit')}</span>}
                      {!resultsPublic && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t('pollCreation.resultsPrivate')}</span>}
                    </div>
                  )}
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${settingsExpanded ? "rotate-180" : ""}`} />
                </div>
              </button>
              {settingsExpanded && (
                <div className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t('pollCreation.allowVoteEdit')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('pollCreation.allowVoteEditDescription')}
                      </p>
                    </div>
                    <Switch
                      checked={allowVoteEdit}
                      onCheckedChange={setAllowVoteEdit}
                      data-testid="switch-allow-vote-edit"
                      aria-label={t('pollCreation.allowVoteEdit')}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="space-y-0.5">
                      <Label>{t('pollCreation.allowVoteWithdrawal')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('pollCreation.allowVoteWithdrawalDescription')}
                      </p>
                    </div>
                    <Switch
                      checked={allowVoteWithdrawal}
                      onCheckedChange={setAllowVoteWithdrawal}
                      data-testid="switch-allow-vote-withdrawal"
                      aria-label={t('pollCreation.allowVoteWithdrawal')}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="space-y-0.5">
                      <Label>{t('pollCreation.resultsPublic')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('pollCreation.resultsPublicDescription')}
                      </p>
                    </div>
                    <Switch
                      checked={resultsPublic}
                      onCheckedChange={setResultsPublic}
                      data-testid="switch-results-public"
                      aria-label={t('pollCreation.resultsPublic')}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="space-y-0.5">
                      <Label>{t('createSurvey.allowMaybe')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('createSurvey.allowMaybeDescription')}
                      </p>
                    </div>
                    <Switch
                      checked={allowMaybe}
                      onCheckedChange={setAllowMaybe}
                      data-testid="switch-allow-maybe"
                      aria-label={t('createSurvey.allowMaybe')}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Vote className="w-5 h-5 mr-2 text-polly-blue" />
                {t('createSurvey.choices')}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFreeTextQuestion}
                  data-testid="button-add-free-text"
                  className="border-dashed text-muted-foreground hover:text-foreground"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {t('createSurvey.addFreeTextQuestion')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOption}
                  data-testid="button-add-option"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('createSurvey.addOption')}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {options.some(o => o.isFreeText) && options.some(o => !o.isFreeText)
                  ? t('createSurvey.optionsHintMixed')
                  : options.every(o => o.isFreeText) && options.length > 0
                    ? t('createSurvey.freeTextHint')
                    : t('createSurvey.optionsHint')}
              </p>
              
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={options.map((o) => o.id)} strategy={verticalListSortingStrategy}>
                  {options.map((option, index) => {
                    const normalIndex = options.slice(0, index + 1).filter(o => !o.isFreeText).length;
                    const freeTextIndex = options.slice(0, index + 1).filter(o => o.isFreeText).length;
                    const nonFreeTextCount = options.filter(o => !o.isFreeText).length;
                    const freeTextCount = options.filter(o => o.isFreeText).length;
                    const canDelete = option.isFreeText || nonFreeTextCount > 2 || freeTextCount > 0;

                    if (option.isFreeText) {
                      return (
                        <SortableWrapper key={option.id} id={option.id}>
                          <div className="border border-dashed border-primary/30 rounded-lg p-4 space-y-2 bg-primary/5">
                            <div className="flex items-center gap-2 mb-1">
                              <MessageSquare className="w-4 h-4 text-primary/60 shrink-0" />
                              <span className="text-xs font-medium text-primary/60 uppercase tracking-wide">
                                {t('createSurvey.freeTextQuestion')} {freeTextIndex}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Input
                                value={option.text}
                                onChange={(e) => updateOption(index, e.target.value)}
                                placeholder={t('createSurvey.freeTextQuestionPlaceholder')}
                                className="flex-1"
                                data-testid={`input-option-${index}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeOption(index)}
                                className="text-destructive hover:text-destructive"
                                aria-label={t('createSurvey.removeOption')}
                                data-testid={`button-delete-option-${index}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground pl-1">{t('createSurvey.freeTextHint')}</p>
                          </div>
                        </SortableWrapper>
                      );
                    }

                    return (
                      <SortableWrapper key={option.id} id={option.id}>
                        <div className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                              <span className="text-sm font-medium">{normalIndex}</span>
                            </div>
                            <Input
                              value={option.text}
                              onChange={(e) => updateOption(index, e.target.value)}
                              placeholder={t('createSurvey.optionPlaceholder', { number: normalIndex })}
                              className="flex-1"
                              data-testid={`input-option-${index}`}
                            />
                            {canDelete && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeOption(index)}
                                className="text-destructive hover:text-destructive"
                                aria-label={t('createSurvey.removeOption')}
                                data-testid={`button-delete-option-${index}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <div className="space-y-2">
                            <span className="text-sm text-muted-foreground">{t('createSurvey.addImage')}</span>
                            <ImageUpload
                              onImageUploaded={(imageUrl) => updateOptionImage(index, imageUrl)}
                              onImageRemoved={() => removeOptionImage(index)}
                              onAltTextChange={(altText) => updateOptionAltText(index, altText)}
                              currentImageUrl={option.imageUrl}
                              currentAltText={option.altText}
                            />
                          </div>
                        </div>
                      </SortableWrapper>
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">{t('createSurvey.tipTitle')}</h4>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                {t('createSurvey.tipContent')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
              {t('pollCreation.creationOptions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isAuthenticated ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-green-800 dark:text-green-200">
                      {t('pollCreation.loggedInAs', { name: user?.name || user?.username })}
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      {t('pollCreation.linksWillBeSentTo')} <strong>{user?.email}</strong>
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-green-700 dark:text-green-300">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="w-4 h-4" />
                        <span>{t('pollCreation.participationLink')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        <span>{t('pollCreation.privateAdminLink')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4" />
                        <span>{t('pollCreation.qrCodeShare')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Mail className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      {t('pollCreation.emailForNotifications')}
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      {t('pollCreation.emailNotificationDescription')}
                    </p>
                    <Input
                      type="email"
                      value={creatorEmail}
                      onChange={(e) => setCreatorEmail(e.target.value)}
                      placeholder={t('pollCreation.emailPlaceholder')}
                      className="mt-3"
                      required
                      data-testid="input-creator-email"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation("/")}
            data-testid="button-cancel"
          >
            {t('pollCreation.cancel')}
          </Button>
          <Button
            type="submit"
            className="polly-button-primary"
            disabled={createSurveyMutation.isPending}
            data-testid="button-submit"
          >
            {createSurveyMutation.isPending ? t('pollCreation.creating') : t('createSurvey.submitButton')}
          </Button>
        </div>
      </form>
    </div>
  );
}
