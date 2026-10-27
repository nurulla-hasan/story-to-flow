import type { Metadata } from "next";

import { docsLinks } from "@/components/docs/docs-data";
import { SiteFooter } from "@/components/shared/site-footer";
import { SiteHeader } from "@/components/shared/site-header";

export const metadata: Metadata = {
  title: "Documentation · Story to Flow",
  description:
    "Workflow guides, visual direction, Cartesia voiceover tips, and Google Flow hand-off rules for Story to Flow.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader links={docsLinks} subtitle="Documentation" />

      <main className="flex-1">{children}</main>

      <SiteFooter />
    </div>
  );
}
