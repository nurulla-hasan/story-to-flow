"use client";

import { useEffect } from "react";

/**
 * Replaces the root layout when a fatal error occurs, so globals.css and the
 * theme tokens are not guaranteed to be loaded. Colors are inlined on purpose.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
          color: "#fafafa",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#a1a1aa",
            }}
          >
            Story to Flow
          </p>
          <h1
            style={{
              margin: "16px 0 0",
              fontSize: 28,
              lineHeight: 1.2,
              fontWeight: 600,
            }}
          >
            The app could not start.
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 15,
              lineHeight: 1.6,
              color: "#a1a1aa",
            }}
          >
            Reload to try again. Your saved drafts live in this browser and were
            not touched.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 12,
              backgroundColor: "#594ee5",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 500,
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
