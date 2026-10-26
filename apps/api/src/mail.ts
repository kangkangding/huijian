import type { Env } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendPasswordReset(env: Env, to: string, resetUrl: string): Promise<boolean> {
  const apiKey = env.BREVO_API_KEY?.trim() ?? "";
  const sender = env.BREVO_SENDER_EMAIL?.trim() ?? "";
  if (apiKey.length < 16 || !sender) {
    console.log(JSON.stringify({ event: "mail.skip", reason: "unconfigured" }));
    return false;
  }
  const safeUrl = escapeHtml(resetUrl);
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: env.BREVO_SENDER_NAME?.trim() || "绘简", email: sender },
      to: [{ email: to }],
      subject: "绘简重置密码",
      htmlContent: `<p>你正在重置绘简的密码。链接 30 分钟内有效。</p><p><a href="${safeUrl}">设置新密码</a></p><p>如果不是你本人操作，忽略这封邮件即可。</p>`,
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 180);
    console.log(JSON.stringify({ event: "mail.error", status: response.status, detail }));
    return false;
  }
  return true;
}
