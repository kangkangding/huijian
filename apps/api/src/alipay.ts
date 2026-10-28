const GATEWAY = "https://openapi.alipay.com/gateway.do";
const SIGN_ALG = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;

export function yuanText(cents: number): string {
  const whole = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, "0");
  return `${whole}.${frac}`;
}

export function amountCents(yuan: string): number | null {
  if (!/^\d+\.\d{2}$/.test(yuan)) return null;
  const [whole, frac] = yuan.split(".");
  return Number(whole) * 100 + Number(frac);
}

export function alipayTimestamp(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const hour = pick("hour") === "24" ? "00" : pick("hour");
  return `${pick("year")}-${pick("month")}-${pick("day")} ${hour}:${pick("minute")}:${pick("second")}`;
}

export function buildSignString(params: Record<string, string>, excludeSignType = false): string {
  return Object.keys(params)
    .filter((key) => key !== "sign" && !(excludeSignType && key === "sign_type") && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

export function extractResponseNode(body: string, key: string): string | null {
  const marker = `"${key}"`;
  const start = body.indexOf(marker);
  if (start < 0) return null;
  const brace = body.indexOf("{", start + marker.length);
  if (brace < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = brace; index < body.length; index += 1) {
    const char = body[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      continue;
    }
    if (char === "\"") inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return body.slice(brace, index + 1);
    }
  }
  return null;
}

export function prefersMobilePay(userAgent: string): boolean {
  return /Android|iPhone|iPod|Mobile/i.test(userAgent) && !/iPad/i.test(userAgent);
}

async function createPayUrl(method: string, productCode: string, input: {
  appId: string;
  privateKey: string;
  notifyUrl: string;
  returnUrl: string;
  quitUrl: string;
  orderId: string;
  amountCents: number;
  subject: string;
}): Promise<string> {
  const biz: Record<string, string> = {
    out_trade_no: input.orderId,
    total_amount: yuanText(input.amountCents),
    subject: input.subject,
    product_code: productCode,
    timeout_express: "30m",
  };
  if (method === "alipay.trade.wap.pay") biz.quit_url = input.quitUrl;
  const params: Record<string, string> = {
    app_id: input.appId,
    method,
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: alipayTimestamp(),
    version: "1.0",
    notify_url: input.notifyUrl,
    return_url: input.returnUrl,
    biz_content: JSON.stringify(biz),
  };
  params.sign = await signContent(input.privateKey, buildSignString(params));
  return `${GATEWAY}?${new URLSearchParams(params)}`;
}

export function createWapPayUrl(input: {
  appId: string;
  privateKey: string;
  notifyUrl: string;
  returnUrl: string;
  quitUrl: string;
  orderId: string;
  amountCents: number;
  subject: string;
}): Promise<string> {
  return createPayUrl("alipay.trade.wap.pay", "QUICK_WAP_WAY", input);
}

export function createPagePayUrl(input: {
  appId: string;
  privateKey: string;
  notifyUrl: string;
  returnUrl: string;
  quitUrl: string;
  orderId: string;
  amountCents: number;
  subject: string;
}): Promise<string> {
  return createPayUrl("alipay.trade.page.pay", "FAST_INSTANT_TRADE_PAY", input);
}

export async function verifyNotify(publicKey: string, params: Record<string, string>): Promise<boolean> {
  const sign = params.sign ?? "";
  if (!sign) return false;
  return verifyContent(publicKey, buildSignString(params, true), sign);
}

export async function queryTrade(input: {
  appId: string;
  privateKey: string;
  publicKey: string;
  orderId: string;
}): Promise<{ paid: boolean; amountCents: number | null }> {
  const params: Record<string, string> = {
    app_id: input.appId,
    method: "alipay.trade.query",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: alipayTimestamp(),
    version: "1.0",
    biz_content: JSON.stringify({ out_trade_no: input.orderId }),
  };
  params.sign = await signContent(input.privateKey, buildSignString(params));
  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const text = await response.text();
  const node = extractResponseNode(text, "alipay_trade_query_response");
  const signed = text.match(/"sign"\s*:\s*"([^"]+)"/)?.[1] ?? "";
  if (!node || !signed || !(await verifyContent(input.publicKey, node, signed))) {
    throw new Error("支付宝查询验签失败");
  }
  const body = JSON.parse(node) as { code?: string; trade_status?: string; total_amount?: string };
  if (body.code !== "10000") return { paid: false, amountCents: null };
  const paid = body.trade_status === "TRADE_SUCCESS" || body.trade_status === "TRADE_FINISHED";
  return { paid, amountCents: amountCents(body.total_amount ?? "") };
}

async function signContent(privateKey: string, content: string): Promise<string> {
  const key = await importPrivate(privateKey);
  const signature = await crypto.subtle.sign(SIGN_ALG, key, new TextEncoder().encode(content));
  return bytesToBase64(new Uint8Array(signature));
}

async function verifyContent(publicKey: string, content: string, sign: string): Promise<boolean> {
  const key = await importPublic(publicKey);
  return crypto.subtle.verify(SIGN_ALG, key, base64ToBytes(sign), new TextEncoder().encode(content));
}

async function importPrivate(value: string): Promise<CryptoKey> {
  const bytes = decodeDer(value);
  try {
    return await crypto.subtle.importKey("pkcs8", bytes, SIGN_ALG, false, ["sign"]);
  } catch {
    return crypto.subtle.importKey("pkcs8", wrapPkcs1Private(bytes), SIGN_ALG, false, ["sign"]);
  }
}

async function importPublic(value: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("spki", decodeDer(value), SIGN_ALG, false, ["verify"]);
}

function decodeDer(value: string): Uint8Array {
  const body = value.replace(/-----BEGIN [\w\s]+-----/g, "").replace(/-----END [\w\s]+-----/g, "").replace(/\s+/g, "");
  return base64ToBytes(body);
}

function wrapPkcs1Private(pkcs1: Uint8Array): Uint8Array {
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const algorithm = Uint8Array.of(
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  );
  return derSequence(concatBytes(version, algorithm, derOctet(pkcs1)));
}

function derSequence(content: Uint8Array): Uint8Array {
  return concatBytes(Uint8Array.of(0x30), derLength(content.length), content);
}

function derOctet(content: Uint8Array): Uint8Array {
  return concatBytes(Uint8Array.of(0x04), derLength(content.length), content);
}

function derLength(length: number): Uint8Array {
  if (length < 128) return Uint8Array.of(length);
  const bytes: number[] = [];
  let rest = length;
  while (rest > 0) {
    bytes.unshift(rest & 0xff);
    rest >>= 8;
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw);
}

function base64ToBytes(value: string): Uint8Array {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}
