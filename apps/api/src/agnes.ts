const IMAGE_URL = "https://api.agnes-ai.cn/v1/images/generations";
const CHAT_URL = "https://api.agnes-ai.cn/v1/chat/completions";
const VIDEO_URL = "https://api.agnes-ai.cn/v1/videos";
const VIDEO_POLL_URL = "https://api.agnes-ai.cn/agnesapi";

export const IMAGE_MODEL = "agnes-image-2.5-flash";
export const CHAT_MODEL = "agnes-2.5-flash";
export const VIDEO_MODEL = "agnes-video-2.5-flash";

export class UpstreamError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function agnes(apiKey: string, url: string, init: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text.slice(0, 120) };
    }
  }
  if (!response.ok) {
    console.log(JSON.stringify({ event: "agnes.error", status: response.status }));
    throw new UpstreamError(response.status, upstreamMessage(response.status));
  }
  return body;
}

function upstreamMessage(status: number): string {
  if (status === 401 || status === 403) return "上游密钥无效，请管理员在账户页更新";
  if (status === 402) return "上游额度不足";
  if (status === 429) return "上游繁忙，请稍后再试";
  return "生成失败，请改一下描述再试";
}

export async function createImage(apiKey: string, input: { prompt: string; ratio: string; size: string }): Promise<string> {
  const body = await agnes(apiKey, IMAGE_URL, {
    method: "POST",
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: input.prompt,
      size: input.size,
      ratio: input.ratio,
      extra_body: { response_format: "url" },
    }),
  });
  const url = readPath(body, ["data", "0", "url"]);
  if (typeof url !== "string" || !url) throw new UpstreamError(502, "没有拿到图片地址");
  return url;
}

export async function createChat(
  apiKey: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
): Promise<string> {
  const body = await agnes(apiKey, CHAT_URL, {
    method: "POST",
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
  });
  const content = readPath(body, ["choices", "0", "message", "content"]);
  if (typeof content !== "string" || !content.trim()) throw new UpstreamError(502, "没有拿到回答");
  return content.trim();
}

export async function createVideo(apiKey: string, input: {
  prompt: string;
  mode: "text" | "keyframe";
  aspectRatio: string;
  seconds: string;
  firstFrame?: string;
}): Promise<string> {
  const payload: Record<string, unknown> = {
    model: VIDEO_MODEL,
    prompt: input.prompt,
    mode: input.mode,
    seconds: input.seconds,
    size: "720P",
    aspect_ratio: input.aspectRatio,
    n: 1,
  };
  if (input.mode === "keyframe" && input.firstFrame) payload.first_frame = input.firstFrame;
  const body = await agnes(apiKey, VIDEO_URL, { method: "POST", body: JSON.stringify(payload) });
  const videoId = readPath(body, ["video_id"]);
  if (typeof videoId !== "string" || !videoId) throw new UpstreamError(502, "没有拿到视频任务");
  return videoId;
}

export async function pollVideo(apiKey: string, videoId: string): Promise<{ status: string; url: string | null; error: string | null }> {
  const url = `${VIDEO_POLL_URL}?video_id=${encodeURIComponent(videoId)}&model_name=${encodeURIComponent(VIDEO_MODEL)}`;
  const body = await agnes(apiKey, url);
  const status = readPath(body, ["status"]);
  const result = readPath(body, ["url"]);
  const error = readPath(body, ["error"]);
  return {
    status: typeof status === "string" ? status : "processing",
    url: typeof result === "string" ? result : null,
    error: typeof error === "string" ? error : null,
  };
}

function readPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (Array.isArray(current)) current = current[Number(key)];
    else if (current && typeof current === "object" && key in current) current = (current as Record<string, unknown>)[key];
    else return undefined;
  }
  return current;
}
