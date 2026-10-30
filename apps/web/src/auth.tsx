import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, tokenStore } from "./api";
import { useI18n } from "./i18n";

export type Session = {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: "user" | "admin";
    planCode: string;
    planName: string;
    planExpiresAt: string | null;
    member: boolean;
    maxImageSize: string;
  };
  usage: {
    image: { used: number; limit: number };
    chat: { used: number; limit: number };
    video: { used: number; limit: number };
  };
};

type AuthValue = {
  session: Session | null;
  ready: boolean;
  refresh: () => Promise<void>;
  setSession: (session: Session | null) => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  async function refresh() {
    if (!tokenStore.get()) {
      setSession(null);
      return;
    }
    setSession(await api<Session>("/api/auth/me"));
  }

  useEffect(() => {
    refresh()
      .catch((caught) => {
        if (caught instanceof ApiError && caught.status === 401) {
          tokenStore.clear();
          setSession(null);
        }
      })
      .finally(() => setReady(true));
  }, []);

  return <AuthContext.Provider value={{ session, ready, refresh, setSession }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider 缺失");
  return value;
}

export function NeedLogin({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const { t } = useI18n();
  if (!ready) return <p className="quiet">{t("checking")}</p>;
  if (!session) {
    return (
      <section className="gate">
        <p className="eyebrow">{t("gateEyebrow")}</p>
        <h1>{t("gateTitle")}</h1>
        <p>{t("gateCopy")}</p>
        <div className="row">
          <Link className="btn" to="/register">{t("register")}</Link>
          <Link className="btn ghost" to="/login">{t("login")}</Link>
        </div>
      </section>
    );
  }
  return children;
}
