import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { supportEmail } from "../pages/Legal";
import { api, tokenStore } from "../api";
import { useAuth } from "../auth";

const links = [
  ["/studio", "文生图"],
  ["/chat", "问答"],
  ["/video", "视频"],
  ["/gallery", "作品"],
  ["/pricing", "会员"],
];

export function Shell() {
  const { session, setSession } = useAuth();
  const navigate = useNavigate();

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
          绘简
        </a>
        <nav>
          {links.map(([href, label]) => (
            <NavLink key={href} to={href}>{label}</NavLink>
          ))}
        </nav>
        <div className="nav-end">
          {session ? (
            <>
              <a href="/account">{session.user.displayName}</a>
              <button type="button" className="text-btn" onClick={logout}>退出</button>
            </>
          ) : (
            <>
              <a href="/login">登录</a>
              <a className="btn small" href="/register">注册</a>
            </>
          )}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="foot">
        <div className="foot-links">
          <span>绘简</span>
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          <Link to="/privacy">隐私政策</Link>
          <Link to="/terms">使用条款</Link>
          <Link to="/acceptable-use">使用规范</Link>
        </div>
        <span>请勿生成侵权、违法或色情内容。</span>
      </footer>
    </div>
  );
}
