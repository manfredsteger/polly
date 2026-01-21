import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Paintbrush, 
  Upload, 
  Image, 
  Link2, 
  Plus, 
  X,
  Moon,
  Sun,
  Monitor,
  RotateCcw,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CustomizationSettings, FooterLink } from "@shared/schema";

const DEFAULT_THEME_COLORS = {
  primaryColor: '#f97316',
  secondaryColor: '#1e40af',
  scheduleColor: '#F97316',
  surveyColor: '#72BEB7',
  organizationColor: '#7DB942',
  successColor: '#22c55e',
  warningColor: '#f59e0b',
  errorColor: '#ef4444',
  infoColor: '#3b82f6',
  accentColor: '#8b5cf6',
  mutedColor: '#64748b',
  neutralColor: '#f1f5f9',
};

export function CustomizePanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: customization, isLoading } = useQuery<CustomizationSettings>({
    queryKey: ['/api/v1/admin/customization'],
  });

  const [themeSettings, setThemeSettings] = useState({
    ...DEFAULT_THEME_COLORS,
    defaultThemeMode: 'system' as 'light' | 'dark' | 'system',
    borderRadius: 8,
  });

  const [brandingSettings, setBrandingSettings] = useState({
    logoUrl: null as string | null,
    faviconUrl: null as string | null,
    siteName: '',
    siteNameAccent: '',
  });
  
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  const [footerSettings, setFooterSettings] = useState({
    description: '',
    copyrightText: '',
    supportLinks: [] as FooterLink[],
  });

  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (customization && !initialDataLoaded) {
      setThemeSettings({
        primaryColor: customization.theme?.primaryColor || DEFAULT_THEME_COLORS.primaryColor,
        secondaryColor: customization.theme?.secondaryColor || DEFAULT_THEME_COLORS.secondaryColor,
        defaultThemeMode: customization.theme?.defaultThemeMode || 'system',
        scheduleColor: customization.theme?.scheduleColor || DEFAULT_THEME_COLORS.scheduleColor,
        surveyColor: customization.theme?.surveyColor || DEFAULT_THEME_COLORS.surveyColor,
        organizationColor: customization.theme?.organizationColor || DEFAULT_THEME_COLORS.organizationColor,
        successColor: customization.theme?.successColor || DEFAULT_THEME_COLORS.successColor,
        warningColor: customization.theme?.warningColor || DEFAULT_THEME_COLORS.warningColor,
        errorColor: customization.theme?.errorColor || DEFAULT_THEME_COLORS.errorColor,
        infoColor: customization.theme?.infoColor || DEFAULT_THEME_COLORS.infoColor,
        accentColor: customization.theme?.accentColor || DEFAULT_THEME_COLORS.accentColor,
        mutedColor: customization.theme?.mutedColor || DEFAULT_THEME_COLORS.mutedColor,
        neutralColor: customization.theme?.neutralColor || DEFAULT_THEME_COLORS.neutralColor,
        borderRadius: customization.theme?.borderRadius || 8,
      });
      setBrandingSettings({
        logoUrl: customization.branding?.logoUrl || null,
        faviconUrl: customization.branding?.faviconUrl || null,
        siteName: customization.branding?.siteName ?? '',
        siteNameAccent: customization.branding?.siteNameAccent ?? '',
      });
      setFooterSettings({
        description: customization.footer?.description || '',
        copyrightText: customization.footer?.copyrightText || '',
        supportLinks: customization.footer?.supportLinks || [],
      });
      setInitialDataLoaded(true);
    }
  }, [customization, initialDataLoaded]);

  const saveMutation = useMutation({
    mutationFn: async (settings: Partial<CustomizationSettings>) => {
      const response = await apiRequest('PUT', '/api/v1/admin/customization', settings);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toasts.saved'), description: t('admin.toasts.customizationSaved') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/customization'] });
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.toasts.customizationSaveError'), variant: "destructive" });
    },
  });

  const handleSaveTheme = () => {
    saveMutation.mutate({ theme: themeSettings });
  };

  const handleSaveBranding = () => {
    saveMutation.mutate({ branding: brandingSettings });
  };

  const handleSaveFooter = () => {
    saveMutation.mutate({ footer: footerSettings });
  };

  const handleResetTheme = () => {
    setThemeSettings({
      ...DEFAULT_THEME_COLORS,
      defaultThemeMode: 'system',
      borderRadius: 8,
    });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('logo', file);

    try {
      const response = await fetch('/api/v1/admin/customization/logo', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      setBrandingSettings({ ...brandingSettings, logoUrl: data.logoUrl });
      toast({ title: t('admin.toasts.logoUploaded'), description: t('admin.toasts.logoUploadedDescription') });
    } catch (error) {
      toast({ title: t('errors.generic'), description: t('admin.toasts.logoUploadError'), variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const addFooterLink = () => {
    setFooterSettings({
      ...footerSettings,
      supportLinks: [...footerSettings.supportLinks, { label: '', url: '' }],
    });
  };

  const updateFooterLink = (index: number, field: 'label' | 'url', value: string) => {
    const newLinks = [...footerSettings.supportLinks];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setFooterSettings({ ...footerSettings, supportLinks: newLinks });
  };

  const removeFooterLink = (index: number) => {
    setFooterSettings({
      ...footerSettings,
      supportLinks: footerSettings.supportLinks.filter((_, i) => i !== index),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground">{t('admin.customize.title')}</h2>
        <Badge variant="outline" className="text-polly-orange border-polly-orange">
          <Paintbrush className="w-3 h-3 mr-1" />
          {t('admin.customize.branding')}
        </Badge>
      </div>

      {/* Branding */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="w-5 h-5" />
            {t('admin.customize.brandingSection')}
          </CardTitle>
          <CardDescription>{t('admin.customize.brandingDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('admin.customize.logo')}</Label>
            <div className="flex items-center gap-4 mt-2">
              {brandingSettings.logoUrl ? (
                <img src={brandingSettings.logoUrl} alt="Logo" className="h-12 w-auto" />
              ) : (
                <div className="h-12 w-12 bg-muted rounded flex items-center justify-center">
                  <Image className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={isUploading}
                  className="max-w-xs"
                  data-testid="input-logo-upload"
                />
                {isUploading && <p className="text-xs text-muted-foreground mt-1">{t('common.uploading')}</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="siteName">{t('admin.customize.siteName')}</Label>
              <Input
                id="siteName"
                value={brandingSettings.siteName}
                onChange={(e) => setBrandingSettings({ ...brandingSettings, siteName: e.target.value })}
                placeholder="Polly"
                data-testid="input-site-name"
              />
            </div>
            <div>
              <Label htmlFor="siteNameAccent">{t('admin.customize.siteNameAccent')}</Label>
              <Input
                id="siteNameAccent"
                value={brandingSettings.siteNameAccent}
                onChange={(e) => setBrandingSettings({ ...brandingSettings, siteNameAccent: e.target.value })}
                placeholder="Poll"
                data-testid="input-site-name-accent"
              />
            </div>
          </div>

          <Button onClick={handleSaveBranding} disabled={saveMutation.isPending} data-testid="button-save-branding">
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('admin.customize.saveBranding')}
          </Button>
        </CardContent>
      </Card>

      {/* Theme Colors */}
      <Card className="polly-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Paintbrush className="w-5 h-5" />
                {t('admin.customize.themeSection')}
              </CardTitle>
              <CardDescription>{t('admin.customize.themeDescription')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleResetTheme}>
              <RotateCcw className="w-4 h-4 mr-1" />
              {t('admin.customize.resetDefaults')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-2 block">{t('admin.customize.defaultThemeMode')}</Label>
            <RadioGroup 
              value={themeSettings.defaultThemeMode} 
              onValueChange={(value) => setThemeSettings({ ...themeSettings, defaultThemeMode: value as 'light' | 'dark' | 'system' })}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="light" id="light" />
                <Label htmlFor="light" className="flex items-center gap-1 cursor-pointer">
                  <Sun className="w-4 h-4" />
                  {t('admin.customize.light')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dark" id="dark" />
                <Label htmlFor="dark" className="flex items-center gap-1 cursor-pointer">
                  <Moon className="w-4 h-4" />
                  {t('admin.customize.dark')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="system" id="system" />
                <Label htmlFor="system" className="flex items-center gap-1 cursor-pointer">
                  <Monitor className="w-4 h-4" />
                  {t('admin.customize.system')}
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(DEFAULT_THEME_COLORS).map(([key, defaultValue]) => (
              <div key={key}>
                <Label htmlFor={key} className="text-xs capitalize">
                  {t(`admin.customize.colors.${key}`, { defaultValue: key.replace(/Color$/, '').replace(/([A-Z])/g, ' $1').trim() })}
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    id={key}
                    value={themeSettings[key as keyof typeof themeSettings] as string}
                    onChange={(e) => setThemeSettings({ ...themeSettings, [key]: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer"
                    data-testid={`color-${key}`}
                  />
                  <Input
                    value={themeSettings[key as keyof typeof themeSettings] as string}
                    onChange={(e) => setThemeSettings({ ...themeSettings, [key]: e.target.value })}
                    className="flex-1 text-xs font-mono"
                  />
                </div>
              </div>
            ))}
          </div>

          <Button onClick={handleSaveTheme} disabled={saveMutation.isPending} data-testid="button-save-theme">
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('admin.customize.saveTheme')}
          </Button>
        </CardContent>
      </Card>

      {/* Footer Settings */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            {t('admin.customize.footerSection')}
          </CardTitle>
          <CardDescription>{t('admin.customize.footerDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="footerDescription">{t('admin.customize.footerText')}</Label>
            <Textarea
              id="footerDescription"
              value={footerSettings.description}
              onChange={(e) => setFooterSettings({ ...footerSettings, description: e.target.value })}
              placeholder={t('admin.customize.footerTextPlaceholder')}
              data-testid="textarea-footer-description"
            />
          </div>

          <div>
            <Label htmlFor="copyrightText">{t('admin.customize.copyrightText')}</Label>
            <Input
              id="copyrightText"
              value={footerSettings.copyrightText}
              onChange={(e) => setFooterSettings({ ...footerSettings, copyrightText: e.target.value })}
              placeholder="© 2024 Your Company"
              data-testid="input-copyright"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>{t('admin.customize.supportLinks')}</Label>
              <Button variant="outline" size="sm" onClick={addFooterLink}>
                <Plus className="w-4 h-4 mr-1" />
                {t('admin.customize.addLink')}
              </Button>
            </div>
            <div className="space-y-2">
              {footerSettings.supportLinks.map((link, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={link.label}
                    onChange={(e) => updateFooterLink(index, 'label', e.target.value)}
                    placeholder={t('admin.customize.linkLabel')}
                    className="flex-1"
                    data-testid={`input-link-label-${index}`}
                  />
                  <Input
                    value={link.url}
                    onChange={(e) => updateFooterLink(index, 'url', e.target.value)}
                    placeholder="https://..."
                    className="flex-1"
                    data-testid={`input-link-url-${index}`}
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeFooterLink(index)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSaveFooter} disabled={saveMutation.isPending} data-testid="button-save-footer">
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('admin.customize.saveFooter')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
