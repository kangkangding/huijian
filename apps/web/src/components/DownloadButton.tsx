import { useState } from "react";
import { downloadFile } from "../api";

export function DownloadButton({ path, name }: { path: string; name: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setPending(true);
    setError("");
    try {
      await downloadFile(path, name);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "下载失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="download">
      <button type="button" className="text-btn" onClick={save} disabled={pending}>{pending ? "正在下载…" : "下载"}</button>
      {error && <span className="error">{error}</span>}
    </span>
  );
}
