function resolveSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }

  return "http://localhost:3000";
}

/**
 * Canonical origin used for metadata, sitemap, and robots.
 * Set `NEXT_PUBLIC_SITE_URL` (e.g. https://storytoflow.com) in production so
 * share cards and canonical URLs point at the real domain instead of localhost.
 */
export const siteUrl = resolveSiteUrl();

export const siteName = "Story to Flow";

export const siteTagline = "Prompt engine for video";

export const siteTitle = `${siteName} — from one story to a consistent video series`;

export const siteDescription =
  "Lock your story's faces, voices, and locations, then compile every Google Flow prompt in code — so scene 40 still looks like scene 1.";
