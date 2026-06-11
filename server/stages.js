/* ============================================================
   8개 처리 단계 구현 (PRD §4-2, §4-4)
   각 단계는 (ctx, setPct) 를 받아 실행. ctx.shared 로 단계 간 데이터 공유.
   ============================================================ */
import fs from "fs";
import path from "path";
import { db } from "./db.js";
import * as ff from "./ffmpeg.js";
import { visionJSON, textJSON, embed } from "./openai.js";
import { localTranscribe } from "./whisper.js";
import { ROOT } from "./db.js";

const CATEGORIES = ["성표현", "폭력", "충격혐오", "유해행위", "인격권", "차별증오", "아동청소년", "광고저작권"];

function loadRules() {
  try {
    return fs.readFileSync(path.join(ROOT, "rules", "금칙기준.md"), "utf8");
  } catch {
    return "(rules/금칙기준.md 파일을 찾을 수 없음 — 방송심의 규정 일반 원칙으로 판정)";
  }
}

/* ============ 1. 자막 추출 (내장 자막 → 없으면 음성 인식) ============ */
export async function stageSubtitle(ctx, setPct) {
  const { videoId, filePath, meta } = ctx;
  let lines = [];
  let source = "—";

  if (meta.hasSubtitleTrack) {
    setPct(20);
    lines = await ff.extractSubtitles(filePath, ctx.framesDir);
    source = "원본 자막 추출";
  } else if (meta.hasAudio) {
    setPct(10);
    const audioPath = path.join(ctx.framesDir, "audio.mp3");
    await ff.extractAudio(filePath, audioPath);
    setPct(30);
    lines = await localTranscribe(audioPath); // 로컬 python whisper
    fs.rmSync(audioPath, { force: true });
    source = "음성 인식 생성 (whisper)";
  } else {
    throw new Error("자막 트랙과 오디오가 모두 없어 자막을 만들 수 없습니다");
  }

  const ins = db.prepare("INSERT INTO subtitles (video_id, t, text) VALUES (?,?,?)");
  const tx = db.transaction(() => lines.forEach((l) => ins.run(videoId, l.t, l.text)));
  tx();
  db.prepare("UPDATE videos SET subtitle_source=? WHERE id=?").run(source, videoId);
  ctx.shared.subtitles = lines;
  setPct(100);
}

/* ============ 2. 자막 교정 (원본 → 교정, 바뀐 문장만 기록) ============ */
export async function stageCorrect(ctx, setPct) {
  const { videoId } = ctx;
  const rows = db.prepare("SELECT id, t, text FROM subtitles WHERE video_id=? ORDER BY t").all(videoId);
  if (rows.length === 0) { setPct(100); return; }

  setPct(15);
  const numbered = rows.map((r, i) => `${i}\t${r.text}`).join("\n");
  const result = await textJSON({
    system:
      "당신은 한국어 방송 자막 교정 전문가다. 음성 인식 오류, 오탈자, 잘못 들린 단어, 중복된 어절만 고친다. " +
      "의미·말투·문체는 절대 바꾸지 않는다. 실제로 수정이 필요한 줄만 corrections 에 포함하라.",
    text: `다음 자막에서 오류가 있는 줄만 교정하라. 각 줄은 "번호<TAB>내용" 형식이다.\n\n${numbered}`,
    schemaName: "subtitle_corrections",
    schema: {
      type: "object",
      properties: {
        corrections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              index: { type: "integer", description: "줄 번호" },
              corrected: { type: "string", description: "교정된 문장" },
            },
            required: ["index", "corrected"],
            additionalProperties: false,
          },
        },
      },
      required: ["corrections"],
      additionalProperties: false,
    },
    effort: "low",
    maxTokens: 8192,
  });

  setPct(80);
  const upd = db.prepare("UPDATE subtitles SET text=?, corrected_from=? WHERE id=?");
  const tx = db.transaction(() => {
    for (const c of result.corrections || []) {
      const row = rows[c.index];
      if (!row || !c.corrected || c.corrected === row.text) continue;
      upd.run(c.corrected, row.text, row.id);
    }
  });
  tx();
  setPct(100);
}

/* ============ 3. 장면 분석 (구간별 대표화면 + 설명) ============ */
export async function stageScene(ctx, setPct) {
  const { videoId, filePath, framesDir, meta } = ctx;
  const dur = meta.duration;
  const n = Math.max(4, Math.min(8, Math.round(dur / 90) || 4));
  const times = Array.from({ length: n }, (_, i) => Math.max(0.5, dur * (i + 0.5) / n));

  const imagePaths = [];
  for (let i = 0; i < times.length; i++) {
    const p = path.join(framesDir, `scene_${i + 1}.jpg`);
    await ff.thumbnail(filePath, p, times[i]);
    imagePaths.push(p);
    setPct(Math.round(((i + 1) / times.length) * 50));
  }

  const result = await visionJSON({
    system: "당신은 영상 아카이브용 장면 설명을 작성한다. 각 화면의 내용을 검색에 유용하도록 구체적인 한국어 한두 문장으로 설명하라 (장소, 인물 수, 행동, 분위기 포함).",
    text: `다음 ${imagePaths.length}개 화면을 순서대로 각각 설명하라. descriptions 배열의 길이는 정확히 ${imagePaths.length}이어야 한다.`,
    imagePaths,
    schemaName: "scene_descriptions",
    schema: {
      type: "object",
      properties: {
        descriptions: { type: "array", items: { type: "string" } },
      },
      required: ["descriptions"],
      additionalProperties: false,
    },
    effort: "low",
    maxTokens: 4096,
  });

  const ins = db.prepare("INSERT INTO scenes (video_id, t, image, description) VALUES (?,?,?,?)");
  const tx = db.transaction(() => {
    times.forEach((t, i) => ins.run(videoId, t, `scene_${i + 1}.jpg`, result.descriptions?.[i] || ""));
  });
  tx();
  setPct(100);
}

/* ============ 4. 기술 검토 (무음/블랙/프리즈/클리핑) ============ */
export async function stageTech(ctx, setPct) {
  const { videoId, filePath, meta } = ctx;
  const findings = await ff.detectTech(filePath, { hasAudio: meta.hasAudio });
  setPct(60);
  const clip = meta.hasAudio ? await ff.detectClipping(filePath) : [];
  const all = [...findings, ...clip];
  const ins = db.prepare("INSERT INTO tech_findings (video_id, type, t_start, t_end, note) VALUES (?,?,?,?,?)");
  const tx = db.transaction(() => all.forEach((f) => ins.run(videoId, f.type, f.t_start, f.t_end, f.note)));
  tx();
  setPct(100);
}

/* ============ 5. 프레임 샘플링 (약 1초 간격) ============ */
export async function stageSample(ctx, setPct) {
  const { filePath, framesDir, meta } = ctx;
  setPct(5);
  const count = await ff.sampleFrames(filePath, framesDir, { width: 640 });
  setPct(90);
  await ff.thumbnail(filePath, path.join(framesDir, "thumb.jpg"), meta.duration * 0.25);
  ctx.shared.frameCount = count;
  setPct(100);
}

/* ============ 6. 프레임 금칙 판정 (연속 3장 묶음 + 대사 근거) ============ */
const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    violation: { type: "boolean", description: "금칙 위반 또는 주의가 필요한가" },
    category: { type: "string", enum: [...CATEGORIES, "없음"] },
    severity: { type: "integer", description: "0(통과)~5(방영불가). 기준 문서의 등급을 따른다" },
    needs_review: { type: "boolean", description: "경계 사례로 사람의 확인이 필요한가" },
    reason: { type: "string", description: "판정 이유 한두 문장 (한국어)" },
    audio_evidence: { type: "string", description: "대사·소리 근거. 없으면 '—'" },
    rule: { type: "string", description: "근거 조문 (예: 방송심의 §35 폭력묘사 — …). 위반 아니면 '—'" },
  },
  required: ["violation", "category", "severity", "needs_review", "reason", "audio_evidence", "rule"],
  additionalProperties: false,
};

export async function stageJudge(ctx, setPct) {
  const { videoId, framesDir } = ctx;
  const frameCount = ctx.shared.frameCount ?? 0;
  if (frameCount === 0) throw new Error("샘플링된 프레임이 없습니다");

  const rules = loadRules();
  const subtitles = db.prepare("SELECT t, text FROM subtitles WHERE video_id=? ORDER BY t").all(videoId);

  // 1초 간격 프레임을 연속 3장 묶음으로 (stride 3)
  const windows = [];
  for (let s = 1; s <= frameCount; s += 3) {
    const idxs = [s, s + 1, s + 2].filter((i) => i <= frameCount);
    if (idxs.length) windows.push(idxs);
  }

  let done = 0;
  let failedFrames = 0;
  const insViolation = db.prepare(
    "INSERT INTO violations (video_id, t, cat, sev, status, reason, dialogue, audio, rule, frame_times) VALUES (?,?,?,?,?,?,?,?,?,?)"
  );

  const judgeWindow = async (idxs) => {
    const t0 = idxs[0] - 1, t2 = idxs[idxs.length - 1] - 1;
    const dialogue = subtitles
      .filter((s) => s.t >= t0 - 2 && s.t <= t2 + 2)
      .map((s) => s.text).join(" / ") || "—";
    const imagePaths = idxs.map((i) => path.join(framesDir, `s${String(i).padStart(6, "0")}.jpg`));

    try {
      const r = await visionJSON({
        system:
          `당신은 방송 영상 금칙 검수 심의관이다. 아래 기준 문서에 따라 판정하라.\n\n${rules}\n\n` +
          "연속된 화면들을 '동작의 흐름'으로 함께 판단하고, 제공된 대사도 판단 근거로 사용하라. " +
          "모호하거나 경계에 있으면 needs_review=true 로 분류하라. 문제가 전혀 없으면 violation=false, severity=0.",
        text: `연속 ${imagePaths.length}장의 화면 (영상 ${t0}~${t2 + 1}초 구간, 약 1초 간격).\n해당 구간 대사: "${dialogue}"`,
        imagePaths,
        schemaName: "frame_judgement",
        schema: JUDGE_SCHEMA,
        effort: "low",
        maxTokens: 2048,
      });

      if (r.violation && r.severity >= 1 && r.category !== "없음") {
        const sev = Math.max(1, Math.min(5, r.severity));
        const status = r.needs_review || sev === 3 ? "review" : "block";
        const midT = t0 + (t2 - t0) / 2;
        insViolation.run(
          videoId, midT, r.category, sev, status, r.reason,
          dialogue === "—" ? "—" : dialogue,
          r.audio_evidence || "—", r.rule || "—",
          JSON.stringify(idxs.map((i) => i - 1))
        );
      }
    } catch (e) {
      // PRD: 프레임 처리 실패 시 해당 프레임은 '정상' 처리 후 계속 진행
      failedFrames++;
      console.error(`[judge] window ${t0}-${t2} 실패 (정상 처리 후 계속):`, e.message);
    } finally {
      done++;
      setPct(Math.round((done / windows.length) * 100));
    }
  };

  // 동시 4개 윈도우씩 처리 (openai.js 세마포어와 동일 폭)
  const workers = [];
  let next = 0;
  for (let w = 0; w < 4; w++) {
    workers.push((async () => {
      while (next < windows.length) {
        const idx = next++;
        await judgeWindow(windows[idx]);
      }
    })());
  }
  await Promise.all(workers);
  ctx.shared.judgeFailedFrames = failedFrames;
  setPct(100);
}

/* ============ 7. 색인 생성 (키워드 FTS + 벡터 임베딩) ============ */
export async function stageIndex(ctx, setPct) {
  const { videoId } = ctx;
  const subs = db.prepare("SELECT t, text FROM subtitles WHERE video_id=? ORDER BY t").all(videoId);
  const scenes = db.prepare("SELECT t, description FROM scenes WHERE video_id=? ORDER BY t").all(videoId);

  const docs = [
    ...subs.map((s) => ({ t: s.t, kind: "subtitle", content: s.text })),
    ...scenes.filter((s) => s.description).map((s) => ({ t: s.t, kind: "scene", content: s.description })),
  ];
  if (docs.length === 0) { setPct(100); return; }

  // 키워드 색인 (FTS5)
  const insFts = db.prepare("INSERT INTO search_fts (content, video_id, t, kind) VALUES (?,?,?,?)");
  const tx = db.transaction(() => docs.forEach((d) => insFts.run(d.content, videoId, d.t, d.kind)));
  tx();
  setPct(40);

  // 벡터 색인 (임베딩) — 실패 시 키워드 색인은 유지된 채 단계만 실패 표시
  try {
    const insEmb = db.prepare("INSERT INTO embeddings (video_id, t, kind, content, vector) VALUES (?,?,?,?,?)");
    for (let i = 0; i < docs.length; i += 64) {
      const batch = docs.slice(i, i + 64);
      const vecs = await embed(batch.map((d) => d.content));
      const tx2 = db.transaction(() => {
        batch.forEach((d, j) => insEmb.run(videoId, d.t, d.kind, d.content, Buffer.from(vecs[j].buffer)));
      });
      tx2();
      setPct(40 + Math.round(((i + batch.length) / docs.length) * 60));
    }
  } catch (e) {
    throw new Error(`벡터 색인 실패 (키워드 색인은 완료됨): ${e.message}`);
  }
  setPct(100);
}

/* ============ 8. 종합 판정 (타임라인 + 판정 + 영속화) ============ */
export async function stageSummary(ctx, setPct) {
  const { videoId, meta } = ctx;
  const dur = meta.duration;

  const violations = db.prepare("SELECT * FROM violations WHERE video_id=? ORDER BY t").all(videoId);
  const tech = db.prepare("SELECT * FROM tech_findings WHERE video_id=? ORDER BY t_start").all(videoId);
  setPct(30);

  // ---- 타임라인 세그먼트 구성: 기본 normal 위에 기술/위반 구간 오버레이 ----
  const marks = [];
  for (const f of tech) marks.push({ start: f.t_start, end: f.t_end, type: f.type === "silent" ? "silent" : f.type, ref: null, pri: 1 });
  for (const v of violations) {
    const times = JSON.parse(v.frame_times || "[]");
    const start = times.length ? times[0] : v.t - 1;
    const end = (times.length ? times[times.length - 1] : v.t) + 1;
    marks.push({ start, end, type: v.status === "review" ? "review" : "block", ref: v.id, pri: 2 });
  }
  marks.sort((a, b) => a.start - b.start || b.pri - a.pri);

  const segs = [];
  let cursor = 0;
  for (const m of marks) {
    const s = Math.max(0, Math.min(dur, m.start));
    const e = Math.max(0, Math.min(dur, m.end));
    if (e <= cursor) continue;
    if (s > cursor) segs.push({ start: cursor, end: s, type: "normal", ref: null });
    segs.push({ start: Math.max(s, cursor), end: e, type: m.type, ref: m.ref });
    cursor = e;
  }
  if (cursor < dur) segs.push({ start: cursor, end: dur, type: "normal", ref: null });

  const insSeg = db.prepare('INSERT INTO segments (video_id, start, "end", type, ref) VALUES (?,?,?,?,?)');
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM segments WHERE video_id=?").run(videoId);
    segs.forEach((s) => insSeg.run(videoId, s.start, s.end, s.type, s.ref));
  });
  tx();
  setPct(70);

  // ---- 종합 판정 ----
  const maxSev = violations.reduce((a, v) => Math.max(a, v.sev), 0);
  const reviewCount = violations.filter((v) => v.status === "review").length;
  const blockCount = violations.filter((v) => v.status === "block").length;
  const verdict = maxSev >= 4 ? "block" : (maxSev >= 3 || reviewCount > 0) ? "review" : "pass";

  db.prepare(
    "UPDATE videos SET verdict=?, max_sev=?, block_count=?, review_count=? WHERE id=?"
  ).run(verdict, maxSev, blockCount, reviewCount, videoId);

  ctx.shared.summary = { verdict, maxSev, blockCount, reviewCount };
  setPct(100);
}
