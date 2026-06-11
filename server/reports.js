/* ============================================================
   리포트 출력물 (PRD §4-4) — report.json / violations.csv /
   운영절차서.md + 화면용 통합 리포트 데이터
   ============================================================ */
import fs from "fs";
import path from "path";
import { db, FRAMES_DIR } from "./db.js";

function frameUrl(videoId, sec) {
  const idx = Math.max(1, Math.floor(sec) + 1);
  const name = `s${String(idx).padStart(6, "0")}.jpg`;
  if (fs.existsSync(path.join(FRAMES_DIR, videoId, name))) return `/files/frames/${videoId}/${name}`;
  return null;
}

export function videoRow(v, liveStagesObj) {
  let stages = {};
  try { stages = JSON.parse(v.stages_json || "{}"); } catch {}
  if (liveStagesObj) stages = liveStagesObj;
  return {
    id: v.id,
    name: v.name,
    sizeBytes: v.size_bytes,
    duration: v.duration,
    uploadedAt: v.uploaded_at,
    category: v.category,
    subtitleSource: v.subtitle_source,
    status: v.status,
    verdict: v.verdict,
    maxSev: v.max_sev,
    counts: v.status === "done" ? { block: v.block_count, review: v.review_count } : null,
    notified: !!v.notified,
    hasReport: v.status === "done",
    stages,
    failedStage: v.failed_stage,
    failNote: v.fail_note,
    thumb: fs.existsSync(path.join(FRAMES_DIR, v.id, "thumb.jpg"))
      ? `/files/frames/${v.id}/thumb.jpg` : null,
  };
}

export function buildReport(videoId) {
  const v = db.prepare("SELECT * FROM videos WHERE id=?").get(videoId);
  if (!v) return null;

  const violations = db.prepare("SELECT * FROM violations WHERE video_id=? ORDER BY t").all(videoId)
    .map((x) => ({
      id: x.id, t: x.t, cat: x.cat, sev: x.sev, status: x.status,
      reason: x.reason,
      basis: { dialogue: x.dialogue || "—", audio: x.audio || "—", rule: x.rule || "—" },
      frames: JSON.parse(x.frame_times || "[]").map((sec) => ({ t: sec, url: frameUrl(videoId, sec) })),
      thumb: frameUrl(videoId, x.t),
    }));

  const segments = db.prepare('SELECT start, "end", type, ref FROM segments WHERE video_id=? ORDER BY start').all(videoId)
    .map((s) => ({ start: s.start, end: s.end, type: s.type, ref: s.ref }));

  const tech = db.prepare("SELECT type, t_start, t_end, note FROM tech_findings WHERE video_id=? ORDER BY t_start").all(videoId);

  const scenes = db.prepare("SELECT t, image, description FROM scenes WHERE video_id=? ORDER BY t").all(videoId)
    .map((s) => ({
      t: s.t, desc: s.description,
      url: s.image && fs.existsSync(path.join(FRAMES_DIR, videoId, s.image))
        ? `/files/frames/${videoId}/${s.image}` : frameUrl(videoId, s.t),
    }));

  const subtitles = db.prepare("SELECT t, text, corrected_from FROM subtitles WHERE video_id=? ORDER BY t").all(videoId)
    .map((s) => ({ t: s.t, text: s.text, corrected: s.corrected_from ? { from: s.corrected_from, to: s.text } : null }));

  return {
    video: videoRow(v),
    violations,
    segments,
    tech,
    scenes,
    subtitles,
  };
}

export function reportJson(videoId) {
  const r = buildReport(videoId);
  if (!r) return null;
  return {
    generated_at: new Date().toISOString(),
    video: {
      id: r.video.id, name: r.video.name, duration: r.video.duration,
      uploaded_at: r.video.uploadedAt, subtitle_source: r.video.subtitleSource,
    },
    summary: {
      verdict: r.video.verdict, max_severity: r.video.maxSev,
      violation_count: r.video.counts?.block ?? 0, review_count: r.video.counts?.review ?? 0,
    },
    frames: r.violations.map((x) => ({
      t: x.t, category: x.cat, severity: x.sev, status: x.status,
      reason: x.reason, basis: x.basis, frame_times: x.frames.map((f) => f.t),
    })),
    timeline_segments: r.segments,
    technical_findings: r.tech,
    scene_analysis: r.scenes.map((s) => ({ t: s.t, description: s.desc })),
    subtitle_corrections: r.subtitles.filter((s) => s.corrected)
      .map((s) => ({ t: s.t, from: s.corrected.from, to: s.corrected.to })),
  };
}

export function violationsCsv(videoId) {
  const rows = db.prepare("SELECT * FROM violations WHERE video_id=? ORDER BY t").all(videoId);
  const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const header = "time_sec,category,severity,status,reason,rule,dialogue";
  const lines = rows.map((r) =>
    [r.t.toFixed(1), esc(r.cat), r.sev, esc(r.status), esc(r.reason), esc(r.rule), esc(r.dialogue)].join(",")
  );
  return "﻿" + [header, ...lines].join("\n"); // BOM — 엑셀 한글 호환
}

export function opsDoc() {
  return `# ClipCheck 운영절차서

## 1. 시스템 개요

영상을 업로드하면 자동으로 분석·저장하고, 자연어로 검색하며, 방영 전 금칙 검수까지 처리한다.

## 2. 검수 흐름

\`\`\`
영상 업로드
  ↓ (영상 간 병렬 — 여러 영상 동시 처리)
자동 분석 (영상 내 병렬)
  ├─ 자막 추출(내장 자막 → 없으면 음성 인식) → 자막 교정
  ├─ 장면 분석 / 기술 검토(무음·블랙·프리즈·클리핑)  → 색인 생성
  └─ 프레임 샘플링(약 1초 간격) → 프레임 금칙 판정 → 종합 판정
  ↓
텔레그램 알림 → 검색 또는 검수 리포트 확인
\`\`\`

한 단계가 실패해도 나머지 단계는 계속 진행된다. 프레임 판정 실패 시 해당 프레임은 '정상' 처리 후 계속한다.

## 3. 금칙 판정 방식

- 화면을 **약 1초 간격**으로 촘촘하게 샘플링한다 — 1~2초짜리 짧은 장면도 놓치지 않는다.
- **연속 2~3장을 묶어서** 판단한다 — 정지 화면 한 장으로 알기 어려운 "동작의 흐름"(때리기·밀치기 등)을 판단한다.
- 해당 구간의 **대사·소리도 판단 근거**로 함께 사용한다.

## 4. 판정 기준

- 기준은 \`rules/금칙기준.md\` 파일로 관리한다. **이 파일만 수정하면 다음 영상부터 즉시 반영**된다 (코드 수정·재배포 불필요).
- 카테고리 8종 (방송심의에 관한 규정 기준): 성표현 · 폭력 · 충격혐오 · 유해행위 · 인격권 · 차별증오 · 아동청소년 · 광고저작권
- 심각도: 0 통과 / 1–2 주의 / 3 경고(검토 필요) / 4–5 방영 불가
- 모호하거나 경계 사례는 자동 통과 없이 **검토필요**로 분류 → 사람이 최종 확인한다.

## 5. 출력물

| 파일 | 내용 |
|------|------|
| report.json | 프레임별 + 종합 판정 결과 |
| violations.csv | 위반 목록 (엑셀 호환) |
| 위반 프레임 미리보기 | 리포트 화면에서 직접 확인 |

## 6. 운영 수칙

1. "검토 필요" 판정 영상은 반드시 사람이 리포트의 연속 프레임·판정 근거를 확인한 뒤 방영 여부를 결정한다.
2. 판정 기준이 느슨하거나 엄격하다고 판단되면 \`rules/금칙기준.md\` 를 수정한다.
3. 처리 중인 영상은 삭제할 수 없다. 삭제 시 원본·리포트·색인·프레임 이미지가 모두 함께 삭제되며 되돌릴 수 없다.
4. API 키·토큰은 \`.env\` 파일로만 관리한다. 코드에 직접 포함하지 않는다.
`;
}
