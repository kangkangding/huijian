interface Env {
  ASSETS: { fetch: typeof fetch };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) return response;
    const country = (request as Request & { cf?: { country?: string } }).cf?.country;
    const rail = country === "CN" ? "alipay" : "creem";
    const html = (await response.text()).replace(
      "<html lang=\"zh-CN\">",
      `<html lang="zh-CN" data-rail="${rail}">`,
    );
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-store");
    headers.delete("content-length");
    return new Response(html, { status: response.status, headers });
  },
};
