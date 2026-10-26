const base = import.meta.env.VITE_API_BASE ?? "";

export const tokenStore = {
  get: () => localStorage.getItem("huijian.token") ?? "",
  set: (token: string) => localStorage.setItem("huijian.token", token),
  clear: () => localStorage.removeItem("huijian.token"),
};

export class ApiError extends Error {
  code: string;
  status: number;
  conversationId: string;
  constructor(message: string, code = "", status = 0, conversationId = "") {
    super(message);
    this.code = code;
    this.status = status;
    this.conversationId = conversationId;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const data = (await response.json().catch(() => ({}))) as { error?: string; code?: string; conversationId?: string };
  if (!response.ok) throw new ApiError(data.error || "请求失败", data.code ?? "", response.status, data.conversationId ?? "");
  return data as T;
}

export function yuan(cents: number): string {
  const value = cents / 100;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0$/, "");
}

export type Plan = {
  code: string;
  name: string;
  priceCents: number;
  durationDays: number;
  promo: boolean;
  imageDaily: number;
  chatDaily: number;
  videoDaily: number;
  maxImageSize: string;
  description: string;
};

export type ImageItem = {
  id: string;
  prompt: string;
  ratio: string;
  size: string;
  url: string | null;
  status: string;
  error: string | null;
  created_at: string;
};

export type VideoItem = {
  id: string;
  prompt: string;
  mode: string;
  aspect_ratio: string;
  seconds: string;
  url: string | null;
  status: string;
  error: string | null;
  created_at: string;
};
