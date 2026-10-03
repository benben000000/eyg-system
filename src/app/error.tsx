"use client";

import * as React from "react";
import { ErrorView } from "@/components/error/ErrorView";

/**
 * Route-level error boundary.
 *
 * A client component because it needs `reset()`. The "Call the shop" escape
 * hatch lives inside `<ErrorView />` — a customer who was mid-booking when the
 * page died must never be trapped here with no way to reach a human.
 *
 * The `digest` is shown in development only, and `console.error` fires in
 * development only, so production logs stay clean of expected re-renders.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  React.useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // Dev-only. Stripped from production behaviour by the guard, so prod logs
      // never fill with expected re-renders.
      console.error(error);
    }
  }, [error]);

  return (
    <ErrorView
      kind="server-error"
      onRetry={reset}
      retryLabel="Try again"
      digest={error.digest}
      headingLevel="h1"
    />
  );
}
