import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, yuan, type Plan } from "../api";
import { useAuth } from "../auth";

type Order = { id: string; plan_code: string; amount_cents: number; status: string };

export function Pricing() {
  const { session } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  useEffect(() => {
    api<{ plans: Plan[] }>("/api/plans")
      .then((data) => setPlans(data.plans))
      .catch(() => setError("方案暂时读不到，价格仍是免费、限时 1.9 元、月费 9.9 元。"));
  }, []);

  async function buy(code: string) {
    setError("");
    setPending(code);
    try {
      const data = await api<{ order: Order }>("/api/membership/orders", {
        method: "POST",
        body: JSON.stringify({ planCode: code }),
      });
      const pay = await api<{ payUrl: string }>(`/api/membership/orders/${data.order.id}/pay`, { method: "POST" });
      window.location.assign(pay.payUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "下单失败");
      setPending("");
    }
  }

  const visible = plans.length > 0 ? plans : fallback;

  return (
    <section>
      <p className="eyebrow">会员</p>
      <h1>先免费试，需要时再开通。</h1>
      <p className="lede">月费 9.9 元。限时方案 1.9 元，同样 30 天。开通后跳转支付宝，付款成功才会开通会员。</p>
      <div className="cards pricing">
        {visible.map((plan) => (
          <article key={plan.code} className={plan.promo ? "featured" : ""}>
            {plan.promo && <span className="tag">限时</span>}
            <h2>{plan.name}</h2>
            <p className="price">{plan.priceCents === 0 ? "0 元" : `${yuan(plan.priceCents)} 元`}</p>
            <p>{plan.description}</p>
            <ul>
              <li>图片 {plan.imageDaily} 张 / 天，最高 {plan.maxImageSize}</li>
              <li>问答 {plan.chatDaily} 条 / 天</li>
              <li>视频 {plan.videoDaily} 段 / 天</li>
            </ul>
            {plan.priceCents === 0 ? (
              <Link className="btn ghost" to="/studio">去作图</Link>
            ) : session ? (
              <button className="btn" type="button" disabled={pending === plan.code} onClick={() => buy(plan.code)}>
                {pending === plan.code ? "建立订单…" : "开通"}
              </button>
            ) : (
              <Link className="btn" to="/register">注册后开通</Link>
            )}
          </article>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

const fallback: Plan[] = [
  { code: "free", name: "免费", priceCents: 0, durationDays: 0, promo: false, imageDaily: 10, chatDaily: 200, videoDaily: 0, maxImageSize: "1K", description: "每天 10 张图、200 条问答，适合先试一句。" },
  { code: "launch", name: "限时会员", priceCents: 190, durationDays: 30, promo: true, imageDaily: 100, chatDaily: 2000, videoDaily: 5, maxImageSize: "2K", description: "限时 1.9 元开通 30 天。每天 100 张图、2000 条问答、5 段视频。" },
  { code: "monthly", name: "月费会员", priceCents: 990, durationDays: 30, promo: false, imageDaily: 100, chatDaily: 2000, videoDaily: 5, maxImageSize: "2K", description: "9.9 元开通 30 天，额度和限时会员相同。" },
];
