const MEDIA: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function downloadTarget(raw: string | null | undefined): URL | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (!allowedHost(url.hostname)) return null;
  return url;
}

export function allowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "agnes-ai.cn" || host.endsWith(".agnes-ai.cn") || host === "agnes-ai.com" || host.endsWith(".agnes-ai.com");
}

export function mediaExtension(contentType: string): string | null {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return MEDIA[type] ?? null;
}
