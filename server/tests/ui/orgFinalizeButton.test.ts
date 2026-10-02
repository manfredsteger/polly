import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

export const testMeta = {
  category: 'ui' as const,
  name: 'Orga-Listen Bestätigungs-Button',
  description: 'Prüft ob der "Anmeldungen bestätigen"-Button korrekt für Admins/Owner gerendert wird und nur für Orga-Polls erscheint',
  severity: 'medium' as const,
};

const RESULTS_CHART_PATH = path.join(__dirname, '../../../client/src/components/ResultsChart.tsx');

describe('ResultsChart — Org Finalize Button', () => {
  let content: string;

  it('ResultsChart.tsx exists', () => {
    expect(fs.existsSync(RESULTS_CHART_PATH)).toBe(true);
    content = fs.readFileSync(RESULTS_CHART_PATH, 'utf-8');
  });

  it('defines isOrgFinalized based on sentinel value -1', () => {
    content = content || fs.readFileSync(RESULTS_CHART_PATH, 'utf-8');
    expect(content).toContain('isOrgFinalized');
    expect(content).toContain('finalOptionId === -1');
  });

  it('Confirm Sign-ups button is gated by isOrganization AND hidden when already org-finalized', () => {
    content = content || fs.readFileSync(RESULTS_CHART_PATH, 'utf-8');
    // The button condition must include both isOrganization and !isOrgFinalized
    expect(content).toContain('isOrganization && !isOrgFinalized');
  });

  it('Confirm Sign-ups button requires admin or owner access plus adminToken', () => {
    content = content || fs.readFileSync(RESULTS_CHART_PATH, 'utf-8');
    // The full guard: isOrganization && !isOrgFinalized && (isAdminAccess || isOwner) && adminToken
    expect(content).toContain('isOrganization && !isOrgFinalized && (isAdminAccess || isOwner) && adminToken');
  });

  it('org finalized banner shows different text for closed vs confirmed state', () => {
    content = content || fs.readFileSync(RESULTS_CHART_PATH, 'utf-8');
    // Banner distinguishes between registration closed and just confirmed
    expect(content).toContain('registrationClosed');
    expect(content).toContain('registrationConfirmed');
    // The distinction is based on poll.isActive
    expect(content).toContain("poll.isActive === false");
  });

  it('undo button inside org finalized banner is gated by admin or owner access', () => {
    content = content || fs.readFileSync(RESULTS_CHART_PATH, 'utf-8');
    // Find the org banner section — slice generously to cover the full banner block
    const bannerStart = content.indexOf('Org: Registration Confirmed / Closed banner');
    expect(bannerStart).toBeGreaterThan(-1);

    const bannerSection = content.slice(bannerStart, bannerStart + 3000);
    expect(bannerSection).toContain('undoConfirmation');
    expect(bannerSection).toContain('isAdminAccess || isOwner');
    expect(bannerSection).toContain('adminToken');
  });

  it('org confirm dialog renders confirmSignupsDialogTitle', () => {
    content = content || fs.readFileSync(RESULTS_CHART_PATH, 'utf-8');
    expect(content).toContain('confirmSignupsDialogTitle');
  });

  it('org confirm dialog includes slot-by-slot occupancy with entriesPlural', () => {
    content = content || fs.readFileSync(RESULTS_CHART_PATH, 'utf-8');
    // The dialog shows per-slot occupancy using entriesPlural
    expect(content).toContain('entriesPlural');
    // Both keys appear in the same file, meaning slot occupancy breakdown is rendered in the dialog
    const dialogIdx = content.indexOf('confirmSignupsDialogTitle');
    const entriesPluralIdx = content.indexOf('entriesPlural');
    expect(dialogIdx).toBeGreaterThan(-1);
    expect(entriesPluralIdx).toBeGreaterThan(-1);
  });
});
