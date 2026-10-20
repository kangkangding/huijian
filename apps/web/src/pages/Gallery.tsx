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

  return (
    <section>
      <p className="eyebrow">作品</p>
      <h1>你生成过的图和视频。</h1>
      {error && <p className="error">{error}</p>}
      <div className="gallery">
        {images.filter((item) => item.url).map((item) => (
          <figure key={item.id}>
            <img src={item.url ?? ""} alt={item.prompt} />
            <figcaption>{item.prompt}</figcaption>
          </figure>
        ))}
        {videos.filter((item) => item.url).map((item) => (
          <figure key={item.id}>
            <video src={item.url ?? ""} controls />
            <figcaption>{item.prompt}</figcaption>
          </figure>
        ))}
      </div>
      {images.length === 0 && videos.length === 0 && !error && <p className="quiet">还没有作品。去文生图写第一句。</p>}
    </section>
  );
}
