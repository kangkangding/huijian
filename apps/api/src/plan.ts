import type { Plan, Profile, UsageKind } from "./types";

export function shanghaiDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isMember(profile: Pick<Profile, "plan_code" | "plan_expires_at">, now = Date.now()): boolean {
  if (profile.plan_code === "free" || !profile.plan_expires_at) return false;
  return new Date(profile.plan_expires_at).getTime() > now;
}

export function effectivePlan(profile: Pick<Profile, "plan_code" | "plan_expires_at">, plans: Plan[], now = Date.now()): Plan {
  const free = plans.find((plan) => plan.code === "free");
  if (!free) throw new Error("缺少免费方案");
  if (!isMember(profile, now)) return free;
  return plans.find((plan) => plan.code === profile.plan_code) ?? free;
}

export function quotaLimit(plan: Plan, kind: UsageKind): number {
  if (kind === "image") return plan.image_daily;
  if (kind === "chat") return plan.chat_daily;
  return plan.video_daily;
}

export function extendExpiry(current: string | null, days: number, now = Date.now()): string {
  const start = current && new Date(current).getTime() > now ? new Date(current).getTime() : now;
  return new Date(start + days * 24 * 60 * 60 * 1000).toISOString();
}

const IMAGE_RATIOS = new Set(["1:1", "3:4", "4:3", "16:9", "9:16"]);
const IMAGE_SIZES = new Set(["1K", "2K"]);
const VIDEO_RATIOS = new Set(["16:9", "9:16", "1:1", "3:4", "4:3"]);
const VIDEO_SECONDS = new Set(["4", "5", "6", "8"]);

export function assertImageInput(input: { prompt?: string; ratio?: string; size?: string }, maxSize: string): {
  prompt: string;
  ratio: string;
  size: string;
} {
  const prompt = (input.prompt ?? "").trim();
  const ratio = input.ratio ?? "1:1";
  const size = input.size ?? "1K";
  if (prompt.length < 1 || prompt.length > 1000) throw new Error("提示词需要 1 到 1000 个字");
  if (!IMAGE_RATIOS.has(ratio)) throw new Error("不支持这个画幅");
  if (!IMAGE_SIZES.has(size)) throw new Error("不支持这个清晰度");
  if (size === "2K" && maxSize !== "2K") throw new Error("2K 仅会员可用");
  return { prompt, ratio, size };
}

export function assertVideoInput(input: {
  prompt?: string;
  aspectRatio?: string;
  seconds?: string;
  firstFrame?: string;
}): { prompt: string; aspectRatio: string; seconds: string; mode: "text" | "keyframe"; firstFrame?: string } {
  const prompt = (input.prompt ?? "").trim();
  const aspectRatio = input.aspectRatio ?? "1:1";
  const seconds = input.seconds ?? "5";
  const firstFrame = (input.firstFrame ?? "").trim();
  if (prompt.length < 1 || prompt.length > 800) throw new Error("视频描述需要 1 到 800 个字");
  if (!VIDEO_RATIOS.has(aspectRatio)) throw new Error("不支持这个画幅");
  if (!VIDEO_SECONDS.has(seconds)) throw new Error("时长只能是 4、5、6 或 8 秒");
  if (!firstFrame) return { prompt, aspectRatio, seconds, mode: "text" };
  let url: URL;
  try {
    url = new URL(firstFrame);
  } catch {
    throw new Error("首帧需要公网图片地址");
  }
  if (url.protocol !== "https:" || /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(url.hostname)) {
    throw new Error("首帧只接受公网 HTTPS 图片");
  }
  return { prompt, aspectRatio, seconds, mode: "keyframe", firstFrame };
}

export function assertChatMessage(message: string): string {
  const text = message.trim();
  if (text.length < 1 || text.length > 500) throw new Error("问题需要 1 到 500 个字");
  return text;
}

export function assertAccount(input: { email?: string; password?: string; displayName?: string }): {
  email: string;
  password: string;
  displayName: string;
} {
  const email = (input.email ?? "").trim().toLowerCase();
  const password = input.password ?? "";
  const displayName = (input.displayName ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("邮箱格式不正确");
  if (password.length < 8 || password.length > 72) throw new Error("密码需要 8 到 72 位");
  if (displayName.length < 1 || displayName.length > 32) throw new Error("昵称需要 1 到 32 个字");
  return { email, password, displayName };
}
