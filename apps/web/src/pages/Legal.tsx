import { Link } from "react-router-dom";
import { useI18n } from "../i18n";

export const supportEmail = "apiflowx@outlook.com";

export function Privacy() {
  const { t } = useI18n();
  return (
    <article className="legal">
      <p className="eyebrow">{t("brand")}</p>
      <h1>{t("privacyTitle")}</h1>
      <p className="quiet">{t("effective")}</p>
      <p>{t("privacyIntro")}</p>
      <h2>{t("privacyKeep")}</h2>
      <p>{t("privacyKeep1")}</p>
      <p>{t("privacyKeep2")}</p>
      <p>{t("privacyKeep3")}</p>
      <p>{t("privacyKeep4")}</p>
      <h2>{t("privacyUse")}</h2>
      <p>{t("privacyUse1")}</p>
      <h2>{t("privacyHowLong")}</h2>
      <p>{t("privacyHowLong1")}</p>
      <h2>{t("privacyChoice")}</h2>
      <p>{t("privacyChoice1")}</p>
      <p>{t("contact")}<a href={`mailto:${supportEmail}`}>{supportEmail}</a></p>
      <p><Link to="/terms">{t("terms")}</Link> · <Link to="/acceptable-use">{t("acceptable")}</Link></p>
    </article>
  );
}

export function Terms() {
  const { t, locale } = useI18n();
  const stop = locale === "zh" ? "。" : ".";
  return (
    <article className="legal">
      <p className="eyebrow">{t("brand")}</p>
      <h1>{t("termsTitle")}</h1>
      <p className="quiet">{t("effective")}</p>
      <p>{t("termsIntro")}</p>
      <h2>{t("termsAccount")}</h2>
      <p>{t("termsAccount1")}</p>
      <h2>{t("termsAllowed")}</h2>
      <p>{t("termsAllowed1")}<Link to="/acceptable-use">{t("acceptable")}</Link>{stop}</p>
      <p>{t("termsAllowed2")}</p>
      <h2>{t("termsPay")}</h2>
      <p>{t("termsPay1")}</p>
      <p>{t("termsPay2")}</p>
      <h2>{t("termsChange")}</h2>
      <p>{t("termsChange1")}</p>
      <h2>{t("termsContact")}</h2>
      <p>{t("termsContact1")} <a href={`mailto:${supportEmail}`}>{supportEmail}</a>{stop}</p>
      <p><Link to="/privacy">{t("privacy")}</Link> · <Link to="/acceptable-use">{t("acceptable")}</Link></p>
    </article>
  );
}

export function AcceptableUse() {
  const { t, locale } = useI18n();
  const stop = locale === "zh" ? "。" : ".";
  return (
    <article className="legal">
      <p className="eyebrow">{t("brand")}</p>
      <h1>{t("useTitle")}</h1>
      <p className="quiet">{t("effective")}</p>
      <p>{t("useIntro")}</p>
      <h2>{t("useBanned")}</h2>
      <p>{t("useBannedLead")}</p>
      <p>{t("useBanned1")}</p>
      <p>{t("useBanned2")}</p>
      <p>{t("useBanned3")}</p>
      <p>{t("useBanned4")}</p>
      <h2>{t("useHandle")}</h2>
      <p>{t("useHandle1")}</p>
      <h2>{t("termsContact")}</h2>
      <p>{t("useContact1")} <a href={`mailto:${supportEmail}`}>{supportEmail}</a>{stop}</p>
      <p><Link to="/terms">{t("terms")}</Link> · <Link to="/privacy">{t("privacy")}</Link></p>
    </article>
  );
}
