import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, ClipboardList, Plus, Trash2, Users, Clock, Info, Mail, CheckCircle, QrCode, Link as LinkIcon, CalendarDays, Bell } from "lucide-react";
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

interface OrgaFormData {
  title: string;
  description: string;
  creatorEmail: string;
  allowMultipleSlots: boolean;
  allowVoteEdit: boolean;
  resultsPublic: boolean;
  slots: OrgaSlot[];
  expiresAt: string | null;
  isDayMode?: boolean;
  dayModeDate?: string;
}

export default function CreateOrganization() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creatorEmail, setCreatorEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [enableExpiryReminder, setEnableExpiryReminder] = useState(false);
  const [expiryReminderHours, setExpiryReminderHours] = useState(24);
  const [allowMultipleSlots, setAllowMultipleSlots] = useState(true);
  const [allowVoteEdit, setAllowVoteEdit] = useState(false);
  const [resultsPublic, setResultsPublic] = useState(true);
  const [isDayMode, setIsDayMode] = useState(false);
  const [dayModeDate, setDayModeDate] = useState<string>("");
  const [slots, setSlots] = useState<OrgaSlot[]>([
    { text: "", maxCapacity: undefined, order: 0 }
  ]);

  // Form persistence for authentication redirects
  const formPersistence = useFormPersistence<OrgaFormData>({ key: 'create-organization' });
  const hasRestoredRef = useRef(false);
  const autoSubmitTriggeredRef = useRef(false);

  // Restore form data on mount if returning from login
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
          title: "Willkommen zurück!",
          description: "Ihre Eingaben wurden wiederhergestellt. Sie können die Orga jetzt absenden.",
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

  // Auto-submit after restoration if user is now authenticated
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
        title: "Automatisches Absenden...",
        description: "Ihre Orga wird jetzt erstellt.",
      });
      
      setTimeout(() => {
        const orgaData = {
          title: title.trim(),
          description: description.trim() || undefined,
          type: "organization" as const,
          expiresAt: storedExpiresAt || undefined,
          allowMultipleSlots: allowMultipleSlots,
          allowVoteEdit: allowVoteEdit,
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
      // Clear any stored form data on success
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
      // Check if it's a REQUIRES_LOGIN error
      let errorMessage = "Die Orga konnte nicht erstellt werden.";
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
        title: requiresLogin ? "Anmeldung erforderlich" : "Fehler",
        description: requiresLogin 
          ? "Diese E-Mail-Adresse gehört zu einem registrierten Konto. Bitte melden Sie sich an. Ihre Eingaben werden gespeichert."
          : errorMessage,
        variant: "destructive",
      });
      
      if (requiresLogin) {
        // Save form data before redirect
        formPersistence.saveBeforeRedirect(
          { title, description, creatorEmail, allowMultipleSlots, allowVoteEdit, resultsPublic, slots, expiresAt: expiresAt ? expiresAt.toISOString() : null, isDayMode, dayModeDate },
          '/create-organization'
        );
        
        // Redirect to login page with email pre-filled
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
        title: "Fehler",
        description: "Bitte geben Sie einen Titel ein.",
        variant: "destructive",
      });
      return;
    }

    const validSlots = slots.filter(s => s.text.trim());
    if (validSlots.length < 1) {
      toast({
        title: "Fehler",
        description: "Bitte fügen Sie mindestens einen Slot hinzu.",
        variant: "destructive",
      });
      return;
    }

    if (isDayMode && !dayModeDate) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie ein Datum für die Tagesorganisation.",
        variant: "destructive",
      });
      return;
    }

    for (const slot of validSlots) {
      if (slot.startTime && slot.endTime && slot.startTime === slot.endTime) {
        toast({
          title: "Fehler",
          description: `Slot "${slot.text}": Startzeit und Endzeit müssen unterschiedlich sein.`,
          variant: "destructive",
        });
        return;
      }
    }

    if (!isAuthenticated && !creatorEmail.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine E-Mail-Adresse ein.",
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
          Zurück
        </Button>
        <h1 className="text-3xl font-bold text-foreground" data-testid="title-create-orga">Orga erstellen</h1>
        <p className="text-muted-foreground mt-2">
          Erstellen Sie Eintragungsslots für Events, Helferlisten oder Mitbring-Listen.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <ClipboardList className="w-5 h-5 mr-2 text-green-600" />
              Grundinformationen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Sommerfest Helferliste oder Kuchenbasar"
                className="mt-1"
                required
                data-testid="input-title"
              />
            </div>
            
            <div>
              <Label htmlFor="description">Beschreibung (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Weitere Details zur Veranstaltung..."
                className="mt-1"
                rows={3}
                data-testid="input-description"
              />
            </div>

            <div>
              <Label>Laufzeit / Enddatum (optional)</Label>
              <div className="mt-1">
                <DatePicker
                  date={expiresAt}
                  onDateChange={setExpiresAt}
                  placeholder="tt.mm.jjjj"
                  minDate={new Date()}
                  data-testid="input-expires-at"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Nach diesem Datum können keine Eintragungen mehr erfolgen.
              </p>
            </div>

            {/* Expiry Reminder Option - only shown when expiry date is set */}
            {expiresAt && (() => {
              const hoursUntilExpiry = Math.max(0, (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));
              const isTooShort = hoursUntilExpiry < 6;
              const maxReminderHours = Math.min(168, Math.floor(hoursUntilExpiry * 0.8));
              
              return (
                <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        Erinnerung vor Ablauf
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {isTooShort 
                          ? `Die Umfrage endet in ${hoursUntilExpiry.toFixed(0)} Stunden - zu kurz für Erinnerungen`
                          : "Teilnehmer erhalten eine E-Mail-Erinnerung vor dem Ablaufdatum"
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
                        <Label htmlFor="reminderHours" className="shrink-0">Erinnerung senden</Label>
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
                        <span className="text-sm text-muted-foreground">Stunden vor Ablauf</span>
                      </div>
                      {expiryReminderHours > maxReminderHours && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Maximum für diese Umfrage: {maxReminderHours} Stunden
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
                      Angemeldet als {user?.name || user?.username}
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Sie erhalten alle Links an: <strong>{user?.email}</strong>
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-green-700 dark:text-green-300">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="w-4 h-4" />
                        <span>Teilnahme-Link zum Teilen</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        <span>Privater Administrations-Link (nur für Sie)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4" />
                        <span>QR-Code zum einfachen Teilen</span>
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
                      E-Mail-Adresse für Benachrichtigungen
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Sie erhalten per E-Mail einen Teilnahme-Link, einen Administrations-Link und einen QR-Code.
                    </p>
                    <Input
                      type="email"
                      value={creatorEmail}
                      onChange={(e) => setCreatorEmail(e.target.value)}
                      placeholder="ihre.email@kita-bayern.de"
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

        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2 text-green-600" />
              Einstellungen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Mehrfacheintragung erlauben</Label>
                <p className="text-sm text-muted-foreground">
                  Darf sich eine Person für mehrere Slots eintragen?
                </p>
              </div>
              <Switch
                checked={allowMultipleSlots}
                onCheckedChange={setAllowMultipleSlots}
                data-testid="switch-multiple-slots"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Stimmen ändern erlauben</Label>
                <p className="text-sm text-muted-foreground">
                  Dürfen Teilnehmende ihre Eintragungen nachträglich ändern?
                </p>
              </div>
              <Switch
                checked={allowVoteEdit}
                onCheckedChange={setAllowVoteEdit}
                data-testid="switch-allow-vote-edit"
              />
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <Label>Ergebnisse öffentlich</Label>
                <p className="text-sm text-muted-foreground">
                  Dürfen Teilnehmende die Ergebnisse einsehen?
                </p>
              </div>
              <Switch
                checked={resultsPublic}
                onCheckedChange={setResultsPublic}
                data-testid="switch-results-public"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Clock className="w-5 h-5 mr-2 text-green-600" />
                Slots
              </span>
              <Button type="button" onClick={addSlot} variant="outline" size="sm" data-testid="button-add-slot">
                <Plus className="w-4 h-4 mr-2" />
                Slot hinzufügen
              </Button>
            </CardTitle>
            <CardDescription className="flex items-start gap-2 mt-2">
              <Info className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <span>
                Slots können z.B. "14:00-14:30 Kuchen" oder "Getränke mitbringen" heißen. 
                Die Kapazität bestimmt, wie viele Personen sich pro Slot eintragen können.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center gap-3">
                <CalendarDays className="w-5 h-5 text-blue-600" />
                <div className="space-y-0.5">
                  <Label className="font-medium">Tagesorganisation</Label>
                  <p className="text-sm text-muted-foreground">
                    Einmal Datum wählen, dann nur noch Uhrzeiten eingeben - ideal für viele Zeitslots an einem Tag.
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
              />
            </div>
            
            {isDayMode && (
              <div className="p-4 border rounded-lg bg-muted/30">
                <Label className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  Datum für alle Slots *
                </Label>
                <Input
                  type="date"
                  value={dayModeDate}
                  onChange={(e) => setDayModeDate(e.target.value)}
                  className="mt-2 max-w-xs"
                  min={new Date().toISOString().split('T')[0]}
                  data-testid="input-day-mode-date"
                />
              </div>
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
                      <Label>Beschreibung *</Label>
                      <Input
                        value={slot.text}
                        onChange={(e) => updateSlot(index, { text: e.target.value })}
                        placeholder="z.B. 14:00-14:30 Kuchen oder Helfer Aufbau"
                        className="mt-1"
                        data-testid={`input-slot-text-${index}`}
                      />
                    </div>
                    
                    {isDayMode ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Von (Uhrzeit)</Label>
                          <div className="mt-1">
                            <TimePicker
                              time={slot.startTime}
                              onTimeChange={(time) => updateSlot(index, { startTime: time })}
                              placeholder="Startzeit"
                              data-testid={`input-slot-start-${index}`}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Bis (Uhrzeit)</Label>
                          <div className="mt-1">
                            <TimePicker
                              time={slot.endTime}
                              onTimeChange={(time) => updateSlot(index, { endTime: time })}
                              placeholder="Endzeit"
                              data-testid={`input-slot-end-${index}`}
                            />
                          </div>
                          {slot.startTime && slot.endTime && slot.startTime === slot.endTime && (
                            <p className="text-xs text-destructive mt-1">
                              Startzeit und Endzeit müssen unterschiedlich sein
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>Max. Plätze</Label>
                          <Input
                            type="number"
                            min={1}
                            value={slot.maxCapacity ?? ""}
                            onChange={(e) => updateSlot(index, { maxCapacity: e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : undefined })}
                            placeholder="∞ unbegrenzt"
                            className="mt-1"
                            data-testid={`input-slot-capacity-${index}`}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Von (optional)</Label>
                          <div className="mt-1">
                            <DateTimePicker
                              value={slot.startTime}
                              onChange={(value) => updateSlot(index, { startTime: value })}
                              placeholder="Datum & Uhrzeit"
                              data-testid={`input-slot-start-${index}`}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Bis (optional)</Label>
                          <div className="mt-1">
                            <DateTimePicker
                              value={slot.endTime}
                              onChange={(value) => updateSlot(index, { endTime: value })}
                              placeholder="Datum & Uhrzeit"
                              data-testid={`input-slot-end-${index}`}
                            />
                          </div>
                          {slot.startTime && slot.endTime && slot.startTime === slot.endTime && (
                            <p className="text-xs text-destructive mt-1">
                              Startzeit und Endzeit müssen unterschiedlich sein
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>Max. Plätze</Label>
                          <Input
                            type="number"
                            min={1}
                            value={slot.maxCapacity ?? ""}
                            onChange={(e) => updateSlot(index, { maxCapacity: e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : undefined })}
                            placeholder="∞ unbegrenzt"
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
            Abbrechen
          </Button>
          <Button
            type="submit"
            disabled={createPollMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
            data-testid="button-submit"
          >
            {createPollMutation.isPending ? "Wird erstellt..." : "Orga erstellen"}
          </Button>
        </div>
      </form>
    </div>
  );
}
