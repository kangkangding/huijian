import type { Env } from "./types";

export class DbError extends Error {
  constructor(public status: number, public code: string) {
    super("数据库请求失败");
    this.name = "DbError";
  }
}

export function isMissingSchema(error: unknown): boolean {
  return error instanceof DbError && ["42703", "42P01", "PGRST204", "PGRST205"].includes(error.code);
}

export function createDb(env: Env) {
  const root = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;

  async function send<T>(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
    const headers = new Headers();
    headers.set("apikey", env.SUPABASE_SERVICE_ROLE_KEY);
    headers.set("Authorization", `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
    headers.set("Prefer", init.prefer ?? "return=representation");
    const response = await fetch(`${root}/${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await response.text();
    if (!response.ok) {
      let code = "";
      try {
        code = (JSON.parse(text) as { code?: string }).code ?? "";
      } catch {
        code = "";
      }
      console.log(JSON.stringify({
        event: "db.error",
        status: response.status,
        path: path.split("?")[0],
        code,
        detail: text.slice(0, 180),
      }));
      throw new DbError(response.status, code);
    }
    if (!text) return [] as T;
    return JSON.parse(text) as T;
  }

  return {
    get: <T>(path: string) => send<T[]>(path),
    post: <T>(path: string, body: unknown) => send<T[]>(path, { method: "POST", body }),
    patch: <T>(path: string, body: unknown) => send<T[]>(path, { method: "PATCH", body }),
    del: (path: string) => send<unknown>(path, { method: "DELETE", prefer: "return=minimal" }),
  };
}

export type Db = ReturnType<typeof createDb>;
