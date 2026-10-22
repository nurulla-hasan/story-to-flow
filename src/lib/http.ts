import { ZodError, type z } from "zod";
import { LlmError } from "./llm";

export class AppError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "app_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof LlmError) {
    const status =
      error.code === "unauthorized"
        ? 401
        : error.code === "network"
          ? 503
          : error.code === "rate_limit"
            ? 429
            : error.code === "not_found"
              ? 404
              : error.status && error.status >= 400
                ? Math.min(error.status, 599)
                : 502;
    return Response.json(
      { error: error.message, code: error.code, detail: error.detail ?? null },
      { status },
    );
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        error:
          "Invalid request: " +
          error.issues
            .slice(0, 8)
            .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
            .join("; "),
        code: "validation_error",
        issues: error.issues,
      },
      { status: 400 },
    );
  }
  if (error instanceof Error) {
    const status =
      "status" in error && typeof (error as { status?: unknown }).status === "number"
        ? Number((error as { status: number }).status)
        : 500;
    return Response.json(
      { error: error.message, code: "error" },
      { status: status >= 400 && status <= 599 ? status : 500 },
    );
  }
  return Response.json({ error: String(error), code: "error" }, { status: 500 });
}

export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new AppError("Request body must be JSON.", 400, "invalid_json");
  }
  return schema.parse(raw);
}

export async function readFileField(
  request: Request,
  field = "file",
): Promise<File> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new AppError("Expected multipart/form-data upload.", 400, "invalid_form");
  }
  const file = form.get(field);
  if (!(file instanceof File)) {
    throw new AppError(`Upload field "${field}" is missing.`, 400, "missing_file");
  }
  if (!file.size) throw new AppError("Uploaded file is empty.", 400, "empty_file");
  return file;
}

export function projectIdFrom(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get("projectId") || "default";
}
