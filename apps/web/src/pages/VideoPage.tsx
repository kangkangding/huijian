import { useEffect, useState } from "react";
import { api, type VideoItem } from "../api";
import { NeedLogin, useAuth } from "../auth";

const ratios = ["16:9", "9:16", "1:1", "3:4", "4:3"];

export function VideoPage() {
  return <NeedLogin><VideoBody /></NeedLogin>;
}

function VideoBody() {
  const { session, refresh } = useAuth();
  const [prompt, setPrompt] = useState("镜头缓缓推近白瓷杯，窗光轻轻移动，桌布几乎不动");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [seconds, setSeconds] = useState("5");
  const [firstFrame, setFirstFrame] = useState("");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [current, setCurrent] = useState<VideoItem | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api<{ videos: VideoItem[] }>("/api/videos")
      .then((data) => setVideos(data.videos))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "读取失败"));
  }, []);

  useEffect(() => {
    if (!current || current.status !== "processing") return undefined;
    const timer = window.setInterval(async () => {
      const data = await api<{ video: VideoItem }>(`/api/videos/${current.id}`);
      setCurrent(data.video);
      setVideos((items) => items.map((item) => item.id === data.video.id ? data.video : item));
    }, 2000);
    return () => window.clearInterval(timer);
  }, [current]);

  async function generate() {
    setPending(true);
    setError("");
    try {
      const data = await api<{ video: VideoItem }>("/api/videos", {
        method: "POST",
        body: JSON.stringify({ prompt, aspectRatio, seconds, firstFrame }),
      });
      setCurrent(data.video);
      setVideos((items) => [data.video, ...items]);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成失败");
    } finally {
      setPending(false);
    }
  }

  const usage = session?.usage.video;

  return (
    <section className="studio">
      <div className="composer">
        <p className="eyebrow">视频</p>
        <h1>用一句话出一段短片。</h1>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} maxLength={800} />
        <div className="choices">
          {ratios.map((value) => (
            <button key={value} type="button" className={aspectRatio === value ? "chip on" : "chip"} onClick={() => setAspectRatio(value)}>{value}</button>
          ))}
        </div>
        <div className="choices">
          {["4", "5", "6", "8"].map((value) => (
            <button key={value} type="button" className={seconds === value ? "chip on" : "chip"} onClick={() => setSeconds(value)}>{value} 秒</button>
          ))}
        </div>
        <label>首帧图片地址，可留空
          <input value={firstFrame} onChange={(event) => setFirstFrame(event.target.value)} placeholder="https://" />
        </label>
        <div className="row">
          <button className="btn" type="button" onClick={generate} disabled={pending}>{pending ? "提交中…" : "生成视频"}</button>
          <span className="quiet">今日 {usage?.used ?? 0} / {usage?.limit ?? 0}</span>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
      <div className="stage">
        {current?.url && <video src={current.url} controls />}
        {!current?.url && <div className="empty">{current?.status === "processing" ? "视频还在生成，每两秒看一次。" : current?.error || "视频会停在这里。"}</div>}
        <ul className="plain">
          {videos.map((item) => (
            <li key={item.id}>
              <button type="button" className="text-btn" onClick={() => setCurrent(item)}>{item.prompt.slice(0, 24)} · {item.status}</button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
