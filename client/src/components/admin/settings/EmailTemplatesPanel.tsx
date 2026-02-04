import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Mail,
  FileText,
  Palette,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  Eye,
  X,
  RotateCcw,
  Upload,
  Save,
  Send,
  Check,
  AlertCircle,
  PlusCircle,
  UserPlus,
  CheckCircle,
  Bell,
  Key,
  Shield,
  Info
} from "lucide-react";

interface EmailTemplate {
  type: string;
  name: string;
  subject: string;
  jsonContent: object | null;
  textContent: string | null;
  variables: Array<{ key: string; description: string }>;
  isDefault: boolean;
  isActive: boolean;
  updatedAt: string;
  createdAt: string;
}

interface EmailFooter {
  html: string;
  text: string;
}

interface EmailTheme {
  backdropColor: string;
  canvasColor: string;
  textColor: string;
  headingColor: string;
  linkColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  buttonBorderRadius: number;
  fontFamily: string;
}

export function EmailTemplatesPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [testEmail, setTestEmail] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  
  const [editSubject, setEditSubject] = useState('');
  const [editTextContent, setEditTextContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  
  const [showFooterEditor, setShowFooterEditor] = useState(false);
  const [editFooterHtml, setEditFooterHtml] = useState('');
  
  const [showThemeImport, setShowThemeImport] = useState(false);
  const [themeJsonInput, setThemeJsonInput] = useState('');
  const [themePreview, setThemePreview] = useState<Partial<EmailTheme> | null>(null);

  const { data: templates, isLoading, refetch } = useQuery<EmailTemplate[]>({
    queryKey: ['/api/v1/admin/email-templates'],
  });
  
  const { data: emailFooter } = useQuery<EmailFooter>({
    queryKey: ['/api/v1/admin/email-footer'],
  });
  
  const { data: emailTheme } = useQuery<EmailTheme>({
    queryKey: ['/api/v1/admin/email-theme'],
  });
  
  useEffect(() => {
    if (selectedTemplate) {
      setPreviewHtml('');
      setShowPreview(false);
      setEditSubject(selectedTemplate.subject);
      setEditTextContent(selectedTemplate.textContent || '');
      setHasChanges(false);
    }
  }, [selectedTemplate?.type]);
  
  useEffect(() => {
    if (emailFooter) {
      setEditFooterHtml(emailFooter.html);
    }
  }, [emailFooter]);
  
  useEffect(() => {
    if (selectedTemplate) {
      const subjectChanged = editSubject !== selectedTemplate.subject;
      const textChanged = editTextContent !== (selectedTemplate.textContent || '');
      setHasChanges(subjectChanged || textChanged);
    }
  }, [editSubject, editTextContent, selectedTemplate]);

  const previewMutation = useMutation({
    mutationFn: async (type: string) => {
      const response = await apiRequest('POST', `/api/v1/admin/email-templates/${type}/preview`);
      return response.json();
    },
    onSuccess: (data) => {
      setPreviewHtml(data.html);
      setShowPreview(true);
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.emailTemplates.toasts.previewError'), variant: 'destructive' });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async ({ type, recipientEmail }: { type: string; recipientEmail: string }) => {
      const response = await apiRequest('POST', `/api/v1/admin/email-templates/${type}/test`, { recipientEmail });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.emailTemplates.toasts.testSent'), description: t('admin.emailTemplates.toasts.testSentDescription') });
      setTestEmail('');
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.emailTemplates.toasts.testError'), variant: 'destructive' });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (type: string) => {
      const response = await apiRequest('POST', `/api/v1/admin/email-templates/${type}/reset`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.emailTemplates.toasts.resetSuccess'), description: t('admin.emailTemplates.toasts.resetDescription') });
      refetch();
      setSelectedTemplate(null);
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.emailTemplates.toasts.resetError'), variant: 'destructive' });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ type, subject, textContent }: { type: string; subject: string; textContent: string }) => {
      const response = await apiRequest('PUT', `/api/v1/admin/email-templates/${type}`, {
        subject,
        textContent,
        jsonContent: selectedTemplate?.jsonContent
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.emailTemplates.toasts.saved'), description: t('admin.emailTemplates.toasts.savedDescription') });
      refetch();
      setHasChanges(false);
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.emailTemplates.toasts.saveError'), variant: 'destructive' });
    },
  });

  const saveFooterMutation = useMutation({
    mutationFn: async ({ html, text }: { html: string; text: string }) => {
      const response = await apiRequest('PUT', '/api/v1/admin/email-footer', { html, text });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.emailTemplates.toasts.saved'), description: t('admin.emailTemplates.toasts.footerSaved') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/email-footer'] });
      setShowFooterEditor(false);
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.emailTemplates.toasts.footerError'), variant: 'destructive' });
    },
  });

  const previewThemeMutation = useMutation({
    mutationFn: async (jsonContent: unknown) => {
      const response = await apiRequest('POST', '/api/v1/admin/email-theme/import', { jsonContent });
      return response.json();
    },
    onSuccess: (data) => {
      setThemePreview(data.preview);
      toast({ title: t('admin.emailTemplates.toasts.themePreviewCreated'), description: t('admin.emailTemplates.toasts.themePreviewDescription') });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.emailTemplates.toasts.jsonError'), variant: 'destructive' });
      setThemePreview(null);
    },
  });

  const confirmThemeImportMutation = useMutation({
    mutationFn: async (jsonContent: unknown) => {
      const response = await apiRequest('POST', '/api/v1/admin/email-theme/import/confirm', { jsonContent });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Importiert', description: 'Theme wurde erfolgreich gespeichert' });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/email-theme'] });
      setShowThemeImport(false);
      setThemeJsonInput('');
      setThemePreview(null);
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.emailTemplates.toasts.themeImportError'), variant: 'destructive' });
    },
  });

  const resetThemeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v1/admin/email-theme/reset');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.emailTemplates.toasts.themeReset'), description: t('admin.emailTemplates.toasts.themeResetDescription') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/email-theme'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.emailTemplates.toasts.themeResetError'), variant: 'destructive' });
    },
  });

  const handleThemeJsonPreview = () => {
    try {
      const parsed = JSON.parse(themeJsonInput);
      previewThemeMutation.mutate(parsed);
    } catch {
      toast({ title: t('admin.emailTemplates.toasts.invalidJson'), description: t('admin.emailTemplates.toasts.invalidJsonDescription'), variant: 'destructive' });
    }
  };

  const templateTypeLabels: Record<string, { name: string; icon: React.ReactNode; description: string }> = {
    poll_created: { name: t('admin.emailTemplates.templateTypes.poll_created'), icon: <PlusCircle className="w-4 h-4" />, description: t('admin.emailTemplates.templateTypes.poll_created_desc') },
    invitation: { name: t('admin.emailTemplates.templateTypes.invitation'), icon: <UserPlus className="w-4 h-4" />, description: t('admin.emailTemplates.templateTypes.invitation_desc') },
    vote_confirmation: { name: t('admin.emailTemplates.templateTypes.vote_confirmation'), icon: <CheckCircle className="w-4 h-4" />, description: t('admin.emailTemplates.templateTypes.vote_confirmation_desc') },
    reminder: { name: t('admin.emailTemplates.templateTypes.reminder'), icon: <Bell className="w-4 h-4" />, description: t('admin.emailTemplates.templateTypes.reminder_desc') },
    password_reset: { name: t('admin.emailTemplates.templateTypes.password_reset'), icon: <Key className="w-4 h-4" />, description: t('admin.emailTemplates.templateTypes.password_reset_desc') },
    email_change: { name: t('admin.emailTemplates.templateTypes.email_change'), icon: <Mail className="w-4 h-4" />, description: t('admin.emailTemplates.templateTypes.email_change_desc') },
    password_changed: { name: t('admin.emailTemplates.templateTypes.password_changed'), icon: <Shield className="w-4 h-4" />, description: t('admin.emailTemplates.templateTypes.password_changed_desc') },
    test_report: { name: t('admin.emailTemplates.templateTypes.test_report'), icon: <FileText className="w-4 h-4" />, description: t('admin.emailTemplates.templateTypes.test_report_desc') },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('admin.emailTemplates.backToSettings')}
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">{t('admin.emailTemplates.title')}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.emailTemplates.title')}</h2>
          <p className="text-muted-foreground">{t('admin.emailTemplates.description')}</p>
        </div>
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          <FileText className="w-3 h-3 mr-1" />
          {t('admin.emailTemplates.templatesCount', { count: templates?.length || 0 })}
        </Badge>
      </div>

      {!selectedTemplate ? (
        <>
          <Card className="polly-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Palette className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t('admin.emailTemplates.emailTheme')}</CardTitle>
                    <CardDescription>{t('admin.emailTemplates.themeDescription')}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resetThemeMutation.mutate()}
                    disabled={resetThemeMutation.isPending}
                    data-testid="button-reset-theme"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    {t('admin.emailTemplates.resetTheme')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowThemeImport(true)}
                    data-testid="button-import-theme"
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    {t('admin.emailTemplates.importTheme')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {emailTheme && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('admin.emailTemplates.backdrop')}</Label>
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: emailTheme.backdropColor }} />
                      <span className="text-xs font-mono">{emailTheme.backdropColor}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('admin.emailTemplates.canvas')}</Label>
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: emailTheme.canvasColor }} />
                      <span className="text-xs font-mono">{emailTheme.canvasColor}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('admin.emailTemplates.textColor')}</Label>
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: emailTheme.textColor }} />
                      <span className="text-xs font-mono">{emailTheme.textColor}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('admin.emailTemplates.buttonColor')}</Label>
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: emailTheme.buttonBackgroundColor }} />
                      <span className="text-xs font-mono">{emailTheme.buttonBackgroundColor}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={showThemeImport} onOpenChange={setShowThemeImport}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('admin.emailTemplates.importThemeTitle')}</DialogTitle>
                <DialogDescription>{t('admin.emailTemplates.importThemeDescription')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>{t('admin.emailTemplates.designImportOnly')}</strong> {t('admin.emailTemplates.designImportNote')}
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label>{t('admin.emailTemplates.emailbuilderJson')}</Label>
                  <Textarea
                    value={themeJsonInput}
                    onChange={(e) => setThemeJsonInput(e.target.value)}
                    placeholder='{"root": {"type": "EmailLayout", "data": {...}}, ...}'
                    className="mt-1 font-mono text-xs min-h-[150px]"
                    data-testid="textarea-theme-json"
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={handleThemeJsonPreview}
                  disabled={!themeJsonInput.trim() || previewThemeMutation.isPending}
                  data-testid="button-preview-theme"
                >
                  {previewThemeMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />}
                  {t('admin.emailTemplates.preview')}
                </Button>

                {themePreview && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">{t('admin.emailTemplates.extractedColors')}</Label>
                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
                      {Object.entries(themePreview).map(([key, value]) => (
                        <div key={key} className="flex items-center space-x-2">
                          {typeof value === 'string' && value.startsWith('#') && (
                            <div className="w-5 h-5 rounded border" style={{ backgroundColor: value }} />
                          )}
                          <span className="text-xs">
                            <span className="text-muted-foreground">{key}:</span> <span className="font-mono">{String(value)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowThemeImport(false); setThemeJsonInput(''); setThemePreview(null); }}>
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(themeJsonInput);
                      confirmThemeImportMutation.mutate(parsed);
                    } catch {
                      toast({ title: t('admin.emailTemplates.toasts.invalidJson'), description: t('admin.emailTemplates.toasts.invalidJsonDescription'), variant: 'destructive' });
                    }
                  }}
                  disabled={!themePreview || confirmThemeImportMutation.isPending}
                  data-testid="button-confirm-import-theme"
                >
                  {confirmThemeImportMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                  {t('admin.emailTemplates.applyTheme')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates?.map((template) => {
              const typeInfo = templateTypeLabels[template.type] || { name: template.name, icon: <Mail className="w-4 h-4" />, description: '' };
              return (
                <Card 
                  key={template.type} 
                  className="polly-card cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedTemplate(template)}
                  data-testid={`template-card-${template.type}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">{typeInfo.icon}</div>
                        <div>
                          <h3 className="font-medium text-foreground">{typeInfo.name}</h3>
                          <p className="text-sm text-muted-foreground">{typeInfo.description}</p>
                        </div>
                      </div>
                      <Badge variant={template.isDefault ? "secondary" : "default"} className="text-xs">
                        {template.isDefault ? t('admin.emailTemplates.default') : t('admin.emailTemplates.customized')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)} data-testid="button-back-templates">
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t('admin.emailTemplates.backToOverview')}
          </Button>

          <Card className="polly-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    {templateTypeLabels[selectedTemplate.type]?.icon || <Mail className="w-5 h-5" />}
                  </div>
                  <div>
                    <CardTitle>{templateTypeLabels[selectedTemplate.type]?.name || selectedTemplate.name}</CardTitle>
                    <CardDescription>{templateTypeLabels[selectedTemplate.type]?.description}</CardDescription>
                  </div>
                </div>
                <Badge variant={selectedTemplate.isDefault ? "secondary" : "default"}>
                  {selectedTemplate.isDefault ? t('admin.emailTemplates.defaultTemplate') : t('admin.emailTemplates.customized')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-sm font-medium">{t('admin.emailTemplates.subject')}</Label>
                <Input
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="mt-1 font-mono text-sm"
                  data-testid="input-template-subject"
                />
                <p className="text-xs text-muted-foreground mt-1">{t('admin.emailTemplates.useVariables')}</p>
              </div>

              <div>
                <Label className="text-sm font-medium">{t('admin.emailTemplates.emailContent')}</Label>
                <Textarea
                  value={editTextContent}
                  onChange={(e) => setEditTextContent(e.target.value)}
                  className="mt-1 font-mono text-sm min-h-[200px]"
                  placeholder={t('admin.emailTemplates.contentPlaceholder')}
                  data-testid="textarea-template-content"
                />
                <p className="text-xs text-muted-foreground mt-1">{t('admin.emailTemplates.textVersionNote')}</p>
              </div>

              <div>
                <Label className="text-sm font-medium">{t('admin.emailTemplates.availableVariables')}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedTemplate.variables?.map((variable: { key: string; description: string }) => (
                    <Tooltip key={variable.key}>
                      <TooltipTrigger asChild>
                        <span>
                          <Badge 
                            variant="outline" 
                            className="cursor-pointer font-mono text-xs hover:bg-primary/10"
                            onClick={() => setEditTextContent(prev => prev + `{{${variable.key}}}`)}
                          >
                            {"{{" + variable.key + "}}"}
                          </Badge>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{variable.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t('admin.emailTemplates.clickToInsert')}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => saveMutation.mutate({ type: selectedTemplate.type, subject: editSubject, textContent: editTextContent })}
                  disabled={!hasChanges || saveMutation.isPending}
                  className="polly-button-primary"
                  data-testid="button-save-template"
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {t('common.save')}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => previewMutation.mutate(selectedTemplate.type)}
                  disabled={previewMutation.isPending}
                  data-testid="button-preview-template"
                >
                  {previewMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                  {t('admin.emailTemplates.preview')}
                </Button>
                
                {!selectedTemplate.isDefault && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" data-testid="button-reset-template">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        {t('admin.emailTemplates.resetToDefault')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('admin.emailTemplates.resetTemplateTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('admin.emailTemplates.resetTemplateDescription')}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => resetMutation.mutate(selectedTemplate.type)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          {t('admin.emailTemplates.reset')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              <Separator />

              <div>
                <Label className="text-sm font-medium">{t('admin.emailTemplates.sendTestEmail')}</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="email"
                    placeholder="test@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    data-testid="input-test-email"
                  />
                  <Button
                    onClick={() => testEmailMutation.mutate({ type: selectedTemplate.type, recipientEmail: testEmail })}
                    disabled={!testEmail || testEmailMutation.isPending}
                    data-testid="button-send-test-email"
                  >
                    {testEmailMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('admin.emailTemplates.sendTestEmailNote')}</p>
              </div>
            </CardContent>
          </Card>

          {showPreview && previewHtml && (
            <Card className="polly-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Eye className="w-5 h-5 mr-2" />
                    {t('admin.emailTemplates.preview')}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden bg-white">
                  <iframe srcDoc={previewHtml} className="w-full h-96 border-0" title={t('admin.emailTemplates.emailPreview')} data-testid="iframe-email-preview" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card className="polly-card">
        <CardHeader className="cursor-pointer" onClick={() => setShowFooterEditor(!showFooterEditor)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('admin.emailTemplates.centralFooter')}</CardTitle>
                <CardDescription>{t('admin.emailTemplates.footerDescription')}</CardDescription>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${showFooterEditor ? 'rotate-180' : ''}`} />
          </div>
        </CardHeader>
        {showFooterEditor && (
          <CardContent className="space-y-4 pt-0">
            <div>
              <Label className="text-sm font-medium">{t('admin.emailTemplates.footerText')}</Label>
              <Textarea
                value={editFooterHtml}
                onChange={(e) => setEditFooterHtml(e.target.value)}
                className="mt-1 font-mono text-sm min-h-[100px]"
                placeholder={t('admin.emailTemplates.footerPlaceholder')}
                data-testid="textarea-footer-html"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('admin.emailTemplates.footerVariableNote')}</p>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => saveFooterMutation.mutate({ html: editFooterHtml, text: editFooterHtml })}
                disabled={saveFooterMutation.isPending}
                className="polly-button-primary"
                data-testid="button-save-footer"
              >
                {saveFooterMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {t('admin.emailTemplates.saveFooter')}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="polly-card border-blue-200 bg-blue-50/30 dark:bg-blue-950/30 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-200">{t('admin.emailTemplates.emailBranding')}</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">{t('admin.emailTemplates.brandingNote')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
