import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { Compass, Home, Wrench } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Divider } from "@/components/ui/Divider";
import { BUSINESS } from "@/config/site";
import { ErrorView } from "@/components/error/ErrorView";
import { HOMEPAGE_CATEGORIES } from "@/components/home/catalog";

/**
 * A 404 must be searchable, not a dead end. It gets `noindex` (a 404 in the
 * index is a ranking liability) but every popular service is linked so a crawler
 * — and a lost visitor — has somewhere real to go.
 */
export const metadata: Metadata = {
  title: "Page not found",
  description: `That page is not on our shelf. Book a service bay, see services and prices, or call ${BUSINESS.legalName} in ${BUSINESS.address.district}, ${BUSINESS.address.province}.`,
  robots: { index: false, follow: true },
};

export default function NotFound(): ReactElement {
  return (
    <>
      <ErrorView kind="not-found" headingLevel="h1" />

      <Container size="page" className="pb-16">
        <Divider variant="checker" inset="none" className="mb-10 opacity-60" />

        <nav aria-labelledby="popular-services" className="mx-auto max-w-prose">
          <h2 id="popular-services" className="eyg-stripe pb-3 text-h2">
            Popular services
          </h2>
          <p className="mt-6 text-muted-foreground">
            These are the pages people were probably looking for.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {HOMEPAGE_CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/services#${category.slug}`}
                  className="flex min-h-14 items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 text-sm font-bold text-foreground transition-colors hover:border-foreground hover:bg-surface-muted"
                >
                  <Wrench aria-hidden="true" className="size-4 shrink-0 text-brand-500" />
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mx-auto mt-12 flex max-w-prose flex-wrap gap-3">
          <LinkButton href="/" variant="primary" size="lg">
            <Home aria-hidden="true" className="size-5" />
            Back to the homepage
          </LinkButton>
          <LinkButton href="/contact" variant="outline" size="lg">
            <Compass aria-hidden="true" className="size-5" />
            Contact &amp; directions
          </LinkButton>
        </div>
      </Container>
    </>
  );
}
