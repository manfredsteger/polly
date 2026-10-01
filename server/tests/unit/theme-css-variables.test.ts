import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

export const testMeta = {
  category: 'unit' as const,
  name: 'Theme CSS Variable Format',
  description:
    'Verhindert, dass --primary/--primary-foreground erneut als rohes HSL-Triplet ohne hsl()-Wrapper gesetzt werden (führte dazu, dass ausgewählte Simple-Choice-Optionen unsichtbar/transparent blieben statt in der Markenfarbe gefüllt zu sein)',
  severity: 'high' as const,
};

const CSS_COLOR_FUNCTION = /^(hsl|hsla|rgb|rgba|oklch|oklab|#)/i;

function extractCssVarValue(css: string, blockSelector: string, varName: string): string {
  const blockMatch = css.match(new RegExp(`${blockSelector}\\s*\\{([^}]*)\\}`, 's'));
  expect(blockMatch, `CSS block "${blockSelector}" not found`).toBeTruthy();
  const block = blockMatch![1];
  const varMatch = block.match(new RegExp(`${varName}:\\s*([^;]+);`));
  expect(varMatch, `Variable "${varName}" not found in block "${blockSelector}"`).toBeTruthy();
  return varMatch![1].trim();
}

describe('Unit - Theme CSS Variable Format', () => {
  const cssPath = path.resolve(__dirname, '../../../client/src/index.css');
  const contextPath = path.resolve(
    __dirname,
    '../../../client/src/contexts/CustomizationContext.tsx'
  );

  it('index.css defines --primary and --primary-foreground with a valid CSS color function in :root', () => {
    const css = fs.readFileSync(cssPath, 'utf-8');
    const primary = extractCssVarValue(css, ':root', '--primary');
    const primaryForeground = extractCssVarValue(css, ':root', '--primary-foreground');

    expect(primary).toMatch(CSS_COLOR_FUNCTION);
    expect(primaryForeground).toMatch(CSS_COLOR_FUNCTION);
  });

  it('index.css defines --primary and --primary-foreground with a valid CSS color function in .dark', () => {
    const css = fs.readFileSync(cssPath, 'utf-8');
    const primary = extractCssVarValue(css, '\\.dark', '--primary');
    const primaryForeground = extractCssVarValue(css, '\\.dark', '--primary-foreground');

    expect(primary).toMatch(CSS_COLOR_FUNCTION);
    expect(primaryForeground).toMatch(CSS_COLOR_FUNCTION);
  });

  it('CustomizationContext only writes --primary/--primary-foreground wrapped in a CSS color function', () => {
    const source = fs.readFileSync(contextPath, 'utf-8');

    // Match every root.style.setProperty('--primary'/'--primary-foreground', <value>) call
    // and assert the value expression is wrapped in hsl(...) (template literal or string),
    // not a bare "H S% L%" triplet like the regression that shipped previously.
    const setPropertyCalls = [
      ...source.matchAll(
        /setProperty\(\s*'(--primary|--primary-foreground)'\s*,\s*(`[^`]*`|'[^']*'|"[^"]*")\s*\)/g
      ),
    ];

    expect(
      setPropertyCalls.length,
      'Expected to find setProperty calls for --primary and --primary-foreground'
    ).toBeGreaterThanOrEqual(2);

    for (const match of setPropertyCalls) {
      const [, varName, valueLiteral] = match;
      expect(
        valueLiteral,
        `${varName} must be set to a value wrapped in hsl(...)/rgb(...)/etc, not a raw "H S% L%" triplet`
      ).toMatch(/^[`'"]hsl\(/i);
    }
  });
});
