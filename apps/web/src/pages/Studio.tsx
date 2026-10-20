import { useEffect, useState } from "react";
import { api, type ImageItem } from "../api";
import { NeedLogin, useAuth } from "../auth";

const ratios = [
  ["1:1", "方图"],
  ["3:4", "竖图"],
  ["4:3", "横图"],
  ["9:16", "海报"],
  ["16:9", "宽屏"],
];

const samples = [
  "白瓷杯放在米白桌布上，柔和窗光，干净背景，商品摄影",
  "帆布包平铺在浅木桌上，俯拍，自然光，电商主图",
  "清晨图书馆封面插画，暖色扁平，适合课堂作业",
];

export function Studio() {
  return (
    <NeedLogin>
      <StudioBody />
    </NeedLogin>
  );
}

function StudioBody() {
  const { session, refresh } = useAuth();
  const [prompt, setPrompt] = useState(samples[0]);
  const [ratio, setRatio] = useState("1:1");
  const [size, setSize] = useState("1K");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [current, setCurrent] = useState<ImageItem | null>(null);

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
        <p className="eyebrow">文生图</p>
        <h1>写下你要的画面。</h1>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} maxLength={1000} />
        <div className="chips">
          {samples.map((sample) => (
            <button key={sample} type="button" className="chip" onClick={() => setPrompt(sample)}>{sample.slice(0, 10)}…</button>
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
            <button key={value} type="button" className={size === value ? "chip on" : "chip"} onClick={() => setSize(value)}>
              {value === "1K" ? "标准 1K" : "高清 2K"}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={generate} disabled={pending}>
            {pending ? "正在画…" : "生成图片"}
          </button>
          <span className="quiet">今日 {usage?.used ?? 0} / {usage?.limit ?? 0}</span>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
      <div className="stage">
        {current?.url ? <img src={current.url} alt={current.prompt} /> : <div className="empty">生成结果会停在这里。</div>}
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
