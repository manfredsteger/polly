import { createContext, useContext, useEffect } from 'react';
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
  // Always use white text for feature buttons - better visual consistency
  // The button colors are designed for white text regardless of luminance
  return '0 0% 100%';
}

export function CustomizationProvider({ children }: { children: React.ReactNode }) {
  const { data: settings, isLoading } = useQuery<CustomizationSettings>({
    queryKey: ['/api/v1/customization'],
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (settings?.theme) {
      const root = document.documentElement;
      const isDarkMode = root.classList.contains('dark');
      
      if (settings.theme.primaryColor) {
        const primaryHSL = hexToHSL(settings.theme.primaryColor);
        root.style.setProperty('--polly-orange', `hsl(${primaryHSL})`);
        root.style.setProperty('--primary', `hsl(${primaryHSL})`);
        root.style.setProperty('--primary-foreground', 'hsl(0, 0%, 100%)');
      }
      
      if (settings.theme.secondaryColor) {
        const secondaryHSL = hexToHSL(settings.theme.secondaryColor);
        root.style.setProperty('--polly-blue', `hsl(${secondaryHSL})`);
      }
      
      // Apply feature-specific colors with WCAG AA contrast enforcement
      if (settings.theme.scheduleColor) {
        const scheduleHSL = hexToAccessibleHSL(settings.theme.scheduleColor);
        const scheduleBgHSL = isDarkMode ? hexToHSLDark(settings.theme.scheduleColor) : hexToHSLLight(settings.theme.scheduleColor);
        const scheduleForeground = getContrastForeground(settings.theme.scheduleColor);
        root.style.setProperty('--color-schedule', `hsl(${scheduleHSL})`);
        root.style.setProperty('--color-schedule-foreground', `hsl(${scheduleForeground})`);
        root.style.setProperty('--color-schedule-light', `hsl(${scheduleBgHSL})`);
      }
      
      if (settings.theme.surveyColor) {
        const surveyHSL = hexToAccessibleHSL(settings.theme.surveyColor);
        const surveyBgHSL = isDarkMode ? hexToHSLDark(settings.theme.surveyColor) : hexToHSLLight(settings.theme.surveyColor);
        const surveyForeground = getContrastForeground(settings.theme.surveyColor);
        root.style.setProperty('--color-survey', `hsl(${surveyHSL})`);
        root.style.setProperty('--color-survey-foreground', `hsl(${surveyForeground})`);
        root.style.setProperty('--color-survey-light', `hsl(${surveyBgHSL})`);
      }
      
      if (settings.theme.organizationColor) {
        const orgHSL = hexToAccessibleHSL(settings.theme.organizationColor);
        const orgBgHSL = isDarkMode ? hexToHSLDark(settings.theme.organizationColor) : hexToHSLLight(settings.theme.organizationColor);
        const orgForeground = getContrastForeground(settings.theme.organizationColor);
        root.style.setProperty('--color-organization', `hsl(${orgHSL})`);
        root.style.setProperty('--color-organization-foreground', `hsl(${orgForeground})`);
        root.style.setProperty('--color-organization-light', `hsl(${orgBgHSL})`);
      }
    }
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
