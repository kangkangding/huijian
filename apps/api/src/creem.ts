import { HttpError } from "./http.ts";
import { timingSafeEqual } from "./password.ts";

const CREEM_API = "https://api.creem.io/v1/checkouts";

export const creemPlans = {
  launch: { productId: "prod_fkKKTJazF5XoDbYFwjoQL", discountCode: "LAUNCH6", amountCents: 299 },
  monthly: { productId: "prod_6v1tliH8ibjwNy0OI8mDD", discountCode: "", amountCents: 499 },
} as const;

const productPlans = new Map<string, keyof typeof creemPlans>(
  Object.entries(creemPlans).map(([code, plan]) => [plan.productId, code as keyof typeof creemPlans]),
);

export function creemPlanForProduct(productId: string): keyof typeof creemPlans | null {
  return productPlans.get(productId) ?? null;
}

export async function creemSignature(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signed)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function creemSignatureMatches(secret: string, payload: string, header: string): Promise<boolean> {
  const trimmed = header.trim().toLowerCase();
  const actual = trimmed.startsWith("sha256=") ? trimmed.slice("sha256=".length) : trimmed;
  const expected = await creemSignature(secret, payload);
  return sameText(expected, actual);
}

export async function creemWebhookVerified(secret: string, payload: string, headers: Headers): Promise<boolean> {
  if (!secret) return false;
  const id = headers.get("webhook-id");
  const timestampHeader = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (id && timestampHeader && signatureHeader) return standardWebhookMatches(secret, payload, id, timestampHeader, signatureHeader);
  const legacy = headers.get("creem-signature") ?? headers.get("x-creem-signature") ?? "";
  return legacy ? creemSignatureMatches(secret, payload, legacy) : false;
}

async function standardWebhookMatches(secret: string, payload: string, id: string, timestampHeader: string, signatureHeader: string): Promise<boolean> {
  const timestamp = Number.parseInt(timestampHeader, 10);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 300) return false;
  const secretValue = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const keyBytes = fromBase64(secretValue);
  if (!keyBytes) return false;
  const expected = toBase64(await hmacBytes(keyBytes, `${id}.${timestamp}.${payload}`));
  for (const part of signatureHeader.split(" ")) {
    const [version, signature] = part.split(",");
    if (version === "v1" && signature && sameText(signature, expected)) return true;
  }
  return false;
}

async function hmacBytes(keyBytes: Uint8Array, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", keyBytes as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function sameText(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  const a = new Uint8Array(left.length);
  const b = new Uint8Array(right.length);
  for (let i = 0; i < left.length; i += 1) {
    a[i] = left.charCodeAt(i);
    b[i] = right.charCodeAt(i);
  }
  return timingSafeEqual(a, b);
}

function fromBase64(value: string): Uint8Array | null {
  try {
    const raw = atob(value);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function toBase64(bytes: Uint8Array): string {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw);
}

export async function createCreemCheckout(input: {
  apiKey: string;
  planCode: keyof typeof creemPlans;
  userId: string;
  email: string;
  successUrl: string;
}): Promise<string> {
  const plan = creemPlans[input.planCode];
  const body: Record<string, unknown> = {
    product_id: plan.productId,
    success_url: input.successUrl,
    request_id: `${input.userId}:${input.planCode}:${Date.now()}`,
    customer: { email: input.email },
    metadata: { userId: input.userId, planCode: input.planCode },
  };
  if (plan.discountCode) body.discount_code = plan.discountCode;
  const response = await fetch(CREEM_API, {
    method: "POST",
    headers: { "x-api-key": input.apiKey, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => null) as { checkout_url?: string; checkoutUrl?: string } | null;
  const url = payload?.checkout_url || payload?.checkoutUrl;
  if (!response.ok || !url) throw new HttpError(502, "国际支付暂时不可用", "payment");
  return url;
}

export type CreemAction = {
  action: "grant" | "revoke" | "ignore";
  planCode: keyof typeof creemPlans | null;
  userId: string;
  email: string;
  transactionId: string;
  periodEnd: string;
  amountCents: number;
};

export function readCreemEvent(body: unknown): CreemAction {
  const event = asRecord(body);
  const type = stringValue(event.eventType) || stringValue(event.type);
  const object = asRecord(event.object ?? event.data);
  const productId = readProductId(object);
  const planCode = creemPlanForProduct(productId);
  const empty: CreemAction = { action: "ignore", planCode, userId: "", email: "", transactionId: "", periodEnd: "", amountCents: 0 };
  if (!planCode) return empty;
  const userId = readUserId(object);
  const email = stringValue(asRecord(object.customer).email).toLowerCase();
  const periodEnd = readPeriodEnd(object);
  const transactionId = readTransactionId(object);
  const amountCents = readAmount(object);
  if (type === "subscription.paid" || (type === "checkout.completed" && stringValue(object.status) === "completed")) {
    if ((!userId && !email) || !transactionId) return empty;
    return { action: "grant", planCode, userId, email, transactionId, periodEnd, amountCents };
  }
  if (type === "subscription.expired" || type === "subscription.canceled" || type === "subscription.paused" || type === "subscription.unpaid") {
    if (!userId && !email) return empty;
    return { action: "revoke", planCode, userId, email, transactionId, periodEnd, amountCents };
  }
  return empty;
}

function readProductId(object: Record<string, unknown>): string {
  const product = object.product;
  if (typeof product === "string") return product;
  const id = stringValue(asRecord(product).id);
  if (id) return id;
  return stringValue(asRecord(object.order).product);
}

function readUserId(object: Record<string, unknown>): string {
  const metadata = asRecord(object.metadata);
  const direct = stringValue(metadata.userId);
  if (isUuid(direct)) return direct;
  const subscription = asRecord(object.subscription);
  const nested = stringValue(asRecord(subscription.metadata).userId);
  return isUuid(nested) ? nested : "";
}

function readPeriodEnd(object: Record<string, unknown>): string {
  const direct = stringValue(object.current_period_end_date);
  if (direct) return direct;
  return stringValue(asRecord(object.subscription).current_period_end_date);
}

function readTransactionId(object: Record<string, unknown>): string {
  const direct = stringValue(object.last_transaction_id);
  if (direct) return direct;
  const nested = stringValue(asRecord(object.last_transaction).id);
  if (nested) return nested;
  return stringValue(asRecord(object.order).transaction);
}

function readAmount(object: Record<string, unknown>): number {
  const amount = asRecord(object.last_transaction).amount ?? asRecord(object.order).amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return 0;
  return Number.isInteger(amount) ? amount : Math.round(amount * 100);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
