import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, tokenStore } from "../api";
import { useAuth, type Session } from "../auth";
import { useI18n } from "../i18n";

type Mode = "login" | "register" | "forgot" | "reset" | "verify";

export function Auth({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setSession } = useAuth();
  const { t, tr } = useI18n();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (mode === "reset" && !params.get("token")) setError("缺少重置凭证");
  }, [mode, params]);

  useEffect(() => {
    if (mode !== "verify") return;
    const token = params.get("token") ?? "";
    if (!token) {
      setError("缺少验证凭证");
      return;
    }
    let cancel = false;
    api("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => {
        if (!cancel) setMessage("邮箱已确认，请登录。");
      })
      .catch((caught) => {
        if (!cancel) setError(caught instanceof Error ? caught.message : "确认失败");
      });
    return () => {
      cancel = true;
    };
  }, [mode, params]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setCanResend(false);
    setPending(true);
    try {
      if (mode === "register") {
        const result = await api<{ token?: string; message?: string; verifyUrl?: string }>("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password, displayName }),
        });
        if (result.token) {
          tokenStore.set(result.token);
          setSession(await api<Session>("/api/auth/me"));
          navigate("/studio");
          return;
        }
        setMessage(result.verifyUrl ? `${result.message ?? ""} 开发环境验证链接：${result.verifyUrl}` : result.message ?? "请查看邮箱");
        return;
      }
      if (mode === "login") {
        const result = await api<{ token: string }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        tokenStore.set(result.token);
        setSession(await api<Session>("/api/auth/me"));
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
      setCanResend(caught instanceof ApiError && caught.code === "email");
    } finally {
      setPending(false);
    }
  }

  const title = {
    login: t("authLogin"),
    register: t("authRegister"),
    forgot: t("authForgot"),
    reset: t("authReset"),
    verify: t("authVerify"),
  }[mode];

  async function resend() {
    setPending(true);
    setError("");
    try {
      const result = await api<{ message: string }>("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(result.message);
      setCanResend(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "发送失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="auth">
      <p className="eyebrow">{t("accountEyebrow")}</p>
      <h1>{title}</h1>
      {mode === "verify" ? (
        <>
          {!error && !message && <p className="quiet">{t("authVerifying")}</p>}
          {error && <p className="error">{tr(error)}</p>}
          {message && <p className="ok">{tr(message)}</p>}
        </>
      ) : (
        <form onSubmit={onSubmit}>
          {mode === "register" && (
            <label>{t("authName")}
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={32} />
            </label>
          )}
          {mode !== "reset" && (
            <label>{t("authEmail")}
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
          )}
          {mode !== "forgot" && (
            <label>{t("authPassword")}
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
            </label>
          )}
          {error && <p className="error">{tr(error)}</p>}
          {canResend && <button className="text-btn" type="button" onClick={resend} disabled={pending}>{t("authResend")}</button>}
          {message && <p className="ok">{tr(message)}</p>}
          <button className="btn" type="submit" disabled={pending || (mode === "reset" && !params.get("token"))}>{pending ? t("authPending") : title}</button>
        </form>
      )}
      <p className="quiet">
        {mode === "login" && <><Link to="/register">{t("authNoAccount")}</Link> · <Link to="/forgot">{t("authForgotLink")}</Link></>}
        {mode === "register" && <Link to="/login">{t("authHasAccount")}</Link>}
        {mode === "forgot" && <Link to="/login">{t("authBackLogin")}</Link>}
        {(mode === "reset" || mode === "verify") && <Link to="/login">{t("authGoLogin")}</Link>}
      </p>
    </section>
  );
}
