import { useEffect, useState, type FormEvent } from "react";
import { api, yuan } from "../api";
import { NeedLogin, useAuth, type Session } from "../auth";

type Order = { id: string; plan_code: string; amount_cents: number; status: string; created_at: string };
type KeyState = { configured: boolean; hint: string };

export function Account() {
  return <NeedLogin><AccountBody /></NeedLogin>;
}

function AccountBody() {
  const { session, refresh } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [keyState, setKeyState] = useState<KeyState>({ configured: false, hint: "" });
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<{ orders: Order[] }>("/api/membership/orders")
      .then((data) => setOrders(data.orders))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "读取失败"));
    if (session?.user.role === "admin") {
      api<KeyState>("/api/admin/provider-key").then(setKeyState).catch(() => undefined);
    }
  }, [session?.user.role]);

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

  async function confirm(id: string) {
    try {
      await api<Session>(`/api/membership/orders/${id}/confirm`, { method: "POST" });
      setMessage("会员已开通");
      await refresh();
      const data = await api<{ orders: Order[] }>("/api/membership/orders");
      setOrders(data.orders);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "确认失败");
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
            {order.plan_code} · {yuan(order.amount_cents)} 元 · {order.status}
            {order.status === "pending" && <button type="button" className="text-btn" onClick={() => confirm(order.id)}>确认开通</button>}
          </li>
        ))}
      </ul>
      {orders.length === 0 && <p className="quiet">还没有订单。</p>}
      {user.role === "admin" && (
        <form onSubmit={saveKey} className="key-form">
          <h2>Agnes 密钥</h2>
          <p className="quiet">{keyState.configured ? `线上正在使用的密钥 ${keyState.hint}。这里保存的是数据库备份，Cloudflare 里的密钥优先。` : "还没有密钥。第一个注册的账号是管理员。"}</p>
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

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const width = limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <span>{label} {used}/{limit}</span>
      <i style={{ width: `${width}%` }} />
    </div>
  );
}
