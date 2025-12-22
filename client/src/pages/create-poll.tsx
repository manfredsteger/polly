import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CalendarPicker } from "@/components/CalendarPicker";
import { useToast } from "@/hooks/use-toast";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { apiRequest } from "@/lib/queryClient";
import { formatScheduleOptionText } from "@/lib/utils";
import { ArrowLeft, Calendar, Clock, Mail, Trash2, Pencil, CheckCircle, QrCode, Link as LinkIcon, Info, Bell } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { useAuth } from "@/contexts/AuthContext";

interface PollOption {
  text: string;
  imageUrl?: string;
  startTime?: string;
  endTime?: string;
  order: number;
}

interface PollFormData {
  title: string;
  description: string;
  creatorEmail: string;
  options: PollOption[];
  allowVoteEdit: boolean;
  allowVoteWithdrawal: boolean;
  resultsPublic: boolean;
  expiresAt: string | null;
}

export default function CreatePoll() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
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
  const [options, setOptions] = useState<PollOption[]>([]);
  
  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editDate, setEditDate] = useState<Date | null>(null);

  // Form persistence for authentication redirects
  const formPersistence = useFormPersistence<PollFormData>({ key: 'create-poll' });
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
      setOptions(stored.data.options || []);
      setAllowVoteEdit(stored.data.allowVoteEdit ?? false);
      setAllowVoteWithdrawal(stored.data.allowVoteWithdrawal ?? false);
      setResultsPublic(stored.data.resultsPublic ?? true);
      if (stored.data.expiresAt) {
        setExpiresAt(new Date(stored.data.expiresAt));
      }
      
      if (stored.pendingSubmit) {
        toast({
          title: "Willkommen zurück!",
          description: "Ihre Eingaben wurden wiederhergestellt. Sie können die Umfrage jetzt absenden.",
        });
      }
    }
  }, []);

  // Auto-submit after restoration if user is now authenticated
  useEffect(() => {
    if (autoSubmitTriggeredRef.current) return;
    if (!hasRestoredRef.current) return;
    if (!isAuthenticated) return;
    
    const stored = formPersistence.getStoredData();
    if (stored?.pendingSubmit && stored.data && title && options.length >= 2) {
      autoSubmitTriggeredRef.current = true;
      
      // Capture stored expiresAt before clearing
      const storedExpiresAt = stored.data.expiresAt;
      formPersistence.clearStoredData();
      
      toast({
        title: "Automatisches Absenden...",
        description: "Ihre Terminumfrage wird jetzt erstellt.",
      });
      
      setTimeout(() => {
        const pollData = {
          title: title.trim(),
          description: description.trim() || undefined,
          type: "schedule" as const,
          expiresAt: storedExpiresAt || undefined,
          allowVoteEdit: allowVoteEdit,
          allowVoteWithdrawal: allowVoteWithdrawal,
          resultsPublic: resultsPublic,
          options: options.map((option) => {
            const opt: any = {
              text: option.text,
              startTime: option.startTime,
              endTime: option.endTime,
              order: option.order,
            };
            if (option.imageUrl && option.imageUrl.trim()) {
              opt.imageUrl = option.imageUrl.trim();
            }
            return opt;
          }),
        };
        createPollMutation.mutate(pollData);
      }, 500);
    }
  }, [isAuthenticated, title, options]);

  const createPollMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/v1/polls", data);
      return response.json();
    },
    onSuccess: (data) => {
      // Clear any stored form data on success
      formPersistence.clearStoredData();
      
      // Store poll data for success page
      const successData = {
        poll: data.poll,
        publicLink: `/poll/${data.publicToken}`,
        adminLink: `/admin/${data.adminToken}`,
        pollType: 'schedule'
      };
      sessionStorage.setItem('poll-success-data', JSON.stringify(successData));
      
      // Redirect to success page
      setLocation("/success");
    },
    onError: async (error: any) => {
      // Check if it's a REQUIRES_LOGIN error
      let errorMessage = "Die Terminumfrage konnte nicht erstellt werden.";
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
          { title, description, creatorEmail, options, allowVoteEdit, allowVoteWithdrawal, resultsPublic, expiresAt: expiresAt ? expiresAt.toISOString() : null },
          '/create-poll'
        );
        
        // Redirect to login page with email pre-filled
        setTimeout(() => {
          const emailParam = creatorEmail ? `&email=${encodeURIComponent(creatorEmail)}` : '';
          setLocation(`/anmelden?returnTo=/create-poll${emailParam}`);
        }, 2000);
      }
    },
  });

  const addTimeSlot = (date: Date, startTime: string, endTime: string) => {
    setOptions((prevOptions) => {
      const option: PollOption = {
        text: `${date.toLocaleDateString('de-DE')} ${startTime} - ${endTime}`,
        startTime: new Date(date.toDateString() + ' ' + startTime).toISOString(),
        endTime: new Date(date.toDateString() + ' ' + endTime).toISOString(),
        order: prevOptions.length,
      };
      return [...prevOptions, option];
    });
  };

  const addTextOption = (text: string) => {
    setOptions((prevOptions) => {
      const option: PollOption = {
        text,
        order: prevOptions.length,
      };
      return [...prevOptions, option];
    });
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  // Open edit dialog for an option
  const openEditDialog = (index: number) => {
    const option = options[index];
    if (option.startTime && option.endTime) {
      const startDate = new Date(option.startTime);
      const endDate = new Date(option.endTime);
      setEditDate(startDate);
      setEditStartTime(startDate.toTimeString().slice(0, 5));
      setEditEndTime(endDate.toTimeString().slice(0, 5));
      setEditIndex(index);
      setEditDialogOpen(true);
    }
  };

  // Save edited option
  const saveEditedOption = () => {
    if (editIndex !== null && editDate && editStartTime && editEndTime) {
      setOptions(prev => prev.map((opt, i) => {
        if (i === editIndex) {
          return {
            ...opt,
            text: `${editDate.toLocaleDateString('de-DE')} ${editStartTime} - ${editEndTime}`,
            startTime: new Date(editDate.toDateString() + ' ' + editStartTime).toISOString(),
            endTime: new Date(editDate.toDateString() + ' ' + editEndTime).toISOString(),
          };
        }
        return opt;
      }));
      setEditDialogOpen(false);
      setEditIndex(null);
    }
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

    if (options.length < 2) {
      toast({
        title: "Fehler",
        description: "Bitte fügen Sie mindestens 2 Terminoptionen hinzu.",
        variant: "destructive",
      });
      return;
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
      type: "schedule" as const,
      creatorEmail: isAuthenticated ? undefined : creatorEmail.trim(),
      expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
      enableExpiryReminder: expiresAt ? enableExpiryReminder : false,
      expiryReminderHours: expiresAt && enableExpiryReminder ? expiryReminderHours : undefined,
      allowVoteEdit,
      allowVoteWithdrawal,
      resultsPublic,
      options: options.map((option) => {
        const opt: any = {
          text: option.text,
          startTime: option.startTime,
          endTime: option.endTime,
          order: option.order,
        };
        if (option.imageUrl && option.imageUrl.trim()) {
          opt.imageUrl = option.imageUrl.trim();
        }
        return opt;
      }),
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
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück
        </Button>
        <h1 className="text-3xl font-bold text-foreground">Terminumfrage erstellen</h1>
        <p className="text-muted-foreground mt-2">
          Finden Sie den perfekten Termin für Ihr Team-Meeting oder Event.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-kita-orange" />
              Grundinformationen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="title">Titel der Terminumfrage *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Team-Meeting März 2025"
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
                placeholder="Weitere Details zur Terminabstimmung..."
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
                Nach diesem Datum kann nicht mehr abgestimmt werden.
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
            
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <Label>Stimmen ändern erlauben</Label>
                <p className="text-sm text-muted-foreground">
                  Dürfen Teilnehmende ihre Abstimmung nachträglich ändern?
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
                <Label>Stimmen zurückziehen erlauben</Label>
                <p className="text-sm text-muted-foreground">
                  Dürfen Teilnehmende ihre Abstimmung komplett zurückziehen?
                </p>
              </div>
              <Switch
                checked={allowVoteWithdrawal}
                onCheckedChange={setAllowVoteWithdrawal}
                data-testid="switch-allow-vote-withdrawal"
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

        {/* Date and Time Selection */}
        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2 text-kita-blue" />
              Termine auswählen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CalendarPicker
              onAddTimeSlot={addTimeSlot}
              onAddTextOption={addTextOption}
              existingOptions={options}
            />
            
            {/* Selected Options */}
            {options.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold text-foreground mb-4">Terminoptionen ({options.length})</h4>
                <div className="space-y-3">
                  {options.map((option, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between bg-muted p-4 rounded-lg cursor-pointer hover:bg-muted/80 transition-colors group"
                      onClick={() => openEditDialog(index)}
                      data-testid={`option-${index}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {(() => {
                            const parsed = formatScheduleOptionText(option.text);
                            if (parsed) {
                              return <><span className="font-bold">{parsed.date}</span> {parsed.time}</>;
                            }
                            return option.text;
                          })()}
                        </span>
                        <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeOption(index);
                        }}
                        className="text-destructive hover:text-destructive"
                        data-testid={`delete-option-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Creation Options */}
        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
              Erstellungsoptionen
            </CardTitle>
          </CardHeader>
          <CardContent>
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

        {/* Submit */}
        <div className="flex justify-end space-x-4">
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
            className="kita-button-primary"
            disabled={createPollMutation.isPending}
            data-testid="button-submit"
          >
            {createPollMutation.isPending ? "Erstelle..." : "Terminumfrage erstellen"}
          </Button>
        </div>
      </form>

      {/* Edit Option Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-kita-orange" />
              Termin bearbeiten
            </DialogTitle>
            <DialogDescription>
              {editDate && (
                <span className="font-medium text-foreground">
                  {editDate.toLocaleDateString('de-DE', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-startTime" className="text-sm font-medium">Von</Label>
                <Input
                  id="edit-startTime"
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="mt-1"
                  data-testid="input-edit-start-time"
                />
              </div>
              <div>
                <Label htmlFor="edit-endTime" className="text-sm font-medium">Bis</Label>
                <Input
                  id="edit-endTime"
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="mt-1"
                  data-testid="input-edit-end-time"
                />
              </div>
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                className="flex-1"
                data-testid="button-cancel-edit"
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={saveEditedOption}
                disabled={!editStartTime || !editEndTime}
                className="flex-1 kita-button-schedule"
                data-testid="button-save-edit"
              >
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
