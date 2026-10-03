import type { Metadata } from "next";
import { BUSINESS, SITE } from "@/config/site";

interface PageSeoInput {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  image?: string;
  type?: "website" | "article";
  noIndex?: boolean;
}

/**
 * Builds consistent metadata. All titles follow
 * "<Page> | EYG Tire & Auto Care — Balanga" for local SEO clarity.
 */
export function pageSeo({
  title,
  description,
  path,
  keywords = [],
  image = "/og/default.png",
  type = "website",
  noIndex = false,
}: PageSeoInput): Metadata {
  const url = `${SITE.url}${path === "/" ? "" : path}`;
  const fullTitle = path === "/" ? `${title}` : `${title} | EYG Tire & Auto Care — Balanga`;

  return {
    /**
     * `absolute` is required: the root layout declares
     * `title.template = "%s | EYG Tire & Auto Care"`, and a bare string here would
     * be wrapped a second time, emitting
     * "… | EYG Tire & Auto Care — Balanga | EYG Tire & Auto Care" on every page.
     */
    title: { absolute: fullTitle },
    description,
    keywords: [
      "tire shop Balanga",
      "auto care Bataan",
      "PMS Balanga",
      "wheel alignment Balanga",
      "tire change Bataan",
      "EGSA Fourlanes",
      ...keywords,
    ],
    alternates: { canonical: url },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
        },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: BUSINESS.legalName,
      locale: "en_PH",
      type,
      images: [{ url: image.startsWith("http") ? image : `${SITE.url}${image}`, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image.startsWith("http") ? image : `${SITE.url}${image}`],
    },
  };
}

/** LocalBusiness / AutoRepair JSON-LD. Single source for the whole site. */
export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    "@id": `${SITE.url}/#business`,
    name: BUSINESS.legalName,
    description: `Tire and auto care centre in ${BUSINESS.address.district}, ${BUSINESS.address.province} — preventive maintenance service, wheel alignment, tire change, brakes, undercoating and aircon repair.`,
    url: SITE.url,
    telephone: BUSINESS.phoneE164,
    email: BUSINESS.email,
    image: `${SITE.url}/og/default.png`,
    logo: `${SITE.url}/brand/logo-primary.svg`,
    priceRange: "₱₱",
    currenciesAccepted: "PHP",
    paymentAccepted: "Cash, GCash, Maya, Credit Card, Debit Card, Credit Installment",
    address: {
      "@type": "PostalAddress",
      streetAddress: BUSINESS.address.street,
      addressLocality: BUSINESS.address.district,
      addressRegion: BUSINESS.address.province,
      postalCode: BUSINESS.address.postalCode,
      addressCountry: BUSINESS.address.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: BUSINESS.address.lat, longitude: BUSINESS.address.lng },
    sameAs: [BUSINESS.social.facebook],
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], opens: "08:00", closes: "17:00" },
    ],
    areaServed: [
      { "@type": "City", name: "Balanga City" },
      { "@type": "AdministrativeArea", name: "Bataan" },
    ],
    makesOffer: ["Preventive Maintenance Service", "Wheel Alignment", "Tire Change", "Brake Repair", "Undercoating", "Car Aircon Repair"].map((n) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: n },
    })),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    url: SITE.url,
    name: BUSINESS.legalName,
    publisher: { "@id": `${SITE.url}/#business` },
    inLanguage: "en-PH",
  };
}

export function breadcrumbJsonLd(trail: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE.url}${item.path === "/" ? "" : item.path}`,
    })),
  };
}

export function faqJsonLd(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}
