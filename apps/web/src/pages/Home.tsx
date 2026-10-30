import { Link } from "react-router-dom";
import { useI18n } from "../i18n";

export function Home() {
  const { t } = useI18n();
  const audiences = [
    [t("audienceShop"), t("audienceShopCopy"), t("audienceShopSample")],
    [t("audienceStudy"), t("audienceStudyCopy"), t("audienceStudySample")],
    [t("audienceHobby"), t("audienceHobbyCopy"), t("audienceHobbySample")],
  ];

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">{t("homeEyebrow")}</p>
          <h1>{t("homeTitle")}</h1>
          <p className="lede">{t("homeLede")}</p>
          <div className="row">
            <Link className="btn" to="/studio">{t("homeStart")}</Link>
            <Link className="btn ghost" to="/pricing">{t("homePrice")}</Link>
          </div>
          <p className="quiet">{t("homeQuiet")}</p>
        </div>
        <div className="posters" aria-hidden="true">
          <article className="poster cup">
            <span>{t("posterShop")}</span>
            <strong>{t("posterShopStrong")}</strong>
          </article>
          <article className="poster book">
            <span>{t("posterClass")}</span>
            <strong>{t("posterClassStrong")}</strong>
          </article>
          <article className="poster rain">
            <span>{t("posterFilm")}</span>
            <strong>{t("posterFilmStrong")}</strong>
          </article>
        </div>
      </section>

      <section className="band">
        <h2>{t("homeUses")}</h2>
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
          <p className="eyebrow">{t("homeOfferEyebrow")}</p>
          <h2>{t("homeOfferTitle")}</h2>
          <p>{t("homeOfferCopy")}</p>
        </div>
        <Link className="btn" to="/pricing">{t("homeOfferButton")}</Link>
      </section>
    </>
  );
}
