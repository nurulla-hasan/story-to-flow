"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useSpring } from "motion/react";
import { cn } from "cn";
import { BookOpen } from "lucide-react";

import { docsLinks } from "./docs-data";

const spring = { type: "spring", stiffness: 420, damping: 34 } as const;

export function DocsToc() {
  const [active, setActive] = useState("");

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 26,
    restDelta: 0.0005,
  });

  useEffect(() => {
    const sections = docsLinks
      .map((link) => document.getElementById(link.id))
      .filter((section): section is HTMLElement => section !== null);

    if (sections.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }

        const next = docsLinks.find((link) => visible.has(link.id))?.id ?? "";
        setActive(next);
      },
      { rootMargin: "-24% 0px -62% 0px" }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="lg:sticky lg:top-24">
      <div className="hidden rounded-2xl border border-border bg-card p-4 lg:block">
        <p className="flex items-center gap-1.5 text-3xs font-semibold tracking-widest text-muted-foreground uppercase">
          <BookOpen className="size-3.5 text-primary" />
          On this page
        </p>

        <ul className="mt-3 space-y-1">
          {docsLinks.map((link, index) => {
            const isActive = active === link.id;

            return (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-2xs transition-colors duration-200",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="docs-toc-active"
                      transition={spring}
                      className="absolute inset-0 rounded-lg bg-brand-subtle"
                    />
                  ) : null}
                  <span className="relative font-mono text-3xs text-muted-foreground">
                    0{index + 1}
                  </span>
                  <span className="relative">{link.label}</span>
                </a>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center justify-between text-3xs text-muted-foreground">
            <span>Reading progress</span>
            <span className="font-mono">v1.5.7</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
            <motion.div
              style={{ scaleX: progress }}
              className="h-full origin-left rounded-full bg-linear-to-r from-primary to-info"
            />
          </div>
        </div>
      </div>

      <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 lg:hidden">
        {docsLinks.map((link) => (
          <a
            key={link.id}
            href={`#${link.id}`}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-2xs transition-colors duration-200",
              active === link.id
                ? "border-brand-border bg-brand-subtle text-primary"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
