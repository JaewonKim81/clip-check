/* ============================================================
   화면 공통 메타 — 카테고리 색상, 단계 정의, 타임코드/용량 포맷
   ============================================================ */

export const CATEGORIES = {
  성표현:   { hue: 320 },
  폭력:     { hue: 12 },
  충격혐오: { hue: 285 },
  유해행위: { hue: 45 },
  인격권:   { hue: 200 },
  차별증오: { hue: 260 },
  아동청소년: { hue: 160 },
  광고저작권: { hue: 90 },
};

export const STAGE_DEFS = [
  { id: "subtitle", name: "자막 추출" },
  { id: "correct",  name: "자막 교정" },
  { id: "scene",    name: "장면 분석" },
  { id: "tech",     name: "기술 검토" },
  { id: "sample",   name: "프레임 샘플링" },
  { id: "judge",    name: "프레임 금칙 판정" },
  { id: "index",    name: "색인 생성" },
  { id: "summary",  name: "종합 판정" },
];

export function tc(sec) {
  const s = Math.max(0, sec || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const f = Math.floor((s % 1) * 24);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(ss)}:${p(f)}`;
}

export function fmtSize(bytes) {
  if (bytes == null) return "—";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
