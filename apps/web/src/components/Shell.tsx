import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { supportEmail } from "../pages/Legal";
import { api, tokenStore } from "../api";
import { useAuth } from "../auth";
import { useI18n, type Locale } from "../i18n";

export function Shell() {
  const { session, setSession } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const links = [
    ["/studio", t("navStudio")],
    ["/chat", t("navChat")],
    ["/video", t("navVideo")],
    ["/gallery", t("navGallery")],
    ["/pricing", t("navPricing")],
  ];

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    tokenStore.clear();
    setSession(null);
    navigate("/");
  }

  return (
    <div className="page">
      <header className="nav">
        <a className="brand" href="/">
          <span className="mark" aria-hidden="true" />
          {t("brand")}
        </a>
        <nav>
          {links.map(([href, label]) => (
            <NavLink key={href} to={href}>{label}</NavLink>
          ))}
        </nav>
        <div className="nav-end">
          <div className="lang" role="group" aria-label={t("langLabel")}>
            {(["zh", "en"] as Locale[]).map((item) => (
              <button key={item} type="button" className={locale === item ? "on" : ""} onClick={() => setLocale(item)}>
                {item === "zh" ? "中文" : "EN"}
              </button>
            ))}
          </div>
          {session ? (
            <>
              <a href="/account">{session.user.displayName}</a>
              <button type="button" className="text-btn" onClick={logout}>{t("logout")}</button>
            </>
          ) : (
            <>
              <a href="/login">{t("login")}</a>
              <a className="btn small" href="/register">{t("register")}</a>
            </>
          )}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="foot">
        <div className="foot-links">
          <span>{t("brand")}</span>
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          <Link to="/privacy">{t("privacy")}</Link>
          <Link to="/terms">{t("terms")}</Link>
          <Link to="/acceptable-use">{t("acceptable")}</Link>
        </div>
        <span>{t("footerNote")}</span>
      </footer>
    </div>
  );
}
