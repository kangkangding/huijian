import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, tokenStore } from "./api";

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
  if (!ready) return <p className="quiet">正在确认登录状态…</p>;
  if (!session) {
    return (
      <section className="gate">
        <p className="eyebrow">需要登录</p>
        <h1>先留下一个账号。</h1>
        <p>免费账号就能试出图和问答。视频在会员里。</p>
        <div className="row">
          <Link className="btn" to="/register">注册</Link>
          <Link className="btn ghost" to="/login">登录</Link>
        </div>
      </section>
    );
  }
  return children;
}
