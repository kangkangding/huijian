import type { Env } from "./types";

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
      console.log(JSON.stringify({
        event: "db.error",
        status: response.status,
        path: path.split("?")[0],
        detail: text.slice(0, 180),
      }));
      throw new Error("数据库请求失败");
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
