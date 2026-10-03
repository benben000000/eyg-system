/**
 * EYG — SINGLE LUCIDE ICON SURFACE
 * ============================================================================
 * Every `lucide-react` import on the public content pages goes through this
 * file. If an icon name ever needs swapping (or `optimizePackageImports`
 * behaviour changes), there is exactly one file to edit instead of forty.
 *
 * Icons are chosen for legibility at 20–24px on a dark motorsport background.
 * Icon names are long-standing lucide exports — no experimental names.
 * ============================================================================
 */

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Battery,
  Calendar,
  Camera,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  CreditCard,
  Disc3,
  Droplet,
  ExternalLink,
  Eye,
  FileText,
  Gauge,
  Handshake,
  HelpCircle,
  Image as ImageIcon,
  Info,
  LifeBuoy,
  ListChecks,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Maximize2,
  MessageCircle,
  MessageSquare,
  Minus,
  Moon,
  Navigation,
  Percent,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  Sunset,
  Tag,
  ThumbsUp,
  TriangleAlert,
  Truck,
  Wallet,
  WifiOff,
  Wind,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * `CATEGORY_ICON_KEYS` — the `ServiceCategory.icon` strings used by
 * `src/content/catalog.ts`. Unknown keys fall back to `Wrench` rather than
 * throwing, so adding a category to the catalogue can never crash a page.
 */
export const CATEGORY_ICON_KEYS: Readonly<Record<string, LucideIcon>> = {
  tire: CircleDot,
  wheel: CircleDot,
  alignment: Gauge,
  oil: Droplet,
  droplet: Droplet,
  engine: Settings,
  settings: Settings,
  undercoating: ShieldCheck,
  shield: ShieldCheck,
  ac: Snowflake,
  snowflake: Snowflake,
  brake: Disc3,
  disc: Disc3,
  battery: Battery,
  roadside: LifeBuoy,
  lifebuoy: LifeBuoy,
  tow: Truck,
  shop: Car,
};

export function categoryIcon(key: string | null | undefined): LucideIcon {
  if (!key) return Wrench;
  return CATEGORY_ICON_KEYS[key] ?? Wrench;
}

/** Payment-method icon keys from `BUSINESS.paymentMethods[].icon`. */
export const PAYMENT_ICON_KEYS: Readonly<Record<string, LucideIcon>> = {
  banknote: Wallet,
  smartphone: Smartphone,
  wallet: Wallet,
  "credit-card": CreditCard,
  calendar: Calendar,
};

export function paymentIcon(key: string): LucideIcon {
  return PAYMENT_ICON_KEYS[key] ?? CreditCard;
}

export {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Battery,
  Calendar,
  Camera,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  CreditCard,
  Disc3,
  Droplet,
  ExternalLink,
  Eye,
  FileText,
  Gauge,
  Handshake,
  HelpCircle,
  ImageIcon,
  Info,
  LifeBuoy,
  ListChecks,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Maximize2,
  MessageCircle,
  MessageSquare,
  Minus,
  Moon,
  Navigation,
  Percent,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  Sunset,
  Tag,
  ThumbsUp,
  TriangleAlert,
  Truck,
  Wallet,
  WifiOff,
  Wind,
  Wrench,
  X,
};

export type { LucideIcon };
