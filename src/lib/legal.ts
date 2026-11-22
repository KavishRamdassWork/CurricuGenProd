/**
 * Business details and versioning for the legal documents (EULA / refund policy).
 *
 * Every value wrapped in [SQUARE BRACKETS] is a placeholder the business owner MUST replace before
 * going live. PayFast (and the acquiring bank) require the supplier's real identity and contact
 * details on the website, and South African law (ECTA s43) requires them for online sales.
 * `unfilledLegalPlaceholders()` lists any still outstanding so a test or a deploy check can fail on them.
 */
export const LEGAL = {
  productName: 'CurricuGen Pro',

  // ---- Supplier identity (REPLACE the bracketed values) ----
  companyName: '[REGISTERED BUSINESS NAME]',
  tradingAs: 'CurricuGen Pro',
  legalStatus: '[LEGAL STATUS, e.g. Sole proprietor / (Pty) Ltd]',
  registrationNumber: '[COMPANY OR BUSINESS REGISTRATION NUMBER]',
  vatStatus: '[VAT NUMBER, or "Not registered for VAT"]',
  physicalAddress: '[PHYSICAL ADDRESS, SOUTH AFRICA]',
  country: 'South Africa',
  supportEmail: '[SUPPORT EMAIL ADDRESS]',
  supportPhone: '[OPTIONAL: SUPPORT PHONE NUMBER]',
  informationOfficerEmail: '[INFORMATION OFFICER EMAIL ADDRESS]',
  /** Named in the Privacy Policy, e.g. "Vercel and Neon". */
  hostingProviders: '[HOSTING AND DATABASE PROVIDER NAMES]',

  // ---- Versioning: bump `version` whenever either document changes materially ----
  /** Recorded alongside a buyer's acceptance at checkout. */
  version: '2026-11-22',
  effectiveDate: '22 November 2026',
} as const;

/** Bracketed placeholder values that have not been replaced yet. */
export function unfilledLegalPlaceholders(): string[] {
  return Object.entries(LEGAL)
    .filter(([, value]) => typeof value === 'string' && /\[[^\]]+\]/.test(value))
    .map(([key]) => key);
}
