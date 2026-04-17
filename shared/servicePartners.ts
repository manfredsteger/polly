/**
 * Single source of truth for service partner metadata.
 *
 * Used by:
 *   - README.md "Service Partners" section (manually synced – guarded by test)
 *   - client/src/components/admin/settings/AiSettingsPanel.tsx (KISSKI block)
 *
 * If you add or change a partner, update README.md accordingly. The test
 * `server/tests/unit/servicePartners.test.ts` enforces that every entry
 * here is referenced from the README.
 */

export interface ServicePartner {
  id: string;
  name: string;
  shortName: string;
  url: string;
  contactUrl: string;
  logoPath: string;
  descriptionEn: string;
  descriptionDe: string;
}

export const SERVICE_PARTNERS: ServicePartner[] = [
  {
    id: 'gwdg',
    name: 'GWDG – Gesellschaft für wissenschaftliche Datenverarbeitung mbH Göttingen',
    shortName: 'GWDG',
    url: 'https://gwdg.de/',
    contactUrl: 'https://gwdg.de/about-us/contact/',
    logoPath: 'docs/gwdg-logo.svg',
    descriptionEn:
      "The GWDG is the joint computing and IT competence center for the Georg-August-Universität Göttingen and the Max Planck Society. As infrastructure partner, they provide the hosting and computing resources that power Polly's self-hosted deployment capabilities.",
    descriptionDe:
      'Die GWDG ist das gemeinsame Rechen- und IT-Kompetenzzentrum der Georg-August-Universität Göttingen und der Max-Planck-Gesellschaft. Als Infrastrukturpartner stellt sie die Hosting- und Rechenressourcen bereit, die das Self-Hosting von Polly ermöglichen.',
  },
  {
    id: 'kisski',
    name: 'KISSKI – KI-Servicezentrum für sensible und kritische Infrastrukturen',
    shortName: 'KISSKI',
    url: 'https://kisski.gwdg.de/',
    contactUrl: 'https://kisski.gwdg.de/en/ueber-uns/kontakt/',
    logoPath: 'docs/kisski-logo.svg',
    descriptionEn:
      "KISSKI is a BMBF-funded AI service center operated by the GWDG, providing free AI inference capabilities for research and public infrastructure. Polly uses KISSKI's OpenAI-compatible API to offer AI-powered agentic control for poll creation – hosted in Germany, GDPR-compliant, and offers a free AI tier for every Polly user (please get in touch with GWDG/KISSKI for an AI production licence).",
    descriptionDe:
      'KISSKI ist ein vom BMBF gefördertes KI-Servicezentrum der GWDG, das KI-Inferenz für Forschung und öffentliche Infrastruktur bereitstellt. Polly nutzt die OpenAI-kompatible API von KISSKI für die KI-gestützte Umfrageerstellung – gehostet in Deutschland, DSGVO-konform und mit kostenlosem AI-Tier für jede Polly-Installation (für Produktionslizenzen bitte direkt mit GWDG/KISSKI Kontakt aufnehmen).',
  },
];

export function getServicePartner(id: string): ServicePartner | undefined {
  return SERVICE_PARTNERS.find((p) => p.id === id);
}
