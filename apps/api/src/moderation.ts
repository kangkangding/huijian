import { HttpError } from "./http.ts";

const TIMEOUT_MS = 5000;

export function moderationUrl(apiKey: string): string {
  if (apiKey.startsWith("creem_test_")) return "https://test-api.creem.io/v1/moderation/prompt";
  if (apiKey.startsWith("creem_")) return "https://api.creem.io/v1/moderation/prompt";
  throw new HttpError(503, "内容审核暂时不可用，请稍后再试", "moderation");
}

export async function screenPrompt(
  apiKey: string | undefined,
  prompt: string,
  externalId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const key = apiKey?.trim() ?? "";
  if (!key.startsWith("creem_") || key.startsWith("creem_test_")) {
    throw new HttpError(503, "内容审核暂时不可用，请稍后再试", "moderation");
  }
  let response: Response;
  try {
    response = await fetchImpl(moderationUrl(key), {
      method: "POST",
      headers: { "x-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ prompt, external_id: externalId }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(503, "内容审核暂时不可用，请稍后再试", "moderation");
  }
  if (!response.ok) throw new HttpError(503, "内容审核暂时不可用，请稍后再试", "moderation");
  const body = await response.json().catch(() => null) as { decision?: unknown } | null;
  if (body?.decision === "allow") return;
  if (body?.decision === "deny" || body?.decision === "flag") {
    throw new HttpError(400, "这个描述不能生成，请改一下再试", "prompt");
  }
  throw new HttpError(503, "内容审核暂时不可用，请稍后再试", "moderation");
}
