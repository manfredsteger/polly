import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, ClipboardList, Plus, Trash2, Users, Clock, Info, Mail, CheckCircle, QrCode, Link as LinkIcon, CalendarDays, Bell, Sparkles, Coffee, Repeat, Timer } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { useAuth } from "@/contexts/AuthContext";

interface OrgaSlot {
  text: string;
  startTime?: string;
  endTime?: string;
  maxCapacity?: number;
  order: number;
}

interface OrgaTemplate {
  id: string;
  nameKey: string;
  descriptionKey: string;
  icon: typeof Clock;
  slots: { description: string; startTime: string; endTime: string; capacity?: number }[];
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

interface OrgaFormData {
  title: string;
  description: string;
  creatorEmail: string;
  allowMultipleSlots: boolean;
  allowVoteEdit: boolean;
  allowVoteWithdrawal: boolean;
  resultsPublic: boolean;
  slots: OrgaSlot[];
  expiresAt: string | null;
  isDayMode?: boolean;
  dayModeDate?: string;
}

export default function CreateOrganization() {
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
  const [allowMultipleSlots, setAllowMultipleSlots] = useState(true);
  const [allowVoteEdit, setAllowVoteEdit] = useState(false);
  const [allowVoteWithdrawal, setAllowVoteWithdrawal] = useState(false);
  const [resultsPublic, setResultsPublic] = useState(true);
  const [isDayMode, setIsDayMode] = useState(false);
  const [dayModeDate, setDayModeDate] = useState<string>("");
  const [slotDuration, setSlotDuration] = useState(30);
  const [slots, setSlots] = useState<OrgaSlot[]>([
    { text: "", maxCapacity: undefined, order: 0 }
  ]);

  const formPersistence = useFormPersistence<OrgaFormData>({ key: 'create-organization' });
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
      setAllowMultipleSlots(stored.data.allowMultipleSlots ?? true);
      setAllowVoteEdit(stored.data.allowVoteEdit ?? false);
      setAllowVoteWithdrawal(stored.data.allowVoteWithdrawal ?? false);
      setResultsPublic(stored.data.resultsPublic ?? true);
      setIsDayMode(stored.data.isDayMode ?? false);
      setDayModeDate(stored.data.dayModeDate ?? "");
      if (stored.data.slots && stored.data.slots.length >= 1) {
        setSlots(stored.data.slots);
      }
      if (stored.data.expiresAt) {
        setExpiresAt(new Date(stored.data.expiresAt));
      }
      
      if (stored.pendingSubmit) {
        toast({
          title: t('pollCreation.welcomeBack'),
          description: t('pollCreation.formRestoredOrga'),
        });
      }
    }
  }, []);

  const combineDateTime = (date: string, time: string): string | undefined => {
    if (!date || !time) return undefined;
    if (time.includes('T')) return undefined;
    try {
      const combined = new Date(`${date}T${time}`);
      if (isNaN(combined.getTime())) return undefined;
      return combined.toISOString();
    } catch {
      return undefined;
    }
  };

  const buildOptionsPayload = (slotsData: OrgaSlot[], useDayMode: boolean, dayDate: string) => {
    return slotsData.filter(s => s.text.trim()).map((slot, idx) => {
      let startTimeISO: string | undefined;
      let endTimeISO: string | undefined;
      
      if (useDayMode && dayDate) {
        startTimeISO = combineDateTime(dayDate, slot.startTime || "");
        endTimeISO = combineDateTime(dayDate, slot.endTime || "");
      } else if (!useDayMode && slot.startTime) {
        if (slot.startTime.includes('T')) {
          try {
            const parsed = new Date(slot.startTime);
            if (!isNaN(parsed.getTime())) {
              startTimeISO = parsed.toISOString();
            }
          } catch {}
        }
        if (slot.endTime && slot.endTime.includes('T')) {
          try {
            const parsed = new Date(slot.endTime);
            if (!isNaN(parsed.getTime())) {
              endTimeISO = parsed.toISOString();
            }
          } catch {}
        }
      }
      
      return {
        text: slot.text.trim(),
        startTime: startTimeISO,
        endTime: endTimeISO,
        maxCapacity: slot.maxCapacity,
        order: idx,
      };
    });
  };

  useEffect(() => {
    if (autoSubmitTriggeredRef.current) return;
    if (!hasRestoredRef.current) return;
    if (!isAuthenticated) return;
    
    const stored = formPersistence.getStoredData();
    const validSlots = slots.filter(s => s.text.trim());
    if (stored?.pendingSubmit && stored.data && title && validSlots.length >= 1) {
      autoSubmitTriggeredRef.current = true;
      
      const storedExpiresAt = stored.data.expiresAt;
      const storedIsDayMode = stored.data.isDayMode ?? false;
      const storedDayModeDate = stored.data.dayModeDate ?? "";
      formPersistence.clearStoredData();
      
      toast({
        title: t('pollCreation.autoSubmitting'),
        description: t('createOrganization.autoSubmitDescription'),
      });
      
      setTimeout(() => {
        const orgaData = {
          title: title.trim(),
          description: description.trim() || undefined,
          type: "organization" as const,
          expiresAt: storedExpiresAt || undefined,
          allowMultipleSlots: allowMultipleSlots,
          allowVoteEdit: allowVoteEdit,
          allowVoteWithdrawal: allowVoteWithdrawal,
          resultsPublic: resultsPublic,
          options: buildOptionsPayload(validSlots, storedIsDayMode, storedDayModeDate),
        };
        createPollMutation.mutate(orgaData);
      }, 500);
    }
  }, [isAuthenticated, title, slots]);

  const createPollMutation = useMutation({
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
        pollType: 'organization'
      };
      sessionStorage.setItem('poll-success-data', JSON.stringify(successData));
      setLocation("/success");
    },
    onError: async (error: any) => {
      let errorMessage = t('createOrganization.createError');
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
          { title, description, creatorEmail, allowMultipleSlots, allowVoteEdit, allowVoteWithdrawal, resultsPublic, slots, expiresAt: expiresAt ? expiresAt.toISOString() : null, isDayMode, dayModeDate },
          '/create-organization'
        );
        
        setTimeout(() => {
          const emailParam = creatorEmail ? `&email=${encodeURIComponent(creatorEmail)}` : '';
          setLocation(`/anmelden?returnTo=/create-organization${emailParam}`);
        }, 2000);
      }
    },
  });

  const addSlot = () => {
    setSlots([...slots, { text: "", maxCapacity: undefined, order: slots.length }]);
  };

  const applyTemplate = (templateId: string) => {
    const templateSlots = getTemplateSlots(templateId);
    const newSlots: OrgaSlot[] = templateSlots.map((s, idx) => ({
      text: s.description,
      startTime: s.startTime,
      endTime: s.endTime,
      maxCapacity: s.capacity,
      order: idx,
    }));
    setSlots(newSlots);
    toast({
      title: t('createOrganization.templateApplied'),
      description: t('createOrganization.templateAppliedDescription', { count: newSlots.length }),
    });
  };

  const generateSlotsFromDuration = (startHour: number, endHour: number, durationMinutes: number, description: string, capacity?: number) => {
    const newSlots: OrgaSlot[] = [];
    let current = startHour * 60;
    const end = endHour * 60;
    let idx = 0;
    while (current + durationMinutes <= end) {
      const startH = Math.floor(current / 60).toString().padStart(2, '0');
      const startM = (current % 60).toString().padStart(2, '0');
      const endMin = current + durationMinutes;
      const endH = Math.floor(endMin / 60).toString().padStart(2, '0');
      const endM = (endMin % 60).toString().padStart(2, '0');
      newSlots.push({
        text: `${description} ${idx + 1}`,
        startTime: `${startH}:${startM}`,
        endTime: `${endH}:${endM}`,
        maxCapacity: capacity,
        order: idx,
      });
      current = endMin;
      idx++;
    }
    return newSlots;
  };

  const getTemplateSlots = (templateId: string): OrgaTemplate['slots'] => {
    const label = t('createOrganization.templates.slotLabel');
    switch (templateId) {
      case 'morning-slots':
        return generateSlotsFromDuration(8, 12, slotDuration, label, 5).map(s => ({
          description: s.text, startTime: s.startTime!, endTime: s.endTime!, capacity: s.maxCapacity,
        }));
      case 'afternoon-slots':
        return generateSlotsFromDuration(13, 17, slotDuration, label, 5).map(s => ({
          description: s.text, startTime: s.startTime!, endTime: s.endTime!, capacity: s.maxCapacity,
        }));
      case 'full-day':
        return generateSlotsFromDuration(8, 17, slotDuration, label, 5).map(s => ({
          description: s.text, startTime: s.startTime!, endTime: s.endTime!, capacity: s.maxCapacity,
        }));
      case 'consultation':
        return generateSlotsFromDuration(9, 11, 20, t('createOrganization.templates.consultSlot', { num: '' }), 1)
          .map((s, i) => ({
            description: t('createOrganization.templates.consultSlot', { num: i + 1 }),
            startTime: s.startTime!, endTime: s.endTime!, capacity: 1,
          }));
      default:
        return [];
    }
  };

  const orgaTemplateDefinitions = [
    { id: "morning-slots", nameKey: "createOrganization.templates.morningSlots.name", descriptionKey: "createOrganization.templates.morningSlots.description", icon: Coffee },
    { id: "afternoon-slots", nameKey: "createOrganization.templates.afternoonSlots.name", descriptionKey: "createOrganization.templates.afternoonSlots.description", icon: Clock },
    { id: "full-day", nameKey: "createOrganization.templates.fullDay.name", descriptionKey: "createOrganization.templates.fullDay.description", icon: Repeat },
    { id: "consultation", nameKey: "createOrganization.templates.consultation.name", descriptionKey: "createOrganization.templates.consultation.description", icon: Sparkles },
  ];

  const removeSlot = (index: number) => {
    if (slots.length > 1) {
      setSlots(slots.filter((_, i) => i !== index));
    }
  };

  const updateSlot = (index: number, updates: Partial<OrgaSlot>) => {
    const newSlots = [...slots];
    newSlots[index] = { ...newSlots[index], ...updates };
    setSlots(newSlots);
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

    const validSlots = slots.filter(s => s.text.trim());
    if (validSlots.length < 1) {
      toast({
        title: t('pollCreation.error'),
        description: t('createOrganization.minSlotsError'),
        variant: "destructive",
      });
      return;
    }

    if (isDayMode && !dayModeDate) {
      toast({
        title: t('pollCreation.error'),
        description: t('createOrganization.dayModeDateError'),
        variant: "destructive",
      });
      return;
    }

    for (const slot of validSlots) {
      if (slot.startTime && slot.endTime && slot.startTime === slot.endTime) {
        toast({
          title: t('pollCreation.error'),
          description: t('createOrganization.slotTimeError', { name: slot.text }),
          variant: "destructive",
        });
        return;
      }
    }

    if (!isAuthenticated && !creatorEmail.trim()) {
      toast({
        title: t('pollCreation.error'),
        description: t('pollCreation.pleaseEnterEmail'),
        variant: "destructive",
      });
      return;
    }

    const pollData = {
      title: title.trim(),
      description: description.trim() || undefined,
      type: "organization" as const,
      creatorEmail: isAuthenticated ? undefined : creatorEmail.trim(),
      expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
      enableExpiryReminder: expiresAt ? enableExpiryReminder : false,
      expiryReminderHours: expiresAt && enableExpiryReminder ? expiryReminderHours : undefined,
      allowMultipleSlots,
      allowVoteEdit,
      allowVoteWithdrawal,
      resultsPublic,
      options: buildOptionsPayload(validSlots, isDayMode, dayModeDate),
    };

    createPollMutation.mutate(pollData);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/")}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('pollCreation.back')}
        </Button>
        <h1 className="text-3xl font-bold text-foreground" data-testid="title-create-orga">{t('createOrganization.pageTitle')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('createOrganization.pageSubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <ClipboardList className="w-5 h-5 mr-2 text-green-600" />
              {t('pollCreation.basicInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="title">{t('createOrganization.titleLabel')}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('createOrganization.titlePlaceholder')}
                className="mt-1"
                required
                data-testid="input-title"
              />
            </div>
            
            <div>
              <Label htmlFor="description">{t('pollCreation.descriptionOptional')}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('createOrganization.descriptionPlaceholder')}
                className="mt-1"
                rows={3}
                data-testid="input-description"
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
                {t('pollCreation.expiryHintOrga')}
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

        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2 text-green-600" />
              {t('createOrganization.settings')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('createOrganization.allowMultipleSlots')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('createOrganization.allowMultipleSlotsDescription')}
                </p>
              </div>
              <Switch
                checked={allowMultipleSlots}
                onCheckedChange={setAllowMultipleSlots}
                data-testid="switch-multiple-slots"
                aria-label={t('createOrganization.allowMultipleSlots')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('pollCreation.allowVoteEdit')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('createOrganization.allowEntryEditDescription')}
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
                  {t('createOrganization.allowEntryWithdrawalDescription')}
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
          </CardContent>
        </Card>

        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Clock className="w-5 h-5 mr-2 text-green-600" />
                {t('createOrganization.slots')}
              </span>
              <Button type="button" onClick={addSlot} variant="outline" size="sm" data-testid="button-add-slot">
                <Plus className="w-4 h-4 mr-2" />
                {t('createOrganization.addSlot')}
              </Button>
            </CardTitle>
            <CardDescription className="flex items-start gap-2 mt-2">
              <Info className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <span>
                {t('createOrganization.slotsHint')}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center gap-3">
                <CalendarDays className="w-5 h-5 text-blue-600" />
                <div className="space-y-0.5">
                  <Label className="font-medium">{t('createOrganization.dayOrganization')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('createOrganization.dayOrganizationDescription')}
                  </p>
                </div>
              </div>
              <Switch
                checked={isDayMode}
                onCheckedChange={(checked) => {
                  setIsDayMode(checked);
                  if (checked) {
                    const extractTime = (dt: string | undefined): string | undefined => {
                      if (!dt) return undefined;
                      if (dt.includes('T')) {
                        const timePart = dt.split('T')[1];
                        return timePart ? timePart.substring(0, 5) : undefined;
                      }
                      return dt.length === 5 ? dt : undefined;
                    };
                    setSlots(slots.map(s => ({ 
                      ...s, 
                      startTime: extractTime(s.startTime),
                      endTime: extractTime(s.endTime)
                    })));
                  } else {
                    setDayModeDate("");
                    setSlots(slots.map(s => ({ ...s, startTime: undefined, endTime: undefined })));
                  }
                }}
                data-testid="switch-day-mode"
                aria-label={t('createOrganization.dayOrganization')}
              />
            </div>
            
            {isDayMode && (
              <>
                <div className="p-4 border rounded-lg bg-muted/30">
                  <Label className="flex items-center gap-2 mb-2">
                    <CalendarDays className="w-4 h-4" />
                    {t('createOrganization.dateForAllSlots')}
                  </Label>
                  <DatePicker
                    date={dayModeDate ? (() => { const [y, m, d] = dayModeDate.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0); })() : null}
                    onDateChange={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        setDayModeDate(`${year}-${month}-${day}`);
                      } else {
                        setDayModeDate("");
                      }
                    }}
                    minDate={new Date()}
                    placeholder={t('createOrganization.selectDate')}
                    showClearButton={true}
                    data-testid="input-day-mode-date"
                  />
                </div>

                <div className="p-4 border rounded-lg bg-muted/30">
                  <Label className="flex items-center gap-2 mb-2">
                    <Timer className="w-4 h-4" />
                    {t('createOrganization.slotDuration')}
                  </Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[slotDuration]}
                      onValueChange={(val) => setSlotDuration(val[0])}
                      min={15}
                      max={120}
                      step={15}
                      className="flex-1"
                      data-testid="slider-duration"
                    />
                    <span className="text-sm font-medium whitespace-nowrap min-w-[60px] text-right" data-testid="duration-value">
                      {slotDuration} {t('createOrganization.minutes')}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1 px-1">
                    {DURATION_OPTIONS.map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSlotDuration(d)}
                        className={`px-1 rounded transition-colors ${slotDuration === d ? 'text-primary font-medium' : 'hover:text-foreground'}`}
                      >
                        {d}m
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <Label className="font-medium">{t('createOrganization.templates.title')}</Label>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('createOrganization.templates.subtitle')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {orgaTemplateDefinitions.map((template) => {
                      const Icon = template.icon;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => applyTemplate(template.id)}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-colors text-left group"
                          data-testid={`template-${template.id}`}
                        >
                          <Icon className="w-5 h-5 mt-0.5 text-amber-500 group-hover:text-amber-400 shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{t(template.nameKey)}</p>
                            <p className="text-xs text-muted-foreground">{t(template.descriptionKey)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 p-2 rounded bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-300">
                    💡 {t('createOrganization.templates.tip')}
                  </div>
                </div>
              </>
            )}
            
            {slots.map((slot, index) => (
              <div 
                key={index} 
                className="border rounded-lg p-4 bg-muted/30"
                data-testid={`slot-${index}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-4">
                    <div>
                      <Label>{t('createOrganization.slotDescription')}</Label>
                      <Input
                        value={slot.text}
                        onChange={(e) => updateSlot(index, { text: e.target.value })}
                        placeholder={t('createOrganization.slotDescriptionPlaceholder')}
                        className="mt-1"
                        data-testid={`input-slot-text-${index}`}
                      />
                    </div>
                    
                    {isDayMode ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>{t('createOrganization.fromTime')}</Label>
                          <div className="mt-1">
                            <TimePicker
                              time={slot.startTime}
                              onTimeChange={(time) => updateSlot(index, { startTime: time })}
                              placeholder={t('createOrganization.startTime')}
                              data-testid={`input-slot-start-${index}`}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>{t('createOrganization.toTime')}</Label>
                          <div className="mt-1">
                            <TimePicker
                              time={slot.endTime}
                              onTimeChange={(time) => updateSlot(index, { endTime: time })}
                              placeholder={t('createOrganization.endTime')}
                              data-testid={`input-slot-end-${index}`}
                            />
                          </div>
                          {slot.startTime && slot.endTime && slot.startTime === slot.endTime && (
                            <p className="text-xs text-destructive mt-1">
                              {t('createOrganization.timesMustDiffer')}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>{t('createOrganization.maxSpots')}</Label>
                          <Input
                            type="number"
                            min={1}
                            value={slot.maxCapacity ?? ""}
                            onChange={(e) => updateSlot(index, { maxCapacity: e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : undefined })}
                            placeholder={t('createOrganization.unlimitedPlaceholder')}
                            className="mt-1"
                            data-testid={`input-slot-capacity-${index}`}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>{t('createOrganization.fromOptional')}</Label>
                          <div className="mt-1">
                            <DateTimePicker
                              value={slot.startTime}
                              onChange={(value) => updateSlot(index, { startTime: value })}
                              placeholder={t('createOrganization.dateTimePlaceholder')}
                              data-testid={`input-slot-start-${index}`}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>{t('createOrganization.toOptional')}</Label>
                          <div className="mt-1">
                            <DateTimePicker
                              value={slot.endTime}
                              onChange={(value) => updateSlot(index, { endTime: value })}
                              placeholder={t('createOrganization.dateTimePlaceholder')}
                              data-testid={`input-slot-end-${index}`}
                            />
                          </div>
                          {slot.startTime && slot.endTime && slot.startTime === slot.endTime && (
                            <p className="text-xs text-destructive mt-1">
                              {t('createOrganization.timesMustDiffer')}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>{t('createOrganization.maxSpots')}</Label>
                          <Input
                            type="number"
                            min={1}
                            value={slot.maxCapacity ?? ""}
                            onChange={(e) => updateSlot(index, { maxCapacity: e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : undefined })}
                            placeholder={t('createOrganization.unlimitedPlaceholder')}
                            className="mt-1"
                            data-testid={`input-slot-capacity-${index}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {slots.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSlot(index)}
                      className="text-destructive hover:text-destructive"
                      aria-label={t('createOrganization.removeSlot')}
                      data-testid={`button-remove-slot-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
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
            disabled={createPollMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
            data-testid="button-submit"
          >
            {createPollMutation.isPending ? t('createOrganization.creatingButton') : t('createOrganization.submitButton')}
          </Button>
        </div>
      </form>
    </div>
  );
}
