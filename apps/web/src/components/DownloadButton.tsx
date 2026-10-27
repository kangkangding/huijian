import { useState } from "react";
import { downloadFile } from "../api";

export function DownloadButton({ path, name, at }: { path: string; name: string; at?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setPending(true);
    setError("");
    try {
      await downloadFile(path, `${name}-${fileStamp(at)}`);
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

function fileStamp(iso?: string): string {
  const parsed = iso ? new Date(iso) : new Date();
  const when = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(when);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  const hour = pick("hour") === "24" ? "00" : pick("hour");
  return `${pick("year")}${pick("month")}${pick("day")}-${hour}${pick("minute")}${pick("second")}`;
}
