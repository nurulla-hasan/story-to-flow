import type { SceneStatus } from "@/lib/types";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = "error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });
  const text = await res.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!res.ok) {
    const body = payload as { error?: string; code?: string } | null;
    throw new ApiError(
      body?.error || `Request failed (${res.status})`,
      res.status,
      body?.code,
    );
  }
  return payload as T;
}

export async function upload<T>(url: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file, file.name || "upload");
  return api<T>(url, { method: "POST", body: form });
}

export function fileUrl(path: string | null): string | null {
  if (!path) return null;
  return `/api/files/${path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export const STATUS_META: Record<
  SceneStatus,
  { label: string; variant: "neutral" | "brand" | "success" | "warning"; dot: string }
> = {
  draft: { label: "Waiting", variant: "neutral", dot: "#8a99a8" },
  ready: { label: "Ready for Flow", variant: "brand", dot: "#0f766e" },
  done: { label: "Done", variant: "success", dot: "#15803d" },
  needs_attention: {
    label: "Needs attention",
    variant: "warning",
    dot: "#b45309",
  },
};

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
