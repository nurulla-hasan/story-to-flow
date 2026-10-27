import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";

interface DocsSectionProps {
  id: string;
  index: string;
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}

export function DocsSection({
  id,
  index,
  icon: Icon,
  title,
  description,
  children,
}: DocsSectionProps) {
  return (
    <section id={id} className="scroll-mt-28">
      <Reveal>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm shadow-foreground/5 transition-colors duration-300 hover:border-primary/25 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-subtle text-primary">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-3xs tracking-widest text-muted-foreground uppercase">
                Section {index}
              </p>
              <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                {title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          </div>

          <div className="mt-6">{children}</div>
        </div>
      </Reveal>
    </section>
  );
}
