/**
 * Layout barrel.
 *
 * `Container` / `Section` / `SectionHeading` / `Breadcrumbs` are re-exported
 * from `@/components/ui` so page agents can import everything structural from
 * one place regardless of which folder it physically lives in.
 */
export { BrandLockup, LOGO_ALT, LOGO_SRC, USE_LOGO_IMAGE } from "./BrandLockup";
export { EmergencyBanner, type EmergencyBannerProps } from "./EmergencyBanner";
export { Footer } from "./Footer";
export { Header, type HeaderProps } from "./Header";
export { HIDE_ACTION_BAR_EVENT, MobileActionBar, type MobileActionBarProps } from "./MobileActionBar";
export { OpenStatusPill, type OpenStatusPillProps } from "./OpenStatusPill";
export { SkipLink } from "./SkipLink";
export { ThemeToggle } from "./ThemeToggle";
export { TopBar } from "./TopBar";
export { HEADER_CTA, PRIMARY_NAV, type NavItem } from "./nav";
export { formatSchedule, getOpenStatus, type OpenStatus } from "./hours";
export {
  ADDRESS_SHORT,
  BAYS_CLAIMABLE,
  CONTACT_PENDING_NOTE,
  CONTACT_VERIFIED,
  MESSENGER_HREF,
  PAYMENT_METHODS,
  PHONE_DISPLAY,
  PHONE_HREF,
  RATING_CLAIMABLE,
  TIRE_BRANDS_CLAIMABLE,
  TECHS_CLAIMABLE,
  WARRANTY_DAYS_CLAIMABLE,
  WHATSAPP_HREF,
  YEARS_CLAIMABLE,
} from "./business";

/* Structural primitives, re-exported for convenience. */
export { Breadcrumbs, type BreadcrumbItem, type BreadcrumbsProps } from "@/components/ui/Breadcrumbs";
export { Container, type ContainerProps } from "@/components/ui/Container";
export { Section, type SectionProps } from "@/components/ui/Section";
export { SectionHeading, type SectionHeadingProps } from "@/components/ui/SectionHeading";
