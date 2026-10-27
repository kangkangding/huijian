import { Link } from "react-router-dom";

const audiences = [
  ["电商", "主图、场景图、详情页首屏。把商品说清楚，背景干净。", "白瓷杯，米白桌布，窗光，商品摄影"],
  ["学生", "封面、海报、课件插图。一句作业要求就能出稿。", "清晨图书馆，扁平插画，暖色"],
  ["爱好者", "想看的画面先画出来，再决定要不要做成短片。", "雨夜小巷，一个人撑伞，电影感"],
];

export function Home() {
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">文生图优先</p>
          <h1>把一句话，写成能用的图。</h1>
          <p className="lede">
            给电商、学生和自己做东西的人。主做出图，页面上也能问一句提示词怎么写，会员可以再出一段短视频。
          </p>
          <div className="row">
            <Link className="btn" to="/studio">开始作图</Link>
            <Link className="btn ghost" to="/pricing">限时 1.9 元</Link>
          </div>
          <p className="quiet">免费每天 10 张图、200 条问答。会员每天 100 张图、2000 条问答、5 段视频。</p>
        </div>
        <div className="posters" aria-hidden="true">
          <article className="poster cup">
            <span>电商主图</span>
            <strong>白瓷，窗光</strong>
          </article>
          <article className="poster book">
            <span>课堂封面</span>
            <strong>清晨，书架</strong>
          </article>
          <article className="poster rain">
            <span>短片首帧</span>
            <strong>雨夜，撑伞</strong>
          </article>
        </div>
      </section>

      <section className="band">
        <h2>三种用法，同一张工作台。</h2>
        <div className="cards">
          {audiences.map(([title, copy, sample]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
              <code>{sample}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="offer">
        <div>
          <p className="eyebrow">会员</p>
          <h2>月费 9.9 元，现在 1.9 元。</h2>
          <p>两个价格都是 30 天，额度和清晰度相同。限时价在定价页标成促销方案。</p>
        </div>
        <Link className="btn" to="/pricing">查看方案</Link>
      </section>
    </>
  );
}
