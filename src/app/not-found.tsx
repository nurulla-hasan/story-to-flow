import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, Compass } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { SiteFooter } from "@/components/shared/site-footer";
import { SiteHeader } from "@/components/shared/site-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

const notFoundLinks = [
  { id: "home", label: "Home", href: "/" },
  { id: "workflow", label: "Workflow", href: "/#workflow" },
  { id: "faq", label: "FAQ", href: "/#faq" },
  { id: "docs", label: "Docs", href: "/docs" },
];

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader links={notFoundLinks} subtitle="Page not found" />

      <main className="flex flex-1 items-center justify-center px-6 py-20">
        <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-card p-8 text-center shadow-sm shadow-foreground/5 sm:p-12">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 inset-x-0 mx-auto h-56 w-120 rounded-full bg-primary/12 blur-3xl" />
          </div>

          <Reveal className="relative flex flex-col items-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-subtle px-3 py-1 text-2xs font-medium text-primary">
              <Compass className="size-3.5" />
              Error 404
            </span>

            <p
              aria-hidden
              className="mt-6 bg-linear-to-b from-primary to-info bg-clip-text font-heading text-6xl font-semibold tracking-tight text-transparent sm:text-7xl"
            >
              404
            </p>

            <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              This scene never rendered.
            </h1>

            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              The page you followed isn&apos;t part of this story. Nothing was
              lost — your drafts stay saved in this browser.
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button nativeButton={false} render={<Link href="/" />}>
                Back to home
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/docs" />}
              >
                <BookOpen data-icon="inline-start" />
                Read the docs
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-border pt-6 text-2xs text-muted-foreground">
              <span>Try instead</span>
              {[
                { href: "/#workflow", label: "Workflow" },
                { href: "/#faq", label: "FAQ" },
                { href: "/studio", label: "Studio" },
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="transition-colors duration-200 hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
