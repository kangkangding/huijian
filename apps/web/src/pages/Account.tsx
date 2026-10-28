import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api, yuan } from "../api";
import { NeedLogin, useAuth } from "../auth";

type Order = { id: string; plan_code: string; amount_cents: number; status: string; created_at: string };
type KeyState = { configured: boolean; hint: string; fallback?: boolean };

export function Account() {
  return <NeedLogin><AccountBody /></NeedLogin>;
}

function AccountBody() {
  const { session, refresh } = useAuth();
  const [params] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [keyState, setKeyState] = useState<KeyState>({ configured: false, hint: "" });
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancel = false;
    async function load() {
      const data = await api<{ orders: Order[] }>("/api/membership/orders");
      let next = data.orders;
      if (params.get("paid") === "1") {
        const pendingOrders = next.filter((order) => order.status === "pending");
        if (pendingOrders.length > 0) {
          await Promise.all(pendingOrders.map((order) => api(`/api/membership/orders/${order.id}/sync`, { method: "POST" }).catch(() => undefined)));
          next = (await api<{ orders: Order[] }>("/api/membership/orders")).orders;
          await refresh();
          if (!cancel) setMessage(next.some((order) => order.status === "paid") ? "支付结果已更新" : "支付结果还在确认，请稍后再看");
        }
      }
      if (!cancel) setOrders(next);
    }
    load().catch((caught) => {
      if (!cancel) setError(caught instanceof Error ? caught.message : "读取失败");
    });
    if (session?.user.role === "admin") {
      api<KeyState>("/api/admin/provider-key").then(setKeyState).catch(() => undefined);
    }
    return () => {
      cancel = true;
    };
  }, [session?.user.role, params]);

  async function saveKey(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const next = await api<KeyState>("/api/admin/provider-key", {
        method: "POST",
        body: JSON.stringify({ apiKey }),
      });
      setKeyState(next);
      setApiKey("");
      setMessage("已写入数据库。线上仍优先使用 Cloudflare 里的密钥。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败");
    }
  }

  async function pay(id: string) {
    setError("");
    try {
      const data = await api<{ payUrl: string }>(`/api/membership/orders/${id}/pay`, { method: "POST" });
      window.location.assign(data.payUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "支付失败");
    }
  }

  async function cancel(id: string) {
    setError("");
    try {
      await api(`/api/membership/orders/${id}/cancel`, { method: "POST" });
      setOrders((current) => current.map((order) => (order.id === id ? { ...order, status: "cancelled" } : order)));
      setMessage("订单已取消");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "取消失败");
    }
  }

  async function sync(id: string) {
    setError("");
    try {
      const result = await api<{ status?: string }>(`/api/membership/orders/${id}/sync`, { method: "POST" });
      const data = await api<{ orders: Order[] }>("/api/membership/orders");
      setOrders(data.orders);
      await refresh();
      setMessage(result.status === "pending" ? "支付宝还没有确认这笔付款" : "支付结果已更新");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "还没有查到支付结果");
    }
  }

  if (!session) return null;
  const { user, usage } = session;

  return (
    <section className="account">
      <p className="eyebrow">账户</p>
      <h1>{user.displayName}</h1>
      <p>{user.email}</p>
      <p>{user.member ? `${user.planName}，有效至 ${user.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString("zh-CN") : ""}` : "当前是免费方案"}</p>
      <div className="meters">
        <Meter label="图片" used={usage.image.used} limit={usage.image.limit} />
        <Meter label="问答" used={usage.chat.used} limit={usage.chat.limit} />
        <Meter label="视频" used={usage.video.used} limit={usage.video.limit} />
      </div>
      <h2>订单</h2>
      <ul className="plain">
        {orders.map((order) => (
          <li key={order.id}>
            {order.plan_code} · {yuan(order.amount_cents)} 元 · {orderStatus(order.status)}
            {order.status === "pending" && <button type="button" className="text-btn" onClick={() => pay(order.id)}>继续支付</button>}
            {order.status === "pending" && <button type="button" className="text-btn" onClick={() => sync(order.id)}>我已支付</button>}
            {order.status === "pending" && <button type="button" className="text-btn" onClick={() => cancel(order.id)}>取消</button>}
          </li>
        ))}
      </ul>
      {orders.length === 0 && <p className="quiet">还没有订单。</p>}
      {user.role === "admin" && (
        <form onSubmit={saveKey} className="key-form">
          <h2>Agnes 密钥</h2>
          <p className="quiet">{keyState.configured ? (keyState.fallback ? `国内密钥 ${keyState.hint}。这一边失败时会自动改用国际密钥。数据库里只是国内密钥的备份，Cloudflare 里的密钥优先。` : `线上正在使用的密钥 ${keyState.hint}。这里保存的是数据库备份，Cloudflare 里的密钥优先。`) : "还没有密钥。第一个注册的账号是管理员。"}</p>
          <label>新密钥
            <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" />
          </label>
          <button className="btn" type="submit">保存到数据库</button>
        </form>
      )}
      {message && <p className="ok">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function orderStatus(status: string): string {
  if (status === "paid") return "已支付";
  if (status === "pending") return "待支付";
  if (status === "cancelled") return "已取消";
  return status;
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const width = limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <span>{label} {used}/{limit}</span>
      <i style={{ width: `${width}%` }} />
    </div>
  );
}
