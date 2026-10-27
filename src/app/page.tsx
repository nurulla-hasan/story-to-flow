import type { Metadata } from "next";

import { ConsistencySection } from "@/components/landing/consistency-section";
import { CtaSection } from "@/components/landing/cta-section";
import { FaqSection } from "@/components/landing/faq-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { TrustStrip } from "@/components/landing/trust-strip";
import { WorkflowSection } from "@/components/landing/workflow-section";
import { landingLinks } from "@/components/shared/nav-links";
import { SiteFooter } from "@/components/shared/site-footer";
import { SiteHeader } from "@/components/shared/site-header";
import { siteDescription, siteTitle } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: siteTitle },
  description: siteDescription,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader links={landingLinks} />

      <main className="flex-1">
        <HeroSection />
        <TrustStrip />
        <FeaturesSection />
        <WorkflowSection />
        <ConsistencySection />
        <FaqSection />
        <CtaSection />
      </main>

      <SiteFooter />
    </div>
  );
}
