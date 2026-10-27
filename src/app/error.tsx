"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-20 text-foreground">
      <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 text-center shadow-sm shadow-foreground/5">
        <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-warning-subtle text-warning">
          <TriangleAlert className="size-5" />
        </span>

        <h1 className="mt-5 font-heading text-2xl font-semibold tracking-tight">
          The compiler hit a snag.
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Something broke while rendering this view. Your saved story and plans
          are untouched — retry, or head back home.
        </p>

        {error.digest ? (
          <p className="mt-4 font-mono text-3xs text-muted-foreground">
            error id · {error.digest}
          </p>
        ) : null}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button onClick={() => reset()}>
            <RotateCcw data-icon="inline-start" />
            Try again
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
            Back to home
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </main>
  );
}
