"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";

import { faqs } from "./data";
import { Reveal } from "@/components/motion/reveal";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function FaqSection() {
  const [open, setOpen] = useState(0);
  const reduce = usePrefersReducedMotion();

  return (
    <section id="faq" className="scroll-mt-24 border-t border-border">
      <div className="mx-auto w-full max-w-4xl px-6 py-20 lg:py-28">
        <Reveal className="text-center">
          <p className="text-2xs font-semibold tracking-widest text-primary uppercase">
            Questions
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            The short answers
          </h2>
        </Reveal>

        <Reveal delay={100}>
          <div className="mt-10 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {faqs.map((faq, index) => {
              const isOpen = open === index;

              return (
                <div key={faq.question}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? -1 : index)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${index}`}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium transition-colors duration-200 hover:text-primary"
                  >
                    <span>{faq.question}</span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ type: "spring", stiffness: 320, damping: 24 }}
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border",
                        isOpen
                          ? "border-primary/40 bg-brand-subtle text-primary"
                          : "border-border bg-surface-subtle text-muted-foreground"
                      )}
                    >
                      <ChevronDown className="size-4" />
                    </motion.span>
                  </button>

                  <div id={`faq-panel-${index}`}>
                    <AnimatePresence initial={false}>
                      {isOpen ? (
                        <motion.div
                          key="panel"
                          initial={reduce ? false : { height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={reduce ? undefined : { height: 0, opacity: 0 }}
                          transition={{
                            height: { duration: reduce ? 0 : 0.32, ease: easeOut },
                            opacity: { duration: reduce ? 0 : 0.2 },
                          }}
                          className="overflow-hidden"
                        >
                          <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
                            {faq.answer}
                          </p>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
