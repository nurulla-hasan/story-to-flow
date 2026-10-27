import { DocsCta } from "@/components/docs/docs-cta";
import { DocsHero } from "@/components/docs/docs-hero";
import { DocsSection } from "@/components/docs/docs-section";
import { DocsToc } from "@/components/docs/docs-toc";
import { HandoffSection } from "@/components/docs/handoff-section";
import { SpecsSection } from "@/components/docs/specs-section";
import { StyleDirectory } from "@/components/docs/style-directory";
import { TimingSection } from "@/components/docs/timing-section";
import { WorkflowGuide } from "@/components/docs/workflow-guide";
import { sectionIcons } from "@/components/docs/docs-data";

export default function DocsPage() {
  return (
    <>
      <DocsHero />

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 lg:grid-cols-4 lg:gap-10 lg:py-16">
        <aside className="lg:col-span-1">
          <DocsToc />
        </aside>

        <div className="space-y-5 lg:col-span-3">
          <DocsSection
            id="workflow"
            index="01"
            icon={sectionIcons.workflow}
            title="End-to-end production workflow"
            description="The four moves from raw story to renderable assets. Each one leaves you with an artifact you can inspect before the next step."
          >
            <WorkflowGuide />
          </DocsSection>

          <DocsSection
            id="styles"
            index="02"
            icon={sectionIcons.styles}
            title="Visual style directory"
            description="Six directions tuned for Flow's image and video models. Choose one, or let Auto read the story's tone and decide."
          >
            <StyleDirectory />
          </DocsSection>

          <DocsSection
            id="timing"
            index="03"
            icon={sectionIcons.timing}
            title="Scene timing and audio calibration"
            description="Voiceover is measured in words, video in seconds. The plan reconciles both before anything is generated."
          >
            <TimingSection />
          </DocsSection>

          <DocsSection
            id="handoff"
            index="04"
            icon={sectionIcons.handoff}
            title="Voiceover and Flow hand-off"
            description="What to paste, where, and in what order — plus the punctuation habits that keep Bengali narration natural."
          >
            <HandoffSection />
          </DocsSection>

          <DocsSection
            id="specs"
            index="05"
            icon={sectionIcons.specs}
            title="Quick specs and persistence"
            description="The defaults every new plan starts from, and where your work lives while you iterate."
          >
            <SpecsSection />
          </DocsSection>
        </div>
      </div>

      <DocsCta />
    </>
  );
}
