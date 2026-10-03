/**
 * CONTACT FACT VERIFICATION
 * ============================================================================
 * `src/config/site.ts` is the single source of truth for the phone number, but
 * the number it currently holds is a `TODO-VERIFY` placeholder. Shipping a
 * `tel:` link to `+639000000000` means a stranded customer dials nothing, so
 * every phone/WhatsApp surface in the UI is gated on `CONTACT_VERIFIED`.
 *
 * The moment the owner confirms the real number in `site.ts` and deletes the
 * flag there, this file flips to `true` and the whole site lights up. No other
 * change is required.
 */
import { BUSINESS, LINKS, isUnverifiedPhone } from "@/config/site";

/**
 * Contact verification.
 *
 * Delegates to `isUnverifiedPhone()` in `site.ts` rather than comparing against a
 * literal placeholder, because the real number is now configured — a literal
 * comparison would be folded at compile time and stop being a runtime guard.
 */
export const CONTACT_VERIFIED =
  !isUnverifiedPhone(BUSINESS.phoneE164) && !isUnverifiedPhone(BUSINESS.whatsappNumber);

/**
 * A real, dialable number — or `null`. Components must handle `null`; they must
 * never fall back to a placeholder href.
 */
export const PHONE_HREF: string | null = CONTACT_VERIFIED ? LINKS.call : null;
export const WHATSAPP_HREF: string | null = CONTACT_VERIFIED ? LINKS.whatsapp : null;
export const MESSENGER_HREF = BUSINESS.social.messenger;

/** Number as shown to humans. */
export const PHONE_DISPLAY = BUSINESS.phoneDisplay;

/** Copy shown wherever the unverified number would otherwise have been a link. */
export const CONTACT_PENDING_NOTE =
  "The shop's phone number is being confirmed. Message us on Facebook and we will reply fast.";

/** Trust facts that are still unconfirmed must not be rendered as numbers. */
/** Owner sign-off on the warranty period is still pending. */
export const WARRANTY_DAYS_CLAIMABLE = false;

export const RATING_CLAIMABLE = BUSINESS.trust.ratingCount > 0;
export const YEARS_CLAIMABLE = BUSINESS.trust.yearsServing > 0;
export const BAYS_CLAIMABLE = BUSINESS.trust.bays > 0;
export const TECHS_CLAIMABLE = BUSINESS.trust.technicians > 0;

/** Tyre brands are only listed once the shop confirms what it is authorised to sell. */
export const TIRE_BRANDS_CLAIMABLE = false;

/** Payment methods are not flagged TODO-VERIFY in `site.ts` — safe to publish. */
export const PAYMENT_METHODS = BUSINESS.paymentMethods;

export const ADDRESS_SHORT = `${BUSINESS.address.street}, ${BUSINESS.address.district}`;
