import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, yuan, type Plan } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";

export function Pricing() {
  const { session } = useAuth();
  const { t, tr, planName } = useI18n();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  useEffect(() => {
    api<{ plans: Plan[] }>("/api/plans")
      .then((data) => setPlans(data.plans))
      .catch(() => setError("方案暂时读不到，价格仍是免费、限时前 6 个月每月 2.99 美元、月费 4.99 美元。"));
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

  const visible = plans.length > 0 ? plans : fallback;
  const blurbs: Record<string, string> = {
    free: t("planFreeDesc"),
    launch: t("planLaunchDesc"),
    monthly: t("planMonthlyDesc"),
  };

  return (
    <section>
      <p className="eyebrow">{t("pricingEyebrow")}</p>
      <h1>{t("pricingTitle")}</h1>
      <p className="lede">{t("pricingLede")}</p>
      <div className="cards pricing">
        {visible.map((plan) => (
          <article key={plan.code} className={plan.promo ? "featured" : ""}>
            {plan.promo && <span className="tag">{t("pricingTag")}</span>}
            <h2>{planName(plan.code, plan.name)}</h2>
            <p className="price">{plan.priceCents === 0 ? t("pricingFree") : t("pricingUsd", { amount: yuan(plan.priceCents) })}</p>
            <p>{blurbs[plan.code] ?? plan.description}</p>
            {plan.code === "launch" && <p>{t("pricingLaunchNote")}</p>}
            <ul>
              <li>{t("pricingImages", { count: plan.imageDaily, size: plan.maxImageSize })}</li>
              <li>{t("pricingChats", { count: plan.chatDaily })}</li>
              <li>{t("pricingVideos", { count: plan.videoDaily })}</li>
            </ul>
            {plan.priceCents === 0 ? (
              <Link className="btn ghost" to="/studio">{t("pricingDraw")}</Link>
            ) : session ? (
              <button className="btn" type="button" disabled={pending === `card-${plan.code}`} onClick={() => subscribe(plan.code)}>
                {pending === `card-${plan.code}` ? t("pricingOpening") : t("pricingSubscribe")}
              </button>
            ) : (
              <Link className="btn" to="/register">{t("pricingRegister")}</Link>
            )}
          </article>
        ))}
      </div>
      {error && <p className="error">{tr(error)}</p>}
    </section>
  );
}

const fallback: Plan[] = [
  { code: "free", name: "免费", priceCents: 0, durationDays: 0, promo: false, imageDaily: 10, chatDaily: 200, videoDaily: 0, maxImageSize: "1K", description: "" },
  { code: "launch", name: "限时会员", priceCents: 299, durationDays: 30, promo: true, imageDaily: 200, chatDaily: 4000, videoDaily: 10, maxImageSize: "2K", description: "" },
  { code: "monthly", name: "月费会员", priceCents: 499, durationDays: 30, promo: false, imageDaily: 200, chatDaily: 4000, videoDaily: 10, maxImageSize: "2K", description: "" },
];
