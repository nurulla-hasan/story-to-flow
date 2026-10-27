import type { Metadata } from "next";

import { docsLinks } from "@/components/docs/docs-data";
import { SiteFooter } from "@/components/shared/site-footer";
import { SiteHeader } from "@/components/shared/site-header";
import { siteUrl } from "@/lib/site";

const docsTitle = "Documentation · Story to Flow";
const docsDescription =
  "Workflow guides, visual direction, Cartesia voiceover tips, and Google Flow hand-off rules for Story to Flow.";

/** The image comes from `app/opengraph-image.tsx`; child segments must opt in. */
const docsImage = {
  url: `${siteUrl}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: docsTitle,
};

export const metadata: Metadata = {
  title: "Documentation",
  description: docsDescription,
  alternates: { canonical: "/docs" },
  openGraph: {
    type: "article",
    url: "/docs",
    title: docsTitle,
    description: docsDescription,
    images: [docsImage],
  },
  twitter: {
    card: "summary_large_image",
    title: docsTitle,
    description: docsDescription,
    images: [docsImage.url],
  },
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
