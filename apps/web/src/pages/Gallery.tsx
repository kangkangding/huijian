import { useEffect, useState } from "react";
import { api, type ImageItem, type VideoItem } from "../api";
import { NeedLogin } from "../auth";

export function Gallery() {
  return <NeedLogin><GalleryBody /></NeedLogin>;
}

function GalleryBody() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<{ images: ImageItem[] }>("/api/images"), api<{ videos: VideoItem[] }>("/api/videos")])
      .then(([imageData, videoData]) => {
        setImages(imageData.images);
        setVideos(videoData.videos);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "读取失败"));
  }, []);

  const pictures = images.filter((item) => item.url);
  const clips = videos.filter((item) => item.url);

  return (
    <section>
      <p className="eyebrow">作品</p>
      <h1>你生成过的图和视频。</h1>
      {error && <p className="error">{error}</p>}
      <div className="gallery">
        {pictures.map((item) => (
          <figure key={item.id}>
            <img src={item.url ?? ""} alt={item.prompt} />
            <figcaption>{item.prompt}</figcaption>
          </figure>
        ))}
        {clips.map((item) => (
          <figure key={item.id}>
            <video src={item.url ?? ""} controls />
            <figcaption>{item.prompt}</figcaption>
          </figure>
        ))}
      </div>
      {pictures.length === 0 && clips.length === 0 && !error && <p className="quiet">还没有完成的作品。去文生图写第一句。</p>}
    </section>
  );
}
