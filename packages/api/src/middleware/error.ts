import type { Context } from "hono";
import { ZodError } from "zod";

export function errorResponse(c: Context, error: unknown): Response {
  if (error instanceof ZodError) {
    return c.json(
      {
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: error.flatten().fieldErrors,
      },
      400
    );
  }

  if (error instanceof Error) {
    console.error(error);
    return c.json({ error: error.message, code: "INTERNAL_ERROR" }, 500);
  }

  return c.json({ error: "Unknown error", code: "INTERNAL_ERROR" }, 500);
}
