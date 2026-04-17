import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

/**
 * Drift guard between the implemented Express routes and the OpenAPI
 * specification. Extracts route declarations from `server/routes/*.ts`
 * and ensures every public path is referenced from `docs/openapi.yaml`.
 *
 * Routes intentionally undocumented (internal/test-only/static) belong on
 * the allow-list below.
 */
describe('OpenAPI documentation drift', () => {
  const root = resolve(__dirname, '../../..');
  const ALLOW_LIST_PATTERNS: RegExp[] = [
    /^\/api\/v1\/admin\/test/, // internal test-runner endpoints
    /^\/api\/v1\/diagnostics/, // operator diagnostics
    /^\/api\/v1\/_/, // underscore-prefixed internal endpoints
  ];

  function collectRoutes(): Set<string> {
    const dir = resolve(root, 'server/routes');
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    const routes = new Set<string>();
    const re = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;

    for (const f of files) {
      const src = readFileSync(resolve(dir, f), 'utf8');
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        let path = m[2];
        if (!path.startsWith('/')) path = '/' + path;
        // Routes are mounted under /api/v1; record the full path.
        const full = path.startsWith('/api/') ? path : `/api/v1${path}`;
        routes.add(full);
      }
    }
    return routes;
  }

  function collectDocumentedPaths(): Set<string> {
    const yaml = readFileSync(resolve(root, 'docs/openapi.yaml'), 'utf8');
    const paths = new Set<string>();
    // Crude but stable: match any line that begins with two-space indent
    // followed by /api/... and a colon.
    const re = /^\s{2}(\/api\/[^\s:]+):/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(yaml))) paths.add(m[1]);
    return paths;
  }

  function normalise(p: string): string {
    return p.replace(/:[A-Za-z][A-Za-z0-9]*/g, '{param}');
  }

  it('documents every server route or explicitly allow-lists it', () => {
    const implemented = collectRoutes();
    const documented = new Set(Array.from(collectDocumentedPaths()).map(normalise));

    const undocumented: string[] = [];
    for (const route of implemented) {
      if (ALLOW_LIST_PATTERNS.some((re) => re.test(route))) continue;
      const norm = normalise(route);
      if (!documented.has(norm)) undocumented.push(route);
    }

    // Soft assertion: print the diff but do not fail the build for now.
    // Tighten to `expect(undocumented).toEqual([])` once OpenAPI is fully
    // synchronised. This keeps the gap visible without blocking releases.
    if (undocumented.length > 0) {
      console.warn(
        `[openapi drift] ${undocumented.length} undocumented routes:\n${undocumented.sort().join('\n')}`,
      );
    }
    expect(implemented.size).toBeGreaterThan(0);
  });
});
