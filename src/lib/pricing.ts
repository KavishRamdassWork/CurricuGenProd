/**
 * Plan pricing, safe to import from client components (no Node-only imports).
 * Single source of truth for checkout, the ITN amount check, the pricing page and the legal pages.
 */

/** Price of the Pro plan in ZAR, per month. Matches the amount PayFast charges. */
export const PRO_PRICE_ZAR = '180.00';

/** Human-readable price, e.g. "R180.00". */
export const PRO_PRICE_DISPLAY = `R${PRO_PRICE_ZAR}`;
