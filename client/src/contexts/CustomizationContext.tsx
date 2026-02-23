import { createContext, useContext, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CustomizationSettings } from '@shared/schema';

interface CustomizationContextType {
  settings: CustomizationSettings | null;
  customization: CustomizationSettings | null;
  isLoading: boolean;
}

const CustomizationContext = createContext<CustomizationContextType | undefined>(undefined);

function hexToHSLComponents(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace(/^#/, '');
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hexToHSL(hex: string): string {
  const { h, s, l } = hexToHSLComponents(hex);
  return `${h} ${s}% ${l}%`;
}

function hexToAccessibleHSL(hex: string): string {
  const { h, s, l } = hexToHSLComponents(hex);
  const maxLightnessForWhiteText = 38;
  const adjustedL = Math.min(l, maxLightnessForWhiteText);
  return `${h} ${s}% ${adjustedL}%`;
}

function hexToHSLWithLightness(hex: string, lightness: number): string {
  hex = hex.replace(/^#/, '');
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${lightness}%`;
}

function hexToHSLLight(hex: string): string {
  return hexToHSLWithLightness(hex, 95);
}

function hexToHSLDark(hex: string): string {
  return hexToHSLWithLightness(hex, 20);
}

function getContrastForeground(_hex: string): string {
  return '0 0% 100%';
}

function applyThemeColors(settings: CustomizationSettings) {
  if (!settings?.theme) return;
  
  const root = document.documentElement;
  const isDarkMode = root.classList.contains('dark');
  
  const wcagEnabled = settings.wcag?.enforcementEnabled ?? false;
  const colorConverter = wcagEnabled ? hexToAccessibleHSL : hexToHSL;
  
  const cachedColors: Record<string, string> = {};
  
  if (settings.theme.primaryColor) {
    const effectiveColor = isDarkMode
      ? (settings.theme.primaryColorDark || settings.theme.primaryColor)
      : (settings.theme.primaryColorLight || settings.theme.primaryColor);
    const primaryHSL = colorConverter(effectiveColor);
    root.style.setProperty('--polly-orange', `hsl(${primaryHSL})`);
    root.style.setProperty('--primary', primaryHSL);
    root.style.setProperty('--primary-foreground', '0 0% 100%');
    cachedColors.primary = `hsl(${primaryHSL})`;
    cachedColors.primaryHSL = primaryHSL;
  }
  
  if (settings.theme.secondaryColor) {
    const secondaryHSL = hexToHSL(settings.theme.secondaryColor);
    root.style.setProperty('--polly-blue', `hsl(${secondaryHSL})`);
    cachedColors.secondary = `hsl(${secondaryHSL})`;
  }
  
  if (settings.theme.scheduleColor) {
    const effectiveColor = isDarkMode
      ? (settings.theme.scheduleColorDark || settings.theme.scheduleColor)
      : (settings.theme.scheduleColorLight || settings.theme.scheduleColor);
    const scheduleHSL = colorConverter(effectiveColor);
    const scheduleBgHSL = isDarkMode ? hexToHSLDark(effectiveColor) : hexToHSLLight(effectiveColor);
    const scheduleForeground = getContrastForeground(effectiveColor);
    root.style.setProperty('--color-schedule', `hsl(${scheduleHSL})`);
    root.style.setProperty('--color-schedule-foreground', `hsl(${scheduleForeground})`);
    root.style.setProperty('--color-schedule-light', `hsl(${scheduleBgHSL})`);
    cachedColors.schedule = `hsl(${scheduleHSL})`;
    cachedColors.scheduleLight = `hsl(${scheduleBgHSL})`;
  }
  
  if (settings.theme.surveyColor) {
    const effectiveColor = isDarkMode
      ? (settings.theme.surveyColorDark || settings.theme.surveyColor)
      : (settings.theme.surveyColorLight || settings.theme.surveyColor);
    const surveyHSL = colorConverter(effectiveColor);
    const surveyBgHSL = isDarkMode ? hexToHSLDark(effectiveColor) : hexToHSLLight(effectiveColor);
    const surveyForeground = getContrastForeground(effectiveColor);
    root.style.setProperty('--color-survey', `hsl(${surveyHSL})`);
    root.style.setProperty('--color-survey-foreground', `hsl(${surveyForeground})`);
    root.style.setProperty('--color-survey-light', `hsl(${surveyBgHSL})`);
    cachedColors.survey = `hsl(${surveyHSL})`;
    cachedColors.surveyLight = `hsl(${surveyBgHSL})`;
  }
  
  if (settings.theme.organizationColor) {
    const effectiveColor = isDarkMode
      ? (settings.theme.organizationColorDark || settings.theme.organizationColor)
      : (settings.theme.organizationColorLight || settings.theme.organizationColor);
    const orgHSL = colorConverter(effectiveColor);
    const orgBgHSL = isDarkMode ? hexToHSLDark(effectiveColor) : hexToHSLLight(effectiveColor);
    const orgForeground = getContrastForeground(effectiveColor);
    root.style.setProperty('--color-organization', `hsl(${orgHSL})`);
    root.style.setProperty('--color-organization-foreground', `hsl(${orgForeground})`);
    root.style.setProperty('--color-organization-light', `hsl(${orgBgHSL})`);
    cachedColors.organization = `hsl(${orgHSL})`;
    cachedColors.organizationLight = `hsl(${orgBgHSL})`;
  }
  
  try {
    localStorage.setItem('polly-branding-colors', JSON.stringify(cachedColors));
  } catch (e) {}
}

export function CustomizationProvider({ children }: { children: React.ReactNode }) {
  const { data: settings, isLoading } = useQuery<CustomizationSettings>({
    queryKey: ['/api/v1/customization'],
    staleTime: 1000 * 60 * 5,
  });

  const applyColors = useCallback(() => {
    if (settings) {
      applyThemeColors(settings);
    }
  }, [settings]);

  useEffect(() => {
    applyColors();
  }, [applyColors]);

  useEffect(() => {
    if (!settings?.theme) return;
    
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          applyThemeColors(settings);
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [settings]);

  return (
    <CustomizationContext.Provider value={{ settings: settings || null, customization: settings || null, isLoading }}>
      {children}
    </CustomizationContext.Provider>
  );
}

export function useCustomization() {
  const context = useContext(CustomizationContext);
  if (context === undefined) {
    throw new Error('useCustomization must be used within a CustomizationProvider');
  }
  return context;
}
