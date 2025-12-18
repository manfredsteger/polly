import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Vote, Mail, Plus, Trash2, CheckCircle, QrCode, Link as LinkIcon, Info, Bell } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { ImageUpload } from "@/components/ImageUpload";
import { useAuth } from "@/contexts/AuthContext";

interface SurveyOption {
  text: string;
  imageUrl?: string;
  altText?: string;
  order: number;
}

interface SurveyFormData {
  title: string;
  description: string;
  creatorEmail: string;
  options: SurveyOption[];
  allowVoteEdit: boolean;
  resultsPublic: boolean;
  expiresAt: string | null;
}

export default function CreateSurvey() {
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
  const [resultsPublic, setResultsPublic] = useState(true);
  const [options, setOptions] = useState<SurveyOption[]>([
    { text: "", order: 0 },
    { text: "", order: 1 },
  ]);

  // Form persistence for authentication redirects
  const formPersistence = useFormPersistence<SurveyFormData>({ key: 'create-survey' });
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
      setAllowVoteEdit(stored.data.allowVoteEdit ?? false);
      setResultsPublic(stored.data.resultsPublic ?? true);
      if (stored.data.options && stored.data.options.length >= 2) {
        setOptions(stored.data.options);
      }
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
    const validOptions = options.filter(o => o.text.trim());
    if (stored?.pendingSubmit && stored.data && title && validOptions.length >= 2) {
      autoSubmitTriggeredRef.current = true;
      
      // Capture stored expiresAt before clearing
      const storedExpiresAt = stored.data.expiresAt;
      formPersistence.clearStoredData();
      
      toast({
        title: "Automatisches Absenden...",
        description: "Ihre Umfrage wird jetzt erstellt.",
      });
      
      setTimeout(() => {
        const surveyData = {
          title: title.trim(),
          description: description.trim() || undefined,
          type: "survey" as const,
          expiresAt: storedExpiresAt || undefined,
          allowVoteEdit: allowVoteEdit,
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
      // Clear any stored form data on success
      formPersistence.clearStoredData();
      
      // Store poll data for success page
      const successData = {
        poll: data.poll,
        publicLink: `/poll/${data.publicToken}`,
        adminLink: `/admin/${data.adminToken}`,
        pollType: 'survey'
      };
      sessionStorage.setItem('poll-success-data', JSON.stringify(successData));
      
      // Redirect to success page
      setLocation("/success");
    },
    onError: async (error: any) => {
      // Check if it's a REQUIRES_LOGIN error
      let errorMessage = "Die Umfrage konnte nicht erstellt werden.";
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
          { title, description, creatorEmail, options, allowVoteEdit, resultsPublic, expiresAt: expiresAt ? expiresAt.toISOString() : null },
          '/create-survey'
        );
        
        // Redirect to login page with email pre-filled
        setTimeout(() => {
          const emailParam = creatorEmail ? `&email=${encodeURIComponent(creatorEmail)}` : '';
          setLocation(`/anmelden?returnTo=/create-survey${emailParam}`);
        }, 2000);
      }
    },
  });

  const addOption = () => {
    setOptions([...options, { text: "", order: options.length }]);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
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
        title: "Fehler",
        description: "Bitte geben Sie einen Titel ein.",
        variant: "destructive",
      });
      return;
    }

    const validOptions = options.filter(opt => opt.text.trim());
    if (validOptions.length < 2) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie mindestens 2 Optionen ein.",
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

    const surveyData = {
      title: title.trim(),
      description: description.trim() || undefined,
      type: "survey" as const,
      creatorEmail: isAuthenticated ? undefined : creatorEmail.trim(),
      expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
      enableExpiryReminder: expiresAt ? enableExpiryReminder : false,
      expiryReminderHours: expiresAt && enableExpiryReminder ? expiryReminderHours : undefined,
      allowVoteEdit,
      resultsPublic,
      options: validOptions.map((option, index) => {
        const opt: any = {
          text: option.text.trim(),
          order: index,
        };
        if (option.imageUrl && option.imageUrl.trim()) {
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
          Zurück
        </Button>
        <h1 className="text-3xl font-bold text-foreground">Umfrage erstellen</h1>
        <p className="text-muted-foreground mt-2">
          Sammeln Sie Meinungen und treffen Sie gemeinsam Entscheidungen.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Vote className="w-5 h-5 mr-2 text-kita-orange" />
              Grundinformationen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="title">Titel der Umfrage *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Sommerfest-Planung 2025"
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
                placeholder="Welche Aktivitäten sollen wir beim Sommerfest anbieten?"
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

        {/* Survey Options */}
        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Vote className="w-5 h-5 mr-2 text-kita-blue" />
                Auswahlmöglichkeiten
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
                data-testid="button-add-option"
              >
                <Plus className="w-4 h-4 mr-2" />
                Option hinzufügen
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Fügen Sie mindestens 2 Optionen hinzu, zwischen denen die Teilnehmer wählen können.
              </p>
              
              {options.map((option, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                      <span className="text-sm font-medium">{index + 1}</span>
                    </div>
                    <Input
                      value={option.text}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1"
                      data-testid={`input-option-${index}`}
                    />
                    {options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOption(index)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`button-delete-option-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Bild hinzufügen (optional):</span>
                    <ImageUpload
                      onImageUploaded={(imageUrl) => updateOptionImage(index, imageUrl)}
                      onImageRemoved={() => removeOptionImage(index)}
                      onAltTextChange={(altText) => updateOptionAltText(index, altText)}
                      currentImageUrl={option.imageUrl}
                      currentAltText={option.altText}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">💡 Tipp</h4>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Verwenden Sie Bilder, um Ihre Optionen visuell ansprechender zu gestalten. Bilder helfen den Teilnehmern bei der Entscheidung.
              </p>
            </div>
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
            disabled={createSurveyMutation.isPending}
            data-testid="button-submit"
          >
            {createSurveyMutation.isPending ? "Erstelle..." : "Umfrage erstellen"}
          </Button>
        </div>
      </form>
    </div>
  );
}
