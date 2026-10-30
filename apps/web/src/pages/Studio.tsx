import { useEffect, useState } from "react";
import { api, type ImageItem } from "../api";
import { DownloadButton } from "../components/DownloadButton";
import { NeedLogin, useAuth } from "../auth";
import { useI18n } from "../i18n";

export function Studio() {
  return (
    <NeedLogin>
      <StudioBody />
    </NeedLogin>
  );
}

function StudioBody() {
  const { session, refresh } = useAuth();
  const { t, tr } = useI18n();
  const samples = [
    { label: t("sampleCup"), prompt: t("promptCup") },
    { label: t("sampleBag"), prompt: t("promptBag") },
    { label: t("sampleLibrary"), prompt: t("promptLibrary") },
  ];
  const ratios = [
    ["1:1", t("studioSquare")],
    ["3:4", t("studioPortrait")],
    ["4:3", t("studioLandscape")],
    ["9:16", t("studioPoster")],
    ["16:9", t("studioWide")],
  ];
  const [prompt, setPrompt] = useState(samples[0].prompt);
  const [ratio, setRatio] = useState("1:1");
  const [size, setSize] = useState("1K");
  const allow2k = session?.user.maxImageSize === "2K";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [current, setCurrent] = useState<ImageItem | null>(null);

  useEffect(() => {
    if (!allow2k) setSize("1K");
  }, [allow2k]);

  useEffect(() => {
    api<{ images: ImageItem[] }>("/api/images").then((data) => {
      setImages(data.images);
      setCurrent(data.images.find((item) => item.url) ?? null);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "读取失败"));
  }, []);

  async function generate() {
    setPending(true);
    setError("");
    try {
      const data = await api<{ image: ImageItem }>("/api/images", {
        method: "POST",
        body: JSON.stringify({ prompt, ratio, size }),
      });
      setCurrent(data.image);
      setImages((items) => [data.image, ...items]);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成失败");
    } finally {
      setPending(false);
    }
  }

  const usage = session?.usage.image;

  return (
    <section className="studio">
      <div className="composer">
        <p className="eyebrow">{t("studioEyebrow")}</p>
        <h1>{t("studioTitle")}</h1>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} maxLength={1000} />
        <div className="chips">
          {samples.map((sample) => (
            <button key={sample.prompt} type="button" className="chip" onClick={() => setPrompt(sample.prompt)}>{sample.label}</button>
          ))}
        </div>
        <div className="choices">
          {ratios.map(([value, label]) => (
            <button key={value} type="button" className={ratio === value ? "chip on" : "chip"} onClick={() => setRatio(value)}>
              {label} {value}
            </button>
          ))}
        </div>
        <div className="choices">
          {["1K", "2K"].map((value) => (
            <button
              key={value}
              type="button"
              className={size === value ? "chip on" : "chip"}
              disabled={value === "2K" && !allow2k}
              onClick={() => setSize(value)}
            >
              {value === "1K" ? t("studio1k") : allow2k ? t("studio2k") : t("studio2kMember")}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={generate} disabled={pending}>
            {pending ? t("studioDrawing") : t("studioGenerate")}
          </button>
          <span className="quiet">{t("studioToday", { used: usage?.used ?? 0, limit: usage?.limit ?? 0 })}</span>
        </div>
        {error && <p className="error">{tr(error)}</p>}
      </div>
      <div className="stage">
        {current?.url ? <img src={current.url} alt={current.prompt} /> : <div className="empty">{t("studioEmpty")}</div>}
        {current?.url && <DownloadButton path={`/api/images/${current.id}/file`} name="huijian-image" at={current.created_at} />}
        {current && <p>{current.prompt}</p>}
        <div className="thumbs">
          {images.filter((item) => item.url).slice(0, 8).map((item) => (
            <button key={item.id} type="button" onClick={() => setCurrent(item)}>
              <img src={item.url ?? ""} alt="" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
