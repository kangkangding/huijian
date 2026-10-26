import { Hono } from "hono";
import { cors } from "hono/cors";
import { createChat, createImage, createVideo, IMAGE_MODEL, pollVideo, UpstreamError, VIDEO_MODEL } from "./agnes";
import { createDb } from "./db";
import { HttpError, readJson, type Vars } from "./http";
import { sendPasswordReset } from "./mail";
import { hashPassword, randomToken, secretsMatch, sha256Hex, verifyPassword } from "./password";
import {
  assertAccount,
  assertChatMessage,
  assertImageInput,
  assertVideoInput,
  effectivePlan,
  extendExpiry,
  isMember,
  quotaLimit,
  shanghaiDay,
} from "./plan";
import type { Env, Plan, Profile, PublicUser, UsageKind } from "./types";

const CHAT_SYSTEM = "你是绘简的页面助手。用简短中文回答提示词写法、画幅、免费额度和会员问题。不要透露密钥、数据库或上游地址。";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use("/api/*", async (c, next) => {
  const length = Number(c.req.header("content-length") ?? 0);
  if (length > 100_000) throw new HttpError(413, "请求过大", "body");
  const middleware = cors({
    origin: c.env.APP_ORIGIN,
    allowHeaders: ["Authorization", "Content-Type", "X-Payment-Secret"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  });
  return middleware(c, next);
});

app.onError((error, c) => {
  if (error instanceof HttpError) return c.json({ error: error.message, code: error.code }, error.status);
  if (error instanceof UpstreamError) {
    const status = error.status === 401 || error.status === 403 ? 502 : error.status === 402 ? 402 : error.status === 429 ? 429 : 502;
    return c.json({ error: error.message, code: "upstream" }, status);
  }
  console.log(JSON.stringify({ event: "error", message: error instanceof Error ? error.message : "unknown" }));
  return c.json({ error: "服务暂时不可用", code: "server" }, 500);
});

app.get("/api/health", (c) => c.json({ ok: true, name: "huijian" }));

app.post("/api/auth/register", async (c) => {
  const body = await readJson<{ email?: string; password?: string; displayName?: string }>(c);
  const account = parseAccount(body);
  const db = createDb(c.env);
  const existing = await db.get<Profile>(`profiles?email=eq.${encodeURIComponent(account.email)}&select=id`);
  if (existing.length > 0) throw new HttpError(409, "这个邮箱已经注册", "email");
  const users = await db.get<{ id: string }>("profiles?select=id&limit=1");
  const rows = await db.post<Profile>("profiles", {
    email: account.email,
    password_hash: await hashPassword(account.password),
    display_name: account.displayName,
    role: users.length === 0 ? "admin" : "user",
    plan_code: "free",
  });
  const token = await issueSession(c.env, rows[0].id);
  return c.json({ token, ...(await presentUser(c.env, rows[0])) });
});

app.post("/api/auth/login", async (c) => {
  const body = await readJson<{ email?: string; password?: string }>(c);
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const db = createDb(c.env);
  const rows = await db.get<Profile>(`profiles?email=eq.${encodeURIComponent(email)}&select=*`);
  const profile = rows[0];
  if (!profile || !(await verifyPassword(password, profile.password_hash))) {
    throw new HttpError(401, "邮箱或密码不正确", "auth");
  }
  const token = await issueSession(c.env, profile.id);
  return c.json({ token, ...(await presentUser(c.env, profile)) });
});

app.post("/api/auth/logout", async (c) => {
  const token = bearer(c.req.header("Authorization"));
  if (token) {
    const db = createDb(c.env);
    await db.del(`sessions?token_hash=eq.${await sha256Hex(token)}`);
  }
  return c.json({ ok: true });
});

app.post("/api/auth/forgot-password", async (c) => {
  const body = await readJson<{ email?: string }>(c);
  const email = (body.email ?? "").trim().toLowerCase();
  const db = createDb(c.env);
  const rows = await db.get<Profile>(`profiles?email=eq.${encodeURIComponent(email)}&select=id`);
  let resetUrl: string | undefined;
  if (rows[0]) {
    const token = randomToken();
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await db.post("password_resets", {
      user_id: rows[0].id,
      token_hash: await sha256Hex(token),
      expires_at: expires,
    });
    const origin = c.env.APP_ORIGIN.replace(/\/$/, "");
    resetUrl = `${origin}/reset?token=${token}`;
    console.log(JSON.stringify({ event: "password.reset", userId: rows[0].id }));
    if (c.env.APP_ENV !== "development") await sendPasswordReset(c.env, email, resetUrl);
  }
  return c.json({
    ok: true,
    message: "如果这个邮箱已注册，重置邮件已经发出，30 分钟内有效。请查看收件箱和垃圾邮件。",
    resetUrl: c.env.APP_ENV === "development" ? resetUrl : undefined,
  });
});

app.post("/api/auth/reset-password", async (c) => {
  const body = await readJson<{ token?: string; password?: string }>(c);
  const token = (body.token ?? "").trim();
  const password = body.password ?? "";
  if (!token) throw new HttpError(400, "缺少重置凭证", "token");
  if (password.length < 8 || password.length > 72) throw new HttpError(400, "密码需要 8 到 72 位", "password");
  const db = createDb(c.env);
  const rows = await db.get<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
    `password_resets?token_hash=eq.${await sha256Hex(token)}&select=id,user_id,expires_at,used_at`,
  );
  const reset = rows[0];
  if (!reset || reset.used_at || new Date(reset.expires_at).getTime() < Date.now()) {
    throw new HttpError(400, "重置链接已失效", "token");
  }
  await db.patch(`profiles?id=eq.${reset.user_id}`, { password_hash: await hashPassword(password) });
  await db.patch(`password_resets?id=eq.${reset.id}`, { used_at: new Date().toISOString() });
  await db.del(`sessions?user_id=eq.${reset.user_id}`);
  return c.json({ ok: true });
});

app.get("/api/auth/me", async (c) => {
  const profile = await requireUser(c);
  return c.json(await presentUser(c.env, profile));
});

app.get("/api/plans", async (c) => {
  const plans = await loadPlans(c.env);
  return c.json({ plans: plans.filter((plan) => plan.active).map(publicPlan) });
});

app.post("/api/membership/orders", async (c) => {
  const profile = await requireUser(c);
  const body = await readJson<{ planCode?: string }>(c);
  const plans = await loadPlans(c.env);
  const plan = plans.find((item) => item.code === body.planCode && item.active && item.price_cents > 0);
  if (!plan) throw new HttpError(400, "没有这个会员方案", "plan");
  const db = createDb(c.env);
  const rows = await db.post<{ id: string; amount_cents: number; status: string; plan_code: string }>("orders", {
    user_id: profile.id,
    plan_code: plan.code,
    amount_cents: plan.price_cents,
    status: "pending",
  });
  return c.json({ order: rows[0], plan: publicPlan(plan) });
});

app.get("/api/membership/orders", async (c) => {
  const profile = await requireUser(c);
  const db = createDb(c.env);
  const orders = await db.get<{ id: string; plan_code: string; amount_cents: number; status: string; created_at: string; paid_at: string | null }>(
    `orders?user_id=eq.${profile.id}&select=id,plan_code,amount_cents,status,created_at,paid_at&order=created_at.desc&limit=20`,
  );
  return c.json({ orders });
});

app.post("/api/membership/orders/:id/confirm", async (c) => {
  const secret = c.req.header("X-Payment-Secret") ?? "";
  const webhookOk = await secretsMatch(secret, c.env.PAYMENT_WEBHOOK_SECRET ?? "");
  const db = createDb(c.env);
  const orderId = c.req.param("id");
  const rows = await db.get<{ id: string; user_id: string; plan_code: string; status: string }>(
    `orders?id=eq.${orderId}&select=id,user_id,plan_code,status`,
  );
  const order = rows[0];
  if (!order) throw new HttpError(404, "找不到订单", "order");
  if (!webhookOk) {
    if (c.env.APP_ENV !== "development") throw new HttpError(403, "支付确认未通过", "payment");
    const profile = await requireUser(c);
    if (order.user_id !== profile.id) throw new HttpError(404, "找不到订单", "order");
  }
  if (order.status !== "pending") throw new HttpError(409, "订单已处理", "order");
  const plans = await loadPlans(c.env);
  const plan = plans.find((item) => item.code === order.plan_code);
  if (!plan) throw new HttpError(400, "方案已下架", "plan");
  const updated = await db.patch<{ id: string }>(
    `orders?id=eq.${order.id}&status=eq.pending`,
    { status: "paid", paid_at: new Date().toISOString() },
  );
  if (updated.length === 0) throw new HttpError(409, "订单已处理", "order");
  const fresh = await db.get<Profile>(`profiles?id=eq.${order.user_id}&select=*`);
  const expiry = extendExpiry(fresh[0]?.plan_expires_at ?? null, plan.duration_days);
  await db.patch(`profiles?id=eq.${order.user_id}`, { plan_code: plan.code, plan_expires_at: expiry });
  const next = await db.get<Profile>(`profiles?id=eq.${order.user_id}&select=*`);
  return c.json(await presentUser(c.env, next[0]));
});

app.post("/api/images", async (c) => {
  const profile = await requireUser(c);
  const body = await readJson<{ prompt?: string; ratio?: string; size?: string }>(c);
  const plan = effectivePlan(profile, await loadPlans(c.env));
  const input = parseImage(body, plan.max_image_size);
  await reserveQuota(c.env, profile.id, "image", quotaLimit(plan, "image"));
  const db = createDb(c.env);
  try {
    const url = await createImage(await providerKey(c.env), input);
    const rows = await db.post("images", {
      user_id: profile.id,
      prompt: input.prompt,
      ratio: input.ratio,
      size: input.size,
      model: IMAGE_MODEL,
      url,
      status: "completed",
    });
    console.log(JSON.stringify({ event: "image.created", userId: profile.id }));
    return c.json({ image: rows[0] });
  } catch (error) {
    await releaseQuota(c.env, profile.id, "image");
    await db.post("images", {
      user_id: profile.id,
      prompt: input.prompt,
      ratio: input.ratio,
      size: input.size,
      model: IMAGE_MODEL,
      status: "failed",
      error: error instanceof Error ? error.message : "生成失败",
    });
    throw error;
  }
});

app.get("/api/images", async (c) => {
  const profile = await requireUser(c);
  const db = createDb(c.env);
  const images = await db.get(
    `images?user_id=eq.${profile.id}&select=id,prompt,ratio,size,url,status,error,created_at&order=created_at.desc&limit=60`,
  );
  return c.json({ images });
});

app.post("/api/chat", async (c) => {
  const profile = await requireUser(c);
  const body = await readJson<{ conversationId?: string; message?: string }>(c);
  const message = parseChat(body.message ?? "");
  const plan = effectivePlan(profile, await loadPlans(c.env));
  await reserveQuota(c.env, profile.id, "chat", quotaLimit(plan, "chat"));
  const db = createDb(c.env);
  let conversationId = body.conversationId;
  try {
    if (conversationId) {
      const found = await db.get<{ id: string }>(`conversations?id=eq.${conversationId}&user_id=eq.${profile.id}&select=id`);
      if (!found[0]) throw new HttpError(404, "找不到这段对话", "chat");
    } else {
      const created = await db.post<{ id: string }>("conversations", {
        user_id: profile.id,
        title: message.replace(/\s+/g, " ").slice(0, 18),
      });
      conversationId = created[0].id;
    }
    await db.post("messages", { conversation_id: conversationId, role: "user", content: message });
    const history = await db.get<{ role: "user" | "assistant"; content: string }>(
      `messages?conversation_id=eq.${conversationId}&select=role,content&order=created_at.desc&limit=12`,
    );
    const reply = await createChat(await providerKey(c.env), [
      { role: "system", content: CHAT_SYSTEM },
      ...history.reverse().map((item) => ({ role: item.role, content: item.content })),
    ], isMember(profile) ? 800 : 400);
    await db.post("messages", { conversation_id: conversationId, role: "assistant", content: reply });
    console.log(JSON.stringify({ event: "chat.created", userId: profile.id }));
    return c.json({ conversationId, reply });
  } catch (error) {
    await releaseQuota(c.env, profile.id, "chat");
    throw error;
  }
});

app.get("/api/chat/conversations", async (c) => {
  const profile = await requireUser(c);
  const db = createDb(c.env);
  const conversations = await db.get(
    `conversations?user_id=eq.${profile.id}&select=id,title,created_at&order=created_at.desc&limit=40`,
  );
  return c.json({ conversations });
});

app.get("/api/chat/conversations/:id", async (c) => {
  const profile = await requireUser(c);
  const db = createDb(c.env);
  const id = c.req.param("id");
  const found = await db.get(`conversations?id=eq.${id}&user_id=eq.${profile.id}&select=id,title,created_at`);
  if (!found[0]) throw new HttpError(404, "找不到这段对话", "chat");
  const messages = await db.get(`messages?conversation_id=eq.${id}&select=id,role,content,created_at&order=created_at.asc&limit=80`);
  return c.json({ conversation: found[0], messages });
});

app.post("/api/videos", async (c) => {
  const profile = await requireUser(c);
  const body = await readJson<{ prompt?: string; aspectRatio?: string; seconds?: string; firstFrame?: string }>(c);
  const plan = effectivePlan(profile, await loadPlans(c.env));
  const input = parseVideo(body);
  await reserveQuota(c.env, profile.id, "video", quotaLimit(plan, "video"));
  const db = createDb(c.env);
  try {
    const videoId = await createVideo(await providerKey(c.env), input);
    const rows = await db.post("videos", {
      user_id: profile.id,
      prompt: input.prompt,
      mode: input.mode,
      aspect_ratio: input.aspectRatio,
      seconds: input.seconds,
      model: VIDEO_MODEL,
      provider_video_id: videoId,
      status: "processing",
    });
    console.log(JSON.stringify({ event: "video.created", userId: profile.id }));
    return c.json({ video: rows[0] });
  } catch (error) {
    await releaseQuota(c.env, profile.id, "video");
    throw error;
  }
});

app.get("/api/videos", async (c) => {
  const profile = await requireUser(c);
  const db = createDb(c.env);
  const videos = await db.get(
    `videos?user_id=eq.${profile.id}&select=id,prompt,mode,aspect_ratio,seconds,url,status,error,created_at&order=created_at.desc&limit=40`,
  );
  return c.json({ videos });
});

app.get("/api/videos/:id", async (c) => {
  const profile = await requireUser(c);
  const db = createDb(c.env);
  const id = c.req.param("id");
  const rows = await db.get<{
    id: string;
    user_id: string;
    status: string;
    provider_video_id: string | null;
    url: string | null;
    error: string | null;
    prompt: string;
  }>(`videos?id=eq.${id}&user_id=eq.${profile.id}&select=id,user_id,status,provider_video_id,url,error,prompt,mode,aspect_ratio,seconds,created_at`);
  const video = rows[0];
  if (!video) throw new HttpError(404, "找不到视频", "video");
  if (video.status === "processing" && video.provider_video_id) {
    const polled = await pollVideo(await providerKey(c.env), video.provider_video_id);
    if (polled.status === "completed" && polled.url) {
      await db.patch(`videos?id=eq.${video.id}`, { status: "completed", url: polled.url });
      video.status = "completed";
      video.url = polled.url;
    } else if (polled.status === "failed") {
      await db.patch(`videos?id=eq.${video.id}`, { status: "failed", error: polled.error ?? "生成失败" });
      video.status = "failed";
      video.error = polled.error ?? "生成失败";
      await releaseQuota(c.env, profile.id, "video");
    }
  }
  return c.json({ video });
});

app.get("/api/admin/provider-key", async (c) => {
  const profile = await requireUser(c);
  if (profile.role !== "admin") throw new HttpError(403, "需要管理员", "admin");
  const key = await providerKey(c.env).catch(() => "");
  return c.json({ configured: Boolean(key), hint: key ? `····${key.slice(-4)}` : "" });
});

app.post("/api/admin/provider-key", async (c) => {
  const profile = await requireUser(c);
  if (profile.role !== "admin") throw new HttpError(403, "需要管理员", "admin");
  const body = await readJson<{ apiKey?: string }>(c);
  const apiKey = (body.apiKey ?? "").trim();
  if (apiKey.length < 16) throw new HttpError(400, "密钥太短", "key");
  const db = createDb(c.env);
  await db.del("provider_secrets?provider=eq.agnes");
  await db.post("provider_secrets", { provider: "agnes", api_key: apiKey });
  console.log(JSON.stringify({ event: "provider.updated", userId: profile.id }));
  return c.json({ configured: true, hint: `····${apiKey.slice(-4)}` });
});

export default app;

function bearer(header: string | undefined): string {
  if (!header?.startsWith("Bearer ")) return "";
  return header.slice(7).trim();
}

async function requireUser(c: { env: Env; req: { header: (name: string) => string | undefined }; set: (key: "user", value: Profile) => void; get: (key: "user") => Profile }): Promise<Profile> {
  const token = bearer(c.req.header("Authorization"));
  if (!token) throw new HttpError(401, "请先登录", "auth");
  const db = createDb(c.env);
  const sessions = await db.get<{ user_id: string; expires_at: string }>(
    `sessions?token_hash=eq.${await sha256Hex(token)}&select=user_id,expires_at`,
  );
  const session = sessions[0];
  if (!session || new Date(session.expires_at).getTime() < Date.now()) throw new HttpError(401, "登录已过期", "auth");
  const rows = await db.get<Profile>(`profiles?id=eq.${session.user_id}&select=*`);
  if (!rows[0]) throw new HttpError(401, "请先登录", "auth");
  c.set("user", rows[0]);
  return rows[0];
}

async function issueSession(env: Env, userId: string): Promise<string> {
  const token = randomToken();
  const db = createDb(env);
  await db.post("sessions", {
    user_id: userId,
    token_hash: await sha256Hex(token),
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });
  return token;
}

async function loadPlans(env: Env): Promise<Plan[]> {
  const db = createDb(env);
  return db.get<Plan>("plans?select=*&order=price_cents.asc");
}

async function providerKey(env: Env): Promise<string> {
  const fromCloudflare = env.AGNES_API_KEY?.trim() ?? "";
  if (fromCloudflare.length >= 16) return fromCloudflare;
  const db = createDb(env);
  const rows = await db.get<{ api_key: string }>("provider_secrets?provider=eq.agnes&select=api_key");
  if (!rows[0]?.api_key) throw new HttpError(502, "还没有配置 Agnes 密钥", "key");
  return rows[0].api_key;
}

async function reserveQuota(env: Env, userId: string, kind: UsageKind, limit: number): Promise<void> {
  if (limit <= 0) throw new HttpError(402, "当前方案不包含这项，开通会员后可用", "quota");
  const day = shanghaiDay();
  const db = createDb(env);
  const rows = await db.get<{ count: number }>(`usage_daily?user_id=eq.${userId}&day=eq.${day}&kind=eq.${kind}&select=count`);
  const count = rows[0]?.count ?? 0;
  if (count >= limit) throw new HttpError(429, "今天的额度用完了", "quota");
  if (rows[0]) await db.patch(`usage_daily?user_id=eq.${userId}&day=eq.${day}&kind=eq.${kind}`, { count: count + 1 });
  else await db.post("usage_daily", { user_id: userId, day, kind, count: 1 });
}

async function releaseQuota(env: Env, userId: string, kind: UsageKind): Promise<void> {
  const day = shanghaiDay();
  const db = createDb(env);
  const rows = await db.get<{ count: number }>(`usage_daily?user_id=eq.${userId}&day=eq.${day}&kind=eq.${kind}&select=count`);
  const count = rows[0]?.count ?? 0;
  if (count > 0) await db.patch(`usage_daily?user_id=eq.${userId}&day=eq.${day}&kind=eq.${kind}`, { count: count - 1 });
}

async function presentUser(env: Env, profile: Profile) {
  const plans = await loadPlans(env);
  const plan = effectivePlan(profile, plans);
  const day = shanghaiDay();
  const db = createDb(env);
  const usageRows = await db.get<{ kind: UsageKind; count: number }>(
    `usage_daily?user_id=eq.${profile.id}&day=eq.${day}&select=kind,count`,
  );
  const used = (kind: UsageKind) => usageRows.find((row) => row.kind === kind)?.count ?? 0;
  const user: PublicUser = {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    role: profile.role,
    planCode: plan.code,
    planName: plan.name,
    planExpiresAt: isMember(profile) ? profile.plan_expires_at : null,
    member: isMember(profile),
  };
  return {
    user,
    usage: {
      image: { used: used("image"), limit: plan.image_daily },
      chat: { used: used("chat"), limit: plan.chat_daily },
      video: { used: used("video"), limit: plan.video_daily },
    },
  };
}

function publicPlan(plan: Plan) {
  return {
    code: plan.code,
    name: plan.name,
    priceCents: plan.price_cents,
    durationDays: plan.duration_days,
    promo: plan.promo,
    imageDaily: plan.image_daily,
    chatDaily: plan.chat_daily,
    videoDaily: plan.video_daily,
    maxImageSize: plan.max_image_size,
    description: plan.description,
  };
}

function parseAccount(body: { email?: string; password?: string; displayName?: string }) {
  try {
    return assertAccount(body);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "资料不正确", "account");
  }
}

function parseImage(body: { prompt?: string; ratio?: string; size?: string }, maxSize: string) {
  try {
    return assertImageInput(body, maxSize);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "图片参数不正确", "image");
  }
}

function parseVideo(body: { prompt?: string; aspectRatio?: string; seconds?: string; firstFrame?: string }) {
  try {
    return assertVideoInput(body);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "视频参数不正确", "video");
  }
}

function parseChat(message: string) {
  try {
    return assertChatMessage(message);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "问题不正确", "chat");
  }
}
