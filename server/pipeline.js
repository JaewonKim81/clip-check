/* ============================================================
   처리 파이프라인 — 영상 내 병렬 DAG (PRD §5)
   한 단계 실패가 다른 병렬 단계를 중단시키지 않는다.
   영상 간 병렬: 업로드마다 독립 실행.
   ============================================================ */
import path from "path";
import { db, FRAMES_DIR } from "./db.js";
import { probe } from "./ffmpeg.js";
import * as S from "./stages.js";
import { notifyDone } from "./telegram.js";

export const STAGE_DEFS = [
  { id: "subtitle", name: "자막 추출",        run: S.stageSubtitle, deps: [],                    hard: [] },
  { id: "correct",  name: "자막 교정",        run: S.stageCorrect,  deps: ["subtitle"],          hard: ["subtitle"] },
  { id: "scene",    name: "장면 분석",        run: S.stageScene,    deps: [],                    hard: [] },
  { id: "tech",     name: "기술 검토",        run: S.stageTech,     deps: [],                    hard: [] },
  { id: "sample",   name: "프레임 샘플링",    run: S.stageSample,   deps: [],                    hard: [] },
  { id: "judge",    name: "프레임 금칙 판정", run: S.stageJudge,    deps: ["sample", "subtitle"], hard: ["sample"] },
  { id: "index",    name: "색인 생성",        run: S.stageIndex,    deps: ["scene", "correct"],  hard: [] },
  { id: "summary",  name: "종합 판정",        run: S.stageSummary,  deps: ["judge", "tech"],     hard: ["judge"] },
];

// 진행 중 파이프라인의 실시간 상태 (API 폴링용)
const live = new Map(); // videoId -> { stages: {id: {pct, status, error}} }

export function liveStages(videoId) {
  return live.get(videoId)?.stages || null;
}

export async function runPipeline(videoId) {
  const video = db.prepare("SELECT * FROM videos WHERE id=?").get(videoId);
  if (!video) return;

  const framesDir = path.join(FRAMES_DIR, videoId);
  const stages = {};
  for (const d of STAGE_DEFS) stages[d.id] = { pct: 0, status: "pending", error: null };
  live.set(videoId, { stages });

  let persistTimer = null;
  const persist = () => {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      db.prepare("UPDATE videos SET stages_json=? WHERE id=?").run(JSON.stringify(stages), videoId);
    }, 250);
  };
  const setPct = (id) => (pct) => {
    stages[id].pct = Math.min(100, Math.max(stages[id].pct, Math.round(pct)));
    persist();
  };

  let meta;
  try {
    meta = await probe(video.file_path);
    db.prepare("UPDATE videos SET duration=? WHERE id=?").run(meta.duration, videoId);
  } catch (e) {
    db.prepare("UPDATE videos SET status='failed', fail_note=? WHERE id=?")
      .run(`영상 분석 불가: ${e.message}`, videoId);
    live.delete(videoId);
    return;
  }

  const ctx = { videoId, filePath: video.file_path, framesDir, meta, shared: {} };

  // DAG 실행: 각 단계는 deps 의 promise 가 settle 된 뒤 시작
  const promises = {};
  for (const def of STAGE_DEFS) {
    promises[def.id] = (async () => {
      await Promise.allSettled(def.deps.map((d) => promises[d]));

      // 필수 선행 단계가 실패한 경우 이 단계도 실패 처리
      const failedHard = def.hard.find((d) => stages[d].status === "failed");
      if (failedHard) {
        const hardName = STAGE_DEFS.find((x) => x.id === failedHard)?.name || failedHard;
        stages[def.id] = { pct: 0, status: "failed", error: `선행 단계 '${hardName}' 실패로 실행 불가` };
        persist();
        throw new Error(stages[def.id].error);
      }

      stages[def.id].status = "running";
      persist();
      try {
        await def.run(ctx, setPct(def.id));
        stages[def.id].status = "done";
        stages[def.id].pct = 100;
      } catch (e) {
        stages[def.id].status = "failed";
        stages[def.id].error = e.message;
        console.error(`[pipeline:${videoId}] ${def.id} 실패:`, e.message);
        persist();
        throw e;
      }
      persist();
    })();
    promises[def.id].catch(() => {}); // unhandled rejection 방지 — 상태로 추적
  }

  await Promise.allSettled(Object.values(promises));

  // ---- 최종 상태 결정: 종합 판정 성공 = done, 실패 단계는 기록 ----
  const failed = STAGE_DEFS.filter((d) => stages[d.id].status === "failed");
  const summaryOk = stages.summary.status === "done";
  const status = summaryOk ? "done" : "failed";
  const failNote = failed.length
    ? failed.map((d) => `${d.name}: ${stages[d.id].error}`).join(" · ")
    : null;

  db.prepare("UPDATE videos SET status=?, stages_json=?, failed_stage=?, fail_note=? WHERE id=?")
    .run(status, JSON.stringify(stages), failed[0]?.id || null, failNote, videoId);

  // ---- 텔레그램 알림 (PRD §4-5) ----
  if (summaryOk) {
    const v = db.prepare("SELECT * FROM videos WHERE id=?").get(videoId);
    const ok = await notifyDone(v);
    if (ok) db.prepare("UPDATE videos SET notified=1 WHERE id=?").run(videoId);
  }

  live.delete(videoId);
}
