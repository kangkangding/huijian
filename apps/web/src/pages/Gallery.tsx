import { useEffect, useState } from "react";
import { api, type ImageItem, type VideoItem } from "../api";
import { DownloadButton } from "../components/DownloadButton";
import { NeedLogin } from "../auth";
import { useI18n } from "../i18n";

export function Gallery() {
  return <NeedLogin><GalleryBody /></NeedLogin>;
}

function GalleryBody() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const { t, tr } = useI18n();
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
      <p className="eyebrow">{t("galleryEyebrow")}</p>
      <h1>{t("galleryTitle")}</h1>
      {error && <p className="error">{tr(error)}</p>}
      <div className="gallery">
        {pictures.map((item) => (
          <figure key={item.id}>
            <img src={item.url ?? ""} alt={item.prompt} />
            <figcaption>{item.prompt}</figcaption>
            <DownloadButton path={`/api/images/${item.id}/file`} name="huijian-image" at={item.created_at} />
          </figure>
        ))}
        {clips.map((item) => (
          <figure key={item.id}>
            <video src={item.url ?? ""} controls />
            <figcaption>{item.prompt}</figcaption>
            <DownloadButton path={`/api/videos/${item.id}/file`} name="huijian-video" at={item.created_at} />
          </figure>
        ))}
      </div>
      {pictures.length === 0 && clips.length === 0 && !error && <p className="quiet">{t("galleryEmpty")}</p>}
    </section>
  );
}
