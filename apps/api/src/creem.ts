const PRODUCTION_BASE = "https://api.creem.io";
const SANDBOX_BASE = "https://test-api.creem.io";
const TIMEOUT_MS = 5_000;

export type CreemEnv = {
  APP_ENV?: string;
  CREEM_API_KEY?: string;
  CREEM_API_BASE?: string;
};

export class ModerationRejected extends Error {
  decision: "deny" | "flag";
  constructor(decision: "deny" | "flag") {
    super(decision);
    this.decision = decision;
  }
}

export class ModerationUnavailable extends Error {
  reason: "missing_key" | "test_key" | "invalid_key" | "base" | "network" | "http" | "body" | "decision";
  constructor(reason: ModerationUnavailable["reason"]) {
    super(reason);
    this.reason = reason;
  }
}

export function moderationFailure(error: unknown): {
  status: 400 | 503;
  message: string;
  code: "moderation";
  reason?: ModerationUnavailable["reason"];
  decision?: "deny" | "flag";
} | null {
  if (error instanceof ModerationRejected) {
    return {
      status: 400,
      message: "这个提示词没有通过内容审核，请改一下再试",
      code: "moderation",
      decision: error.decision,
    };
  }
  if (error instanceof ModerationUnavailable) {
    return {
      status: 503,
      message: "内容审核暂时不可用，请稍后再试",
      code: "moderation",
      reason: error.reason,
    };
  }
  return null;
}

export async function screenPrompt(
  env: CreemEnv,
  prompt: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = TIMEOUT_MS,
): Promise<void> {
  const target = resolveTarget(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(target.url, {
      method: "POST",
      headers: {
        "x-api-key": target.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ prompt }),
      redirect: "manual",
      signal: controller.signal,
    });
  } catch {
    throw new ModerationUnavailable("network");
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new ModerationUnavailable("http");
  const decision = await readDecision(response);
  if (decision === "allow") return;
  if (decision === "deny" || decision === "flag") throw new ModerationRejected(decision);
  throw new ModerationUnavailable("decision");
}

function resolveTarget(env: CreemEnv): { apiKey: string; url: string } {
  const apiKey = (env.CREEM_API_KEY ?? "").trim();
  if (!apiKey) throw new ModerationUnavailable("missing_key");
  const live = apiKey.startsWith("creem_") && !apiKey.startsWith("creem_test_");
  const sandboxKey = apiKey.startsWith("creem_test_");
  const base = normalizeBase(env.CREEM_API_BASE);
  if (base === null) throw new ModerationUnavailable("base");
  if (env.APP_ENV !== "development") {
    if (sandboxKey) throw new ModerationUnavailable("test_key");
    if (!live) throw new ModerationUnavailable("invalid_key");
    if (base && base !== PRODUCTION_BASE) throw new ModerationUnavailable("base");
    return { apiKey, url: `${PRODUCTION_BASE}/v1/moderation/prompt` };
  }
  if (!live && !sandboxKey) throw new ModerationUnavailable("invalid_key");
  const selected = base || PRODUCTION_BASE;
  if (selected === SANDBOX_BASE && !sandboxKey) throw new ModerationUnavailable("base");
  if (selected === PRODUCTION_BASE && sandboxKey) throw new ModerationUnavailable("base");
  return { apiKey, url: `${selected}/v1/moderation/prompt` };
}

function normalizeBase(value: string | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  const normalized = `${url.origin}${path}`;
  if (normalized === PRODUCTION_BASE || normalized === SANDBOX_BASE) return normalized;
  return null;
}

async function readDecision(response: Response): Promise<unknown> {
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 100_000) throw new ModerationUnavailable("body");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ModerationUnavailable("body");
  }
  if (!body || typeof body !== "object" || !("decision" in body)) return undefined;
  return body.decision;
}
