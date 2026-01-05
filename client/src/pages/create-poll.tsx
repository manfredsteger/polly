import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
  const [options, setOptions] = useState<PollOption[]>([]);
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editDate, setEditDate] = useState<Date | null>(null);

  const formPersistence = useFormPersistence<PollFormData>({ key: 'create-poll' });
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
      setOptions(stored.data.options || []);
      setAllowVoteEdit(stored.data.allowVoteEdit ?? false);
      setAllowVoteWithdrawal(stored.data.allowVoteWithdrawal ?? false);
      setResultsPublic(stored.data.resultsPublic ?? true);
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

  useEffect(() => {
    if (autoSubmitTriggeredRef.current) return;
    if (!hasRestoredRef.current) return;
    if (!isAuthenticated) return;
    
    const stored = formPersistence.getStoredData();
    if (stored?.pendingSubmit && stored.data && title && options.length >= 2) {
      autoSubmitTriggeredRef.current = true;
      
      const storedExpiresAt = stored.data.expiresAt;
      formPersistence.clearStoredData();
      
      toast({
        title: t('pollCreation.autoSubmitting'),
        description: t('createPoll.autoSubmitDescription'),
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
      formPersistence.clearStoredData();
      
      const successData = {
        poll: data.poll,
        publicLink: `/poll/${data.publicToken}`,
        adminLink: `/admin/${data.adminToken}`,
        pollType: 'schedule'
      };
      sessionStorage.setItem('poll-success-data', JSON.stringify(successData));
      
      setLocation("/success");
    },
    onError: async (error: any) => {
      let errorMessage = t('createPoll.createError');
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
          { title, description, creatorEmail, options, allowVoteEdit, allowVoteWithdrawal, resultsPublic, expiresAt: expiresAt ? expiresAt.toISOString() : null },
          '/create-poll'
        );
        
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
        title: t('pollCreation.error'),
        description: t('pollCreation.pleaseEnterTitle'),
        variant: "destructive",
      });
      return;
    }

    if (options.length < 2) {
      toast({
        title: t('pollCreation.error'),
        description: t('createPoll.minOptionsError'),
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
          {t('pollCreation.back')}
        </Button>
        <h1 className="text-3xl font-bold text-foreground">{t('createPoll.pageTitle')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('createPoll.pageSubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-polly-orange" />
              {t('pollCreation.basicInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="title">{t('createPoll.titleLabel')}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('createPoll.titlePlaceholder')}
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
                placeholder={t('createPoll.descriptionPlaceholder')}
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
            
            <div className="flex items-center justify-between pt-4 border-t">
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
          </CardContent>
        </Card>

        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2 text-polly-blue" />
              {t('createPoll.selectDates')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CalendarPicker
              onAddTimeSlot={addTimeSlot}
              onAddTextOption={addTextOption}
              existingOptions={options}
            />
            
            {options.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold text-foreground mb-4">{t('createPoll.dateOptionsCount', { count: options.length })}</h4>
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
                        aria-label={t('createPoll.removeOption')}
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
            disabled={createPollMutation.isPending}
            data-testid="button-submit"
          >
            {createPollMutation.isPending ? t('pollCreation.creating') : t('createPoll.submitButton')}
          </Button>
        </div>
      </form>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-polly-orange" />
              {t('createPoll.editDate')}
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
                <Label htmlFor="edit-startTime" className="text-sm font-medium">{t('pollCreation.from')}</Label>
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
                <Label htmlFor="edit-endTime" className="text-sm font-medium">{t('pollCreation.to')}</Label>
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
                {t('pollCreation.cancel')}
              </Button>
              <Button
                type="button"
                onClick={saveEditedOption}
                disabled={!editStartTime || !editEndTime}
                className="flex-1 polly-button-schedule"
                data-testid="button-save-edit"
              >
                {t('pollCreation.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
