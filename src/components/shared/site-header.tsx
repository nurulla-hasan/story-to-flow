"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
} from "motion/react";
import { ArrowRight, Menu, Sparkles, X } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

export interface SiteNavLink {
  id: string;
  label: string;
  /** Route destination (e.g. `/docs`). Anchors without `href` drive the scrollspy. */
  href?: string;
}

interface SiteHeaderProps {
  links: SiteNavLink[];
  subtitle?: string;
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function SiteHeader({
  links,
  subtitle = "Prompt engine for video",
}: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const reduce = usePrefersReducedMotion();
  const pathname = usePathname();

  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 160,
    damping: 26,
    restDelta: 0.0005,
  });

  useMotionValueEvent(scrollY, "change", (value) => {
    setScrolled(value > 8);
  });

  useEffect(() => {
    const anchorLinks = links.filter((link) => !link.href);
    const sections = anchorLinks
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

        const next = anchorLinks.find((link) => visible.has(link.id))?.id ?? "";
        setActive(next);
      },
      { rootMargin: "-38% 0px -52% 0px" }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [links]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (query.matches) setMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    query.addEventListener("change", onChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      query.removeEventListener("change", onChange);
    };
  }, [menuOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b backdrop-blur-xl transition-[box-shadow,border-color,background-color] duration-300",
        scrolled
          ? "border-border bg-background/90 shadow-sm shadow-foreground/5"
          : "border-transparent bg-background/70"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-3">
          <motion.span
            whileHover={reduce ? undefined : { rotate: 12, scale: 1.06 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-primary to-info text-primary-foreground shadow-lg shadow-primary/25"
          >
            <Sparkles className="size-5" />
          </motion.span>
          <span className="flex flex-col leading-tight">
            <span className="font-heading text-sm font-semibold tracking-tight">
              Story to Flow
            </span>
            <span className="text-2xs text-muted-foreground">{subtitle}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm lg:flex">
          {links.map((link) => {
            const isActive = link.href ? pathname === link.href : active === link.id;
            const itemClass = cn(
              "relative py-2 transition-colors duration-200",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            );
            const underline = isActive ? (
              <motion.span
                layoutId="site-nav-active"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-primary"
              />
            ) : null;

            return link.href ? (
              <Link key={link.id} href={link.href} className={itemClass}>
                {link.label}
                {underline}
              </Link>
            ) : (
              <a key={link.id} href={`#${link.id}`} className={itemClass}>
                {link.label}
                {underline}
              </a>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />

          <div className="hidden sm:block">
            <Button nativeButton={false} render={<Link href="/studio" />}>
              Open studio
              <ArrowRight
                data-icon="inline-end"
                className="transition-transform duration-300 group-hover/button:translate-x-0.5"
              />
            </Button>
          </div>

          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="site-mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex size-9 items-center justify-center rounded-xl border border-border/60 bg-card/80 text-foreground backdrop-blur-xs transition-colors hover:bg-muted lg:hidden"
          >
            {menuOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {menuOpen ? (
          <motion.div
            id="site-mobile-nav"
            key="site-mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.3, ease: easeOut }}
            className="overflow-hidden border-t border-border bg-background/95 backdrop-blur-xl lg:hidden"
          >
            <nav className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-6 py-4">
              {links.map((link, index) => {
                const itemClass =
                  "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

                return (
                  <motion.div
                    key={link.id}
                    initial={reduce ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.3,
                      delay: reduce ? 0 : 0.04 * index,
                      ease: easeOut,
                    }}
                  >
                    {link.href ? (
                      <Link
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className={itemClass}
                      >
                        {link.label}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    ) : (
                      <a
                        href={`#${link.id}`}
                        onClick={() => setMenuOpen(false)}
                        className={itemClass}
                      >
                        {link.label}
                        <ArrowRight className="size-3.5" />
                      </a>
                    )}
                  </motion.div>
                );
              })}

              <div className="mt-3 sm:hidden">
                <Button
                  nativeButton={false}
                  render={
                    <Link href="/studio" onClick={() => setMenuOpen(false)} />
                  }
                >
                  Open studio
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5">
        <motion.div
          style={{ scaleX: progress }}
          className="h-full origin-left bg-linear-to-r from-primary to-info"
        />
      </div>
    </header>
  );
}
