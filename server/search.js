/* ============================================================
   검색 — 4종 모드 (PRD §4-3)
   hybrid: 키워드 + 의미 점수 합산 / keyword: FTS5 / vector: 임베딩 /
   filter: 조건. 각 결과에 장면 썸네일 + 출처 + 이유 포함.
   ============================================================ */
import fs from "fs";
import path from "path";
import { db, FRAMES_DIR } from "./db.js";
import { embed, cosine } from "./openai.js";

function ftsQuery(q) {
  // FTS5 구문 오류 방지: 각 토큰을 따옴표로 감싼다
  return q.trim().split(/\s+/).map((t) => `"${t.replace(/"/g, "")}"`).join(" ");
}

function frameUrl(videoId, t) {
  const idx = Math.max(1, Math.floor(t) + 1);
  const name = `s${String(idx).padStart(6, "0")}.jpg`;
  if (fs.existsSync(path.join(FRAMES_DIR, videoId, name))) return `/files/frames/${videoId}/${name}`;
  if (fs.existsSync(path.join(FRAMES_DIR, videoId, "thumb.jpg"))) return `/files/frames/${videoId}/thumb.jpg`;
  return null;
}

function keywordHits(q, limit = 30) {
  try {
    return db.prepare(`
      SELECT content, video_id, t, kind, bm25(search_fts) AS rank
      FROM search_fts WHERE search_fts MATCH ? ORDER BY rank LIMIT ?
    `).all(ftsQuery(q), limit).map((r) => ({
      ...r, t: Number(r.t),
      score: 1 / (1 + Math.max(0, r.rank)), // bm25는 낮을수록 좋음 → 0~1 정규화
    }));
  } catch {
    return [];
  }
}

async function vectorHits(q, limit = 30) {
  const rows = db.prepare("SELECT video_id, t, kind, content, vector FROM embeddings").all();
  if (rows.length === 0) return [];
  const [qv] = await embed([q]);
  return rows
    .map((r) => ({
      content: r.content, video_id: r.video_id, t: Number(r.t), kind: r.kind,
      score: cosine(qv, new Float32Array(r.vector.buffer, r.vector.byteOffset, r.vector.byteLength / 4)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .filter((r) => r.score > 0.2);
}

function toResult(hit, q, { source, kwScore, vecScore }) {
  const video = db.prepare("SELECT id, name FROM videos WHERE id=?").get(hit.video_id);
  if (!video) return null;
  const kindLabel = hit.kind === "subtitle" ? "자막" : "장면 설명";
  let reason;
  if (source === "both") reason = `키워드 "${q}" 일치 + ${kindLabel} 벡터 유사도 ${vecScore.toFixed(2)} (both)`;
  else if (source === "keyword") reason = `${kindLabel}에서 키워드 "${q}" 일치`;
  else reason = `"${q}"와 의미가 유사한 ${kindLabel}에서 벡터 매칭 (유사도 ${vecScore.toFixed(2)})`;
  return {
    videoId: video.id,
    videoName: video.name,
    t: hit.t,
    thumb: frameUrl(video.id, hit.t),
    source,
    score: source === "both" ? (kwScore + vecScore) / 2 + 0.15 : source === "keyword" ? kwScore : vecScore,
    snippet: hit.content,
    reason,
  };
}

export async function search({ q = "", mode = "hybrid", category, verdict, limit = 20 }) {
  let results = [];

  if (mode === "filter") {
    let sql = "SELECT * FROM videos WHERE status='done'";
    const params = [];
    if (category && category !== "전체") { sql += " AND category=?"; params.push(category); }
    if (verdict && verdict !== "전체") { sql += " AND verdict=?"; params.push(verdict); }
    const vids = db.prepare(sql + " ORDER BY uploaded_at DESC").all(...params);
    results = vids.map((v) => ({
      videoId: v.id, videoName: v.name, t: 0,
      thumb: frameUrl(v.id, v.duration * 0.25),
      source: "keyword", score: 1,
      snippet: `${v.category} · 판정 ${v.verdict || "—"} · 위반 ${v.block_count} · 검토 ${v.review_count}`,
      reason: "필터 조건 일치",
    }));
    if (q.trim()) {
      const ids = new Set(vids.map((v) => v.id));
      results = keywordHits(q, 50)
        .filter((h) => ids.has(h.video_id))
        .map((h) => toResult(h, q, { source: "keyword", kwScore: h.score, vecScore: 0 }))
        .filter(Boolean);
    }
    return results.slice(0, limit);
  }

  const wantKw = mode === "hybrid" || mode === "keyword";
  const wantVec = mode === "hybrid" || mode === "vector";

  const kw = wantKw && q.trim() ? keywordHits(q) : [];
  let vec = [];
  if (wantVec && q.trim()) {
    try { vec = await vectorHits(q); }
    catch (e) {
      if (mode === "vector") throw new Error(`벡터 검색 실패: ${e.message}`);
      // hybrid 는 키워드 결과만으로 계속
    }
  }

  const key = (h) => `${h.video_id}|${Math.round(h.t)}|${h.kind}`;
  const merged = new Map();
  for (const h of kw) merged.set(key(h), { hit: h, kwScore: h.score, vecScore: 0, source: "keyword" });
  for (const h of vec) {
    const k = key(h);
    if (merged.has(k)) {
      const m = merged.get(k);
      m.vecScore = h.score;
      m.source = "both";
    } else {
      merged.set(k, { hit: h, kwScore: 0, vecScore: h.score, source: "vector" });
    }
  }

  results = [...merged.values()]
    .map((m) => toResult(m.hit, q, m))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}
