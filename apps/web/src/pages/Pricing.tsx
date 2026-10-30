import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, yuan, type Plan } from "../api";
import { useAuth } from "../auth";

export function Pricing() {
  const { session } = useAuth();
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

  return (
    <section>
      <p className="eyebrow">会员</p>
      <h1>先免费试，需要时再开通。</h1>
      <p className="lede">国内和国际同一套美元价格。限时会员前 6 个月每月 2.99 美元，之后每月 4.99 美元。月费会员每月 4.99 美元。用银行卡按月订阅，付款成功才会开通会员。</p>
      <div className="cards pricing">
        {visible.map((plan) => (
          <article key={plan.code} className={plan.promo ? "featured" : ""}>
            {plan.promo && <span className="tag">限时</span>}
            <h2>{plan.name}</h2>
            <p className="price">{plan.priceCents === 0 ? "0 元" : `${yuan(plan.priceCents)} 美元`}</p>
            <p>{plan.description}</p>
            {plan.code === "launch" && <p>前 6 个月每月 2.99 美元，从第 7 个月起每月 4.99 美元。</p>}
            <ul>
              <li>图片 {plan.imageDaily} 张 / 天，最高 {plan.maxImageSize}</li>
              <li>问答 {plan.chatDaily} 条 / 天</li>
              <li>视频 {plan.videoDaily} 段 / 天</li>
            </ul>
            {plan.priceCents === 0 ? (
              <Link className="btn ghost" to="/studio">去作图</Link>
            ) : session ? (
              <button className="btn" type="button" disabled={pending === `card-${plan.code}`} onClick={() => subscribe(plan.code)}>
                {pending === `card-${plan.code}` ? "正在打开支付页" : "开通"}
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
  { code: "launch", name: "限时会员", priceCents: 299, durationDays: 30, promo: true, imageDaily: 200, chatDaily: 4000, videoDaily: 10, maxImageSize: "2K", description: "前 6 个月每月 2.99 美元，之后每月 4.99 美元。每天 200 张图、4000 条问答、10 段视频。" },
  { code: "monthly", name: "月费会员", priceCents: 499, durationDays: 30, promo: false, imageDaily: 200, chatDaily: 4000, videoDaily: 10, maxImageSize: "2K", description: "每月 4.99 美元。每天 200 张图、4000 条问答、10 段视频。" },
];
