import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

export function DocsCta() {
  return (
    <section className="px-6 pb-20">
      <Reveal className="mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-3xl border border-brand-border bg-linear-to-br from-primary/12 via-card to-info/12 px-6 py-10 text-center sm:px-10">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-20 inset-x-0 mx-auto h-48 w-96 rounded-full bg-primary/15 blur-3xl" />
          </div>

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-card/70 px-3 py-1 text-2xs font-medium text-primary backdrop-blur-sm">
              <Sparkles className="size-3.5" />
              Ready when you are
            </span>

            <h2 className="mt-4 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Put the guide to work.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Paste a story, lock the world, and export your first scene-by-scene
              plan in minutes.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button size="lg" nativeButton={false} render={<Link href="/studio" />}>
                Open studio
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<Link href="/#workflow" />}
              >
                See the workflow
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
