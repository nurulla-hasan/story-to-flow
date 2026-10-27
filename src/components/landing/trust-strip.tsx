"use client";

import { useEffect, useRef } from "react";
import { motion, useAnimationFrame, useMotionValue } from "motion/react";

import { trustItems } from "./data";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

export function TrustStrip() {
  const x = useMotionValue(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);
  const pausedRef = useRef(false);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      widthRef.current = track.scrollWidth / 2;
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  useAnimationFrame((_, delta) => {
    if (reduce || pausedRef.current || widthRef.current <= 0) return;

    const next = x.get() - delta * 0.04;

    x.set(next <= -widthRef.current ? next + widthRef.current : next);
  });

  return (
    <div
      className="border-y border-border bg-surface-subtle"
      onPointerEnter={() => {
        pausedRef.current = true;
      }}
      onPointerLeave={() => {
        pausedRef.current = false;
      }}
      onFocusCapture={() => {
        pausedRef.current = true;
      }}
      onBlurCapture={() => {
        pausedRef.current = false;
      }}
    >
      <div className="landing-marquee overflow-hidden py-5">
        <motion.div ref={trackRef} style={{ x }} className="flex w-max">
          {[0, 1].map((copy) => (
            <ul
              key={copy}
              aria-hidden={copy === 1}
              className="flex items-center gap-12 pr-12 text-2xs tracking-widest text-muted-foreground uppercase"
            >
              {trustItems.map((item) => {
                const Icon = item.icon;

                return (
                  <li key={item.label} className="flex items-center gap-2.5">
                    <Icon className="size-3.5 text-primary" />
                    {item.label}
                    <span className="ml-7 size-1 rounded-full bg-primary/40" />
                  </li>
                );
              })}
            </ul>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
