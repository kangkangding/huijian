import { useEffect, useState } from "react";
import { api, type VideoItem } from "../api";
import { DownloadButton } from "../components/DownloadButton";
import { NeedLogin, useAuth } from "../auth";
import { useI18n } from "../i18n";

const ratios = ["16:9", "9:16", "1:1", "3:4", "4:3"];

export function VideoPage() {
  return <NeedLogin><VideoBody /></NeedLogin>;
}

function VideoBody() {
  const { session, refresh } = useAuth();
  const { t, tr } = useI18n();
  const [prompt, setPrompt] = useState(t("videoPrompt"));
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
    let stopped = false;
    let timer = 0;
    let wait = 2000;
    let tries = 0;
    const videoId = current.id;
    async function tick() {
      try {
        const data = await api<{ video: VideoItem }>(`/api/videos/${videoId}`);
        if (stopped) return;
        setCurrent(data.video);
        setVideos((items) => items.map((item) => item.id === data.video.id ? data.video : item));
        if (data.video.status !== "processing") return;
        tries += 1;
        if (tries >= 40) {
          setError("视频还在生成。可以过一会儿在列表里再打开。");
          return;
        }
        wait = Math.min(10000, wait + 1000);
        timer = window.setTimeout(tick, wait);
      } catch (caught) {
        if (!stopped) setError(caught instanceof Error ? caught.message : "查询失败");
      }
    }
    timer = window.setTimeout(tick, wait);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [current?.id, current?.status]);

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
  const videoLocked = (usage?.limit ?? 0) <= 0;

  return (
    <section className="studio">
      <div className="composer">
        <p className="eyebrow">{t("videoEyebrow")}</p>
        <h1>{t("videoTitle")}</h1>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} maxLength={800} />
        <div className="choices">
          {ratios.map((value) => (
            <button key={value} type="button" className={aspectRatio === value ? "chip on" : "chip"} onClick={() => setAspectRatio(value)}>{value}</button>
          ))}
        </div>
        <div className="choices">
          {["4", "5", "6", "8"].map((value) => (
            <button key={value} type="button" className={seconds === value ? "chip on" : "chip"} onClick={() => setSeconds(value)}>{t("videoSeconds", { value })}</button>
          ))}
        </div>
        <label>{t("videoFrame")}
          <input value={firstFrame} onChange={(event) => setFirstFrame(event.target.value)} placeholder="https://" />
        </label>
        <div className="row">
          <button className="btn" type="button" onClick={generate} disabled={pending || videoLocked}>{pending ? t("videoSubmitting") : t("videoGenerate")}</button>
          <span className="quiet">{videoLocked ? t("videoLocked") : t("videoToday", { used: usage?.used ?? 0, limit: usage?.limit ?? 0 })}</span>
        </div>
        {error && <p className="error">{tr(error)}</p>}
      </div>
      <div className="stage">
        {current?.url && <video src={current.url} controls />}
        {current?.url && <DownloadButton path={`/api/videos/${current.id}/file`} name="huijian-video" at={current.created_at} />}
        {!current?.url && <div className="empty">{current?.status === "processing" ? t("videoProcessing") : tr(current?.error || "") || t("videoEmpty")}</div>}
        <ul className="plain">
          {videos.map((item) => (
            <li key={item.id}>
              <button type="button" className="text-btn" onClick={() => setCurrent(item)}>{item.prompt.slice(0, 24)} · {statusLabel(item.status, t)}</button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function statusLabel(status: string, t: ReturnType<typeof useI18n>["t"]): string {
  if (status === "completed") return t("statusCompleted");
  if (status === "failed") return t("statusFailed");
  if (status === "processing") return t("statusProcessing");
  return status;
}
