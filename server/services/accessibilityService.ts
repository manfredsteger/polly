/**
 * Accessibility Service - WCAG 2.1 AA Color Contrast Verification
 * Provides server-side color contrast checking for the admin panel
 */

export interface ColorContrastResult {
  colorName: string;
  colorValue: string;
  backgroundColorValue: string;
  contrastRatio: number;
  passesAA: boolean;
  passesAAA: boolean;
  requiredRatio: number;
  textSize: 'normal' | 'large';
}

export interface AccessibilityAuditResult {
  timestamp: string;
  totalColors: number;
  passedCount: number;
  failedCount: number;
  overallPass: boolean;
  results: ColorContrastResult[];
  recommendations: string[];
}

// HSL to RGB conversion
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

// Hex to RGB conversion
function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  return [
    parseInt(cleanHex.slice(0, 2), 16),
    parseInt(cleanHex.slice(2, 4), 16),
    parseInt(cleanHex.slice(4, 6), 16)
  ];
}

// Calculate relative luminance (WCAG 2.1 formula)
function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio (WCAG 2.1 formula)
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Parse color value (supports HSL, Hex)
function parseColor(color: string): [number, number, number] | null {
  color = color.trim();
  
  // HSL format: hsl(h, s%, l%) or hsl(h s% l%)
  const hslMatch = color.match(/hsl\((\d+),?\s*(\d+(?:\.\d+)?)%?,?\s*(\d+(?:\.\d+)?)%?\)/i);
  if (hslMatch) {
    return hslToRgb(
      parseFloat(hslMatch[1]),
      parseFloat(hslMatch[2]),
      parseFloat(hslMatch[3])
    );
  }
  
  // Hex format: #RGB or #RRGGBB
  if (color.startsWith('#')) {
    if (color.length === 4) {
      // Short hex
      const r = color[1] + color[1];
      const g = color[2] + color[2];
      const b = color[3] + color[3];
      return hexToRgb(`#${r}${g}${b}`);
    }
    return hexToRgb(color);
  }
  
  return null;
}

// Default Polly theme colors (from index.css)
const DEFAULT_THEME_COLORS = {
  // Light mode - text colors on white background
  lightMode: {
    schedule: 'hsl(25, 95%, 25%)',
    survey: 'hsl(142, 71%, 22%)',
    organization: 'hsl(199, 89%, 25%)',
    pollyOrange: 'hsl(17, 100%, 35%)',
    success: '#15803d',
    warning: '#b45309',
    error: '#b91c1c',
    info: '#1d4ed8',
    mutedForeground: 'hsl(25, 5.3%, 37%)',
  },
  // Button colors with white text
  buttons: {
    schedule: 'hsl(25, 95%, 25%)',
    survey: 'hsl(142, 71%, 22%)',
    organization: 'hsl(199, 89%, 25%)',
  }
};

/**
 * Run a full accessibility audit on the current theme colors
 */
export function runAccessibilityAudit(customColors?: Record<string, string>): AccessibilityAuditResult {
  const results: ColorContrastResult[] = [];
  const recommendations: string[] = [];
  
  const colors = customColors || {};
  const white = '#ffffff';
  const whiteLum = luminance(255, 255, 255);
  
  // Test text colors on white background
  const textColors: Array<{ name: string; value: string; defaultValue: string }> = [
    { name: 'Schedule (Terminumfrage)', value: colors.schedule || DEFAULT_THEME_COLORS.lightMode.schedule, defaultValue: DEFAULT_THEME_COLORS.lightMode.schedule },
    { name: 'Survey (Umfrage)', value: colors.survey || DEFAULT_THEME_COLORS.lightMode.survey, defaultValue: DEFAULT_THEME_COLORS.lightMode.survey },
    { name: 'Organization (Orga-Liste)', value: colors.organization || DEFAULT_THEME_COLORS.lightMode.organization, defaultValue: DEFAULT_THEME_COLORS.lightMode.organization },
    { name: 'Primary Orange', value: colors.pollyOrange || DEFAULT_THEME_COLORS.lightMode.pollyOrange, defaultValue: DEFAULT_THEME_COLORS.lightMode.pollyOrange },
    { name: 'Success', value: colors.success || DEFAULT_THEME_COLORS.lightMode.success, defaultValue: DEFAULT_THEME_COLORS.lightMode.success },
    { name: 'Warning', value: colors.warning || DEFAULT_THEME_COLORS.lightMode.warning, defaultValue: DEFAULT_THEME_COLORS.lightMode.warning },
    { name: 'Error', value: colors.error || DEFAULT_THEME_COLORS.lightMode.error, defaultValue: DEFAULT_THEME_COLORS.lightMode.error },
    { name: 'Info', value: colors.info || DEFAULT_THEME_COLORS.lightMode.info, defaultValue: DEFAULT_THEME_COLORS.lightMode.info },
    { name: 'Muted Foreground', value: colors.mutedForeground || DEFAULT_THEME_COLORS.lightMode.mutedForeground, defaultValue: DEFAULT_THEME_COLORS.lightMode.mutedForeground },
  ];
  
  // Check text colors on white background
  for (const color of textColors) {
    const rgb = parseColor(color.value);
    if (!rgb) continue;
    
    const colorLum = luminance(...rgb);
    const ratio = contrastRatio(colorLum, whiteLum);
    
    results.push({
      colorName: `${color.name} (Text)`,
      colorValue: color.value,
      backgroundColorValue: white,
      contrastRatio: Math.round(ratio * 100) / 100,
      passesAA: ratio >= 4.5,
      passesAAA: ratio >= 7,
      requiredRatio: 4.5,
      textSize: 'normal',
    });
    
    if (ratio < 4.5) {
      recommendations.push(`${color.name}: Kontrast (${ratio.toFixed(2)}:1) ist unter WCAG AA (4.5:1). Empfehlung: Dunklere Farbe verwenden.`);
    }
  }
  
  // Test button colors (white text on colored background)
  const buttonColors: Array<{ name: string; bgValue: string }> = [
    { name: 'Schedule Button', bgValue: colors.scheduleButton || DEFAULT_THEME_COLORS.buttons.schedule },
    { name: 'Survey Button', bgValue: colors.surveyButton || DEFAULT_THEME_COLORS.buttons.survey },
    { name: 'Organization Button', bgValue: colors.organizationButton || DEFAULT_THEME_COLORS.buttons.organization },
  ];
  
  for (const button of buttonColors) {
    const rgb = parseColor(button.bgValue);
    if (!rgb) continue;
    
    const bgLum = luminance(...rgb);
    const ratio = contrastRatio(whiteLum, bgLum);
    
    results.push({
      colorName: `${button.name} (Weiße Schrift)`,
      colorValue: '#ffffff',
      backgroundColorValue: button.bgValue,
      contrastRatio: Math.round(ratio * 100) / 100,
      passesAA: ratio >= 4.5,
      passesAAA: ratio >= 7,
      requiredRatio: 4.5,
      textSize: 'normal',
    });
    
    if (ratio < 4.5) {
      recommendations.push(`${button.name}: Kontrast (${ratio.toFixed(2)}:1) ist unter WCAG AA (4.5:1). Empfehlung: Dunkleren Hintergrund verwenden.`);
    }
  }
  
  const passedCount = results.filter(r => r.passesAA).length;
  const failedCount = results.filter(r => !r.passesAA).length;
  
  return {
    timestamp: new Date().toISOString(),
    totalColors: results.length,
    passedCount,
    failedCount,
    overallPass: failedCount === 0,
    results,
    recommendations,
  };
}

/**
 * Check if a single color combination meets WCAG AA requirements
 */
export function checkColorContrast(
  foreground: string, 
  background: string,
  textSize: 'normal' | 'large' = 'normal'
): ColorContrastResult {
  const fgRgb = parseColor(foreground);
  const bgRgb = parseColor(background);
  
  if (!fgRgb || !bgRgb) {
    return {
      colorName: 'Invalid',
      colorValue: foreground,
      backgroundColorValue: background,
      contrastRatio: 0,
      passesAA: false,
      passesAAA: false,
      requiredRatio: textSize === 'large' ? 3 : 4.5,
      textSize,
    };
  }
  
  const fgLum = luminance(...fgRgb);
  const bgLum = luminance(...bgRgb);
  const ratio = contrastRatio(fgLum, bgLum);
  
  const requiredRatioAA = textSize === 'large' ? 3 : 4.5;
  const requiredRatioAAA = textSize === 'large' ? 4.5 : 7;
  
  return {
    colorName: 'Custom',
    colorValue: foreground,
    backgroundColorValue: background,
    contrastRatio: Math.round(ratio * 100) / 100,
    passesAA: ratio >= requiredRatioAA,
    passesAAA: ratio >= requiredRatioAAA,
    requiredRatio: requiredRatioAA,
    textSize,
  };
}
