import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import { NeedLogin, useAuth } from "../auth";

type Conversation = { id: string; title: string };
type Message = { id: string; role: "user" | "assistant"; content: string };

export function Chat() {
  return <NeedLogin><ChatBody /></NeedLogin>;
}

function ChatBody() {
  const { session, refresh } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [current, setCurrent] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api<{ conversations: Conversation[] }>("/api/chat/conversations")
      .then((data) => setConversations(data.conversations))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "读取失败"));
  }, []);

  async function open(id: string) {
    setCurrent(id);
    setError("");
    try {
      const data = await api<{ messages: Message[] }>(`/api/chat/conversations/${id}`);
      setMessages(data.messages);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "读取失败");
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;
    setPending(true);
    setError("");
    setText("");
    setMessages((items) => [...items, { id: `local-${Date.now()}`, role: "user", content: message }]);
    try {
      const data = await api<{ conversationId: string; reply: string }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ conversationId: current || undefined, message }),
      });
      setCurrent(data.conversationId);
      setMessages((items) => [...items, { id: `reply-${Date.now()}`, role: "assistant", content: data.reply }]);
      const list = await api<{ conversations: Conversation[] }>("/api/chat/conversations");
      setConversations(list.conversations);
      await refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.conversationId) setCurrent(caught.conversationId);
      setError(caught instanceof Error ? caught.message : "发送失败");
    } finally {
      setPending(false);
    }
  }

  const usage = session?.usage.chat;

  return (
    <section className="chat">
      <aside>
        <button type="button" className="btn small" onClick={() => { setCurrent(""); setMessages([]); }}>新问题</button>
        {conversations.map((item) => (
          <button key={item.id} type="button" className={item.id === current ? "talk on" : "talk"} onClick={() => open(item.id)}>
            {item.title}
          </button>
        ))}
      </aside>
      <div>
        <p className="eyebrow">问答 · 今日 {usage?.used ?? 0} / {usage?.limit ?? 0}</p>
        <h1>问提示词、画幅和额度。</h1>
        <div className="thread">
          {messages.length === 0 && <p className="quiet">例如：竖版电商主图，提示词要写哪些东西？</p>}
          {messages.map((item) => (
            <article key={item.id} className={item.role}>{item.content}</article>
          ))}
        </div>
        <form onSubmit={onSubmit} className="ask">
          <input value={text} onChange={(event) => setText(event.target.value)} maxLength={500} placeholder="写一个短问题" />
          <button className="btn" type="submit" disabled={pending}>{pending ? "…" : "发送"}</button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    </section>
  );
}
