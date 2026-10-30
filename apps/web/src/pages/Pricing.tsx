import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, pageRail, redirectToAlipay, yuan, type Plan } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";

type Rail = "alipay" | "creem";

export function Pricing() {
  const { session } = useAuth();
  const { t, tr, planName } = useI18n();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [rail, setRail] = useState<Rail>(pageRail);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  useEffect(() => {
    api<{ plans: Plan[] }>("/api/plans")
      .then((data) => setPlans(data.plans))
      .catch(() => setError("方案暂时读不到，价格仍是免费、限时前 6 个月每月 2.99 美元、月费 4.99 美元。"));
    api<{ rail: string }>("/api/checkout")
      .then((data) => setRail(data.rail === "alipay" ? "alipay" : "creem"))
      .catch(() => setRail("creem"));
  }, []);

  async function subscribe(code: string) {
    setError("");
    setPending(`card-${code}`);
    try {
      const payment = await api<{ url: string }>("/api/membership/creem", {
        method: "POST",
        body: JSON.stringify({ planCode: code }),
      });
      window.location.assign(payment.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "订阅失败");
      setPending("");
    }
  }

  async function payAlipay(code: string) {
    setError("");
    setPending(`alipay-${code}`);
    try {
      const created = await api<{ order: { id: string } }>("/api/membership/orders", {
        method: "POST",
        body: JSON.stringify({ planCode: code }),
      });
      const payment = await api<{ payUrl?: string }>(`/api/membership/orders/${created.order.id}/pay`, { method: "POST" });
      redirectToAlipay(payment);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "支付宝没打开");
      setPending("");
    }
  }

  const visible = plans.length > 0 ? plans : fallback;
  const alipay = rail === "alipay";
  const blurbs: Record<string, string> = alipay
    ? { free: t("planFreeDesc"), launch: t("planLaunchDescAlipay"), monthly: t("planMonthlyDescAlipay") }
    : { free: t("planFreeDesc"), launch: t("planLaunchDesc"), monthly: t("planMonthlyDesc") };

  return (
    <section>
      <p className="eyebrow">{t("pricingEyebrow")}</p>
      <h1>{t("pricingTitle")}</h1>
      <p className="lede">{alipay ? t("pricingLedeAlipay") : t("pricingLede")}</p>
      <div className="cards pricing">
        {visible.map((plan) => (
          <article key={plan.code} className={plan.promo ? "featured" : ""}>
            {plan.promo && <span className="tag">{t("pricingTag")}</span>}
            <h2>{planName(plan.code, plan.name)}</h2>
            <p className="price">{priceText(plan, rail, t)}</p>
            <p>{blurbs[plan.code] ?? plan.description}</p>
            {rail === "creem" && plan.code === "launch" && <p>{t("pricingLaunchNote")}</p>}
            {alipay && plan.priceCents > 0 && <p>{t("pricingAlipayNote")}</p>}
            <ul>
              <li>{t("pricingImages", { count: plan.imageDaily, size: plan.maxImageSize })}</li>
              <li>{t("pricingChats", { count: plan.chatDaily })}</li>
              <li>{t("pricingVideos", { count: plan.videoDaily })}</li>
            </ul>
            {plan.priceCents === 0 ? (
              <Link className="btn ghost" to="/studio">{t("pricingDraw")}</Link>
            ) : !session ? (
              <Link className="btn" to="/register">{t("pricingRegister")}</Link>
            ) : alipay ? (
              <button className="btn" type="button" disabled={pending === `alipay-${plan.code}`} onClick={() => payAlipay(plan.code)}>
                {pending === `alipay-${plan.code}` ? t("pricingAlipayOpening") : t("pricingAlipay")}
              </button>
            ) : (
              <button className="btn" type="button" disabled={pending === `card-${plan.code}`} onClick={() => subscribe(plan.code)}>
                {pending === `card-${plan.code}` ? t("pricingOpening") : t("pricingSubscribe")}
              </button>
            )}
          </article>
        ))}
      </div>
      {error && <p className="error">{tr(error)}</p>}
    </section>
  );
}

function priceText(plan: Plan, rail: Rail, t: ReturnType<typeof useI18n>["t"]): string {
  if (plan.priceCents === 0) return t("pricingFree");
  if (rail === "creem") return t("pricingUsd", { amount: yuan(plan.priceCents) });
  const cents = plan.alipayCents || (plan.code === "launch" ? 1590 : 2690);
  return t("pricingCny", { amount: yuan(cents) });
}

const fallback: Plan[] = [
  { code: "free", name: "免费", priceCents: 0, alipayCents: 0, durationDays: 0, promo: false, imageDaily: 10, chatDaily: 200, videoDaily: 0, maxImageSize: "1K", description: "" },
  { code: "launch", name: "限时会员", priceCents: 299, alipayCents: 1590, durationDays: 30, promo: true, imageDaily: 200, chatDaily: 4000, videoDaily: 10, maxImageSize: "2K", description: "" },
  { code: "monthly", name: "月费会员", priceCents: 499, alipayCents: 2690, durationDays: 30, promo: false, imageDaily: 200, chatDaily: 4000, videoDaily: 10, maxImageSize: "2K", description: "" },
];
