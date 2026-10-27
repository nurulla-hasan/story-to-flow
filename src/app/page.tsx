import { ConsistencySection } from "@/components/landing/consistency-section";
import { CtaSection } from "@/components/landing/cta-section";
import { FaqSection } from "@/components/landing/faq-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { TrustStrip } from "@/components/landing/trust-strip";
import { WorkflowSection } from "@/components/landing/workflow-section";
import { SiteFooter } from "@/components/shared/site-footer";
import { SiteHeader } from "@/components/shared/site-header";

const landingLinks = [
  { id: "features", label: "Features" },
  { id: "workflow", label: "Workflow" },
  { id: "consistency", label: "Consistency" },
  { id: "faq", label: "FAQ" },
  { id: "docs", label: "Docs", href: "/docs" },
];

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
