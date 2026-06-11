/* ============================================================
   ClipCheck API 클라이언트
   ============================================================ */

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `요청 실패 (${res.status})`);
  return body;
}

export const listVideos = () => api("/api/videos").then((r) => r.videos);
export const getVideo = (id) => api(`/api/videos/${id}`).then((r) => r.video);
export const getReport = (id) => api(`/api/videos/${id}/report`);
export const deleteVideo = (id) => api(`/api/videos/${id}`, { method: "DELETE" });

export function searchApi({ q, mode, category, verdict }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (mode) params.set("mode", mode);
  if (category) params.set("category", category);
  if (verdict) params.set("verdict", verdict);
  return api(`/api/search?${params}`).then((r) => r.results);
}

/* XHR 업로드 — 진행률 콜백 지원 */
export function uploadFiles(files, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(body.videos);
        else reject(new Error(body.error || `업로드 실패 (${xhr.status})`));
      } catch {
        reject(new Error(`업로드 실패 (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("네트워크 오류로 업로드에 실패했습니다"));
    xhr.send(form);
  });
}
