import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, tokenStore } from "../api";
import { useAuth, type Session } from "../auth";

type Mode = "login" | "register" | "forgot" | "reset";

export function Auth({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setSession } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    try {
      if (mode === "register" || mode === "login") {
        const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
        const body = mode === "register" ? { email, password, displayName } : { email, password };
        const result = await api<{ token: string; user: Session["user"] }>(path, {
          method: "POST",
          body: JSON.stringify(body),
        });
        tokenStore.set(result.token);
        const session = await api<Session>("/api/auth/me");
        setSession(session);
        navigate("/studio");
        return;
      }
      if (mode === "forgot") {
        const result = await api<{ message: string; resetUrl?: string }>("/api/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        setMessage(result.resetUrl ? `${result.message} 开发环境重置链接：${result.resetUrl}` : result.message);
        return;
      }
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: params.get("token") ?? "", password }),
      });
      setMessage("密码已更新，请登录。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "提交失败");
    } finally {
      setPending(false);
    }
  }

  const title = { login: "登录", register: "注册", forgot: "找回密码", reset: "设置新密码" }[mode];

  return (
    <section className="auth">
      <p className="eyebrow">账号</p>
      <h1>{title}</h1>
      <form onSubmit={onSubmit}>
        {mode === "register" && (
          <label>昵称
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={32} />
          </label>
        )}
        {mode !== "reset" && (
          <label>邮箱
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
        )}
        {mode !== "forgot" && (
          <label>密码
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        {message && <p className="ok">{message}</p>}
        <button className="btn" type="submit" disabled={pending}>{pending ? "提交中…" : title}</button>
      </form>
      <p className="quiet">
        {mode === "login" && <><Link to="/register">没有账号</Link> · <Link to="/forgot">忘记密码</Link></>}
        {mode === "register" && <Link to="/login">已有账号</Link>}
        {mode === "forgot" && <Link to="/login">返回登录</Link>}
        {mode === "reset" && <Link to="/login">去登录</Link>}
      </p>
    </section>
  );
}
