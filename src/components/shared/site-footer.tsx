import Link from "next/link";
import { ShieldCheck, Sparkles } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";

const productLinks = [
  { href: "/studio", label: "Studio" },
  { href: "/editor", label: "Video editor" },
  { href: "/settings", label: "Settings" },
];

const learnLinks = [
  { href: "/docs", label: "Documentation" },
  { href: "/#workflow", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-subtle">
      <Reveal className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="flex flex-col justify-between gap-10 sm:flex-row">
          <div className="max-w-sm">
            <Link href="/" className="group flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-primary to-info text-primary-foreground transition-transform duration-500 group-hover:rotate-12">
                <Sparkles className="size-4" />
              </span>
              <span className="font-heading text-sm font-semibold">
                Story to Flow
              </span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Locked facts, code-assembled prompts, and frame-level continuity
              for creators working in Google Flow.
            </p>
          </div>

          <div className="flex gap-16">
            <div>
              <p className="text-2xs font-semibold tracking-widest uppercase">
                Product
              </p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {productLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="inline-block transition-all duration-200 hover:translate-x-0.5 hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-2xs font-semibold tracking-widest uppercase">
                Learn
              </p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {learnLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="inline-block transition-all duration-200 hover:translate-x-0.5 hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-2xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© 2026 Story to Flow. Built for Google Flow creators.</p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-success" />
            Local-first by default
          </p>
        </div>
      </Reveal>
    </footer>
  );
}
