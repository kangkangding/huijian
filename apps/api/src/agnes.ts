const ROOTS = {
  cn: "https://api.agnes-ai.cn",
  intl: "https://apihub.agnes-ai.com",
} as const;

export type AgnesSite = keyof typeof ROOTS;

export type AgnesAccount = {
  site: AgnesSite;
  apiKey: string;
};

export const IMAGE_MODEL = "agnes-image-2.5-flash";
export const CHAT_MODEL = "agnes-2.5-flash";
export const VIDEO_MODEL = "agnes-video-2.5-flash";

export class UpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function agnesRoot(site: AgnesSite): string {
  return ROOTS[site];
}

export function shouldRotate(status: number): boolean {
  return status === 0 || status === 401 || status === 402 || status === 403 || status === 429 || status >= 500;
}

export async function callAccounts<T>(accounts: AgnesAccount[], run: (account: AgnesAccount) => Promise<T>): Promise<{ account: AgnesAccount; value: T }> {
  if (accounts.length === 0) throw new UpstreamError(502, "还没有配置 Agnes 密钥");
  let previous: UpstreamError | null = null;
  for (let index = 0; index < accounts.length; index++) {
    const account = accounts[index];
    try {
      const value = await run(account);
      console.log(JSON.stringify({ event: "agnes.ok", site: account.site }));
      return { account, value };
    } catch (error) {
      const status = error instanceof UpstreamError ? error.status : 0;
      const current = error instanceof UpstreamError ? error : new UpstreamError(status, "上游暂时连不上");
      const rotate = shouldRotate(status) && index + 1 < accounts.length;
      console.log(JSON.stringify({ event: "agnes.error", site: account.site, status, rotate }));
      if (!rotate) {
        if (previous && shouldRotate(previous.status) && !shouldRotate(status)) throw previous;
        throw current;
      }
      previous = current;
    }
  }
  throw previous ?? new UpstreamError(502, "生成失败，请改一下描述再试");
}

async function agnes(account: AgnesAccount, path: string, init: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${account.apiKey}`);
  if (init.body) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${ROOTS[account.site]}${path}`, { ...init, headers });
  } catch {
    throw new UpstreamError(0, "上游暂时连不上");
  }
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text.slice(0, 120) };
    }
  }
  if (!response.ok) throw new UpstreamError(response.status, upstreamMessage(response.status));
  return body;
}

function upstreamMessage(status: number): string {
  if (status === 401 || status === 403) return "上游密钥无效，请管理员在账户页更新";
  if (status === 402) return "上游额度不足";
  if (status === 429) return "上游繁忙，请稍后再试";
  return "生成失败，请改一下描述再试";
}

export async function createImage(accounts: AgnesAccount[], input: { prompt: string; ratio: string; size: string }): Promise<string> {
  const { value } = await callAccounts(accounts, (account) => createImageOn(account, input));
  return value;
}

async function createImageOn(account: AgnesAccount, input: { prompt: string; ratio: string; size: string }): Promise<string> {
  const body = await agnes(account, "/v1/images/generations", {
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
  accounts: AgnesAccount[],
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
): Promise<string> {
  const { value } = await callAccounts(accounts, (account) => createChatOn(account, messages, maxTokens));
  return value;
}

async function createChatOn(
  account: AgnesAccount,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
): Promise<string> {
  const body = await agnes(account, "/v1/chat/completions", {
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

export async function createVideo(accounts: AgnesAccount[], input: {
  prompt: string;
  mode: "text" | "keyframe";
  aspectRatio: string;
  seconds: string;
  firstFrame?: string;
}): Promise<{ videoId: string; site: AgnesSite }> {
  const { account, value } = await callAccounts(accounts, (item) => createVideoOn(item, input));
  return { videoId: value, site: account.site };
}

async function createVideoOn(account: AgnesAccount, input: {
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
  const body = await agnes(account, "/v1/videos", { method: "POST", body: JSON.stringify(payload) });
  const videoId = readPath(body, ["video_id"]);
  if (typeof videoId !== "string" || !videoId) throw new UpstreamError(502, "没有拿到视频任务");
  return videoId;
}

export async function pollVideo(account: AgnesAccount, videoId: string): Promise<{ status: string; url: string | null; error: string | null }> {
  const path = `/agnesapi?video_id=${encodeURIComponent(videoId)}&model_name=${encodeURIComponent(VIDEO_MODEL)}`;
  const body = await agnes(account, path);
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
