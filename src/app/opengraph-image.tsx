import { ImageResponse } from "next/og";

import { siteName, siteTagline } from "@/lib/site";

/**
 * Share card is rendered by satori on the server, so CSS theme tokens from
 * globals.css are not available here. These values mirror the dark palette.
 */
const brand = {
  background: "#09090b",
  card: "#151519",
  foreground: "#fafafa",
  muted: "#a1a1aa",
  border: "rgba(255, 255, 255, 0.14)",
  primary: "#594ee5",
  info: "#0284c7",
};

export const alt = `${siteName} — from one story to a consistent video series`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const highlights = [
  "Faces, voices & places locked",
  "4.0s Flow hero clips",
  "Bengali voiceover ready",
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: brand.background,
          backgroundImage:
            "linear-gradient(135deg, #221c4d 0%, #09090b 52%, #062a3a 100%)",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              position: "relative",
              width: 60,
              height: 60,
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundImage: `linear-gradient(135deg, ${brand.primary}, ${brand.info})`,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                backgroundColor: "#ffffff",
                transform: "rotate(45deg)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 11,
                right: 12,
                width: 7,
                height: 7,
                borderRadius: 999,
                backgroundColor: "rgba(255, 255, 255, 0.9)",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: brand.foreground, fontSize: 26 }}>
              {siteName}
            </span>
            <span style={{ color: brand.muted, fontSize: 18 }}>
              {siteTagline}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              alignSelf: "flex-start",
              border: `1px solid ${brand.border}`,
              borderRadius: 999,
              padding: "8px 18px",
              color: "#c7c5ff",
              fontSize: 18,
            }}
          >
            Deterministic prompt compiler
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              maxWidth: 1000,
              color: brand.foreground,
              fontSize: 66,
              lineHeight: 1.14,
            }}
          >
            From one story to a consistent video series.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {highlights.map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  border: `1px solid ${brand.border}`,
                  backgroundColor: brand.card,
                  borderRadius: 999,
                  padding: "10px 20px",
                  color: "#e4e4e7",
                  fontSize: 20,
                }}
              >
                {item}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", color: brand.muted, fontSize: 18 }}>
            story.txt / plan.json / prompts.txt
          </div>
        </div>
      </div>
    ),
    size
  );
}
