import type { Profile } from "./types";

export type Vars = { user: Profile };

export class HttpError extends Error {
  status: 400 | 401 | 402 | 403 | 404 | 409 | 413 | 429 | 502 | 503;
  code: string;
  details: Record<string, unknown>;

  constructor(
    status: 400 | 401 | 402 | 403 | 404 | 409 | 413 | 429 | 502 | 503,
    message: string,
    code: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function readJson<T>(c: { req: { json: () => Promise<T> } }): Promise<T> {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, "请求格式不正确", "json");
  }
}
