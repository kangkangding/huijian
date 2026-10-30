import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api, redirectToAlipay, yuan } from "../api";
import { NeedLogin, useAuth } from "../auth";
import { useI18n } from "../i18n";

type Order = { id: string; plan_code: string; amount_cents: number; status: string; created_at: string; out_trade_no?: string | null };
type KeyState = { configured: boolean; hint: string; fallback?: boolean };

export function Account() {
  return <NeedLogin><AccountBody /></NeedLogin>;
}

function AccountBody() {
  const { session, refresh } = useAuth();
  const { t, tr, planName, dateLocale } = useI18n();
  const [params] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [keyState, setKeyState] = useState<KeyState>({ configured: false, hint: "" });
  const [apiKey, setApiKey] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancel = false;
    async function load() {
      const data = await api<{ orders: Order[] }>("/api/membership/orders");
      let next = data.orders;
      if (params.get("paid") === "1" || params.get("out_trade_no")) {
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
    api<{ plans: { code: string; name: string }[] }>("/api/plans")
      .then((data) => {
        if (cancel) return;
        const next: Record<string, string> = {};
        for (const plan of data.plans) next[plan.code] = plan.name;
        setNames((current) => ({ ...current, ...next }));
      })
      .catch(() => undefined);
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
      const data = await api<{ payUrl?: string; fields?: Record<string, string> }>(`/api/membership/orders/${id}/pay`, { method: "POST" });
      redirectToAlipay(data);
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
      <p className="eyebrow">{t("accountTitle")}</p>
      <h1>{user.displayName}</h1>
      <p>{user.email}</p>
      <p>{user.member ? t("accountMember", { plan: planName(user.planCode, user.planName), date: user.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString(dateLocale) : "" }) : t("accountFree")}</p>
      <div className="meters">
        <Meter label={t("accountImages")} used={usage.image.used} limit={usage.image.limit} closed={t("accountClosed")} />
        <Meter label={t("accountChats")} used={usage.chat.used} limit={usage.chat.limit} closed={t("accountClosed")} />
        <Meter label={t("accountVideos")} used={usage.video.used} limit={usage.video.limit} closed={t("accountClosed")} />
      </div>
      <h2>{t("accountOrders")}</h2>
      <ul className="orders">
        {orders.map((order) => (
          <li key={order.id}>
            <div className="order-main">
              <strong>{planName(order.plan_code, names[order.plan_code])}</strong>
              <span>{(order.out_trade_no?.startsWith("creem:") ? t("accountUsd", { amount: yuan(order.amount_cents) }) : t("accountCny", { amount: yuan(order.amount_cents) }))} · {orderTime(order.created_at, dateLocale)}</span>
            </div>
            <div className="order-side">
              <span className={`status ${order.status}`}>{orderLabel(order.status, t)}</span>
              {order.status === "pending" && (
                <div className="order-actions">
                  <button type="button" className="btn small" onClick={() => pay(order.id)}>{t("accountPay")}</button>
                  <button type="button" className="btn small ghost" onClick={() => sync(order.id)}>{t("accountPaidCheck")}</button>
                  <button type="button" className="text-btn" onClick={() => cancel(order.id)}>{t("accountCancel")}</button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {orders.length === 0 && <p className="quiet">{t("accountNone")}</p>}
      {user.role === "admin" && (
        <form onSubmit={saveKey} className="key-form">
          <h2>{t("keyTitle")}</h2>
          <p className="quiet">{keyState.configured ? (keyState.fallback ? t("keyFallback", { hint: keyState.hint }) : t("keyLive", { hint: keyState.hint })) : t("keyMissing")}</p>
          <label>{t("keyNew")}
            <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" />
          </label>
          <button className="btn" type="submit">{t("keySave")}</button>
        </form>
      )}
      {message && <p className="ok">{tr(message)}</p>}
      {error && <p className="error">{tr(error)}</p>}
    </section>
  );
}

function orderLabel(status: string, t: ReturnType<typeof useI18n>["t"]): string {
  if (status === "paid") return t("statusPaid");
  if (status === "pending") return t("statusPending");
  if (status === "cancelled") return t("statusCancelled");
  return status;
}

function orderTime(value: string, dateLocale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(dateLocale, {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function Meter({ label, used, limit, closed }: { label: string; used: number; limit: number; closed: string }) {
  const width = limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <span>{label}<em>{limit === 0 ? closed : `${used}/${limit}`}</em></span>
      <b className="track"><i style={{ width: `${width}%` }} /></b>
    </div>
  );
}
