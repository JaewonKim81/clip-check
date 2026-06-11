/* ============================================================
   ffmpeg/ffprobe 래퍼 — 메타데이터, 1초 간격 프레임 샘플링,
   기술 검토(무음/블랙/프리즈/클리핑), 자막 추출, 오디오 추출
   ============================================================ */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

function run(cmd, args, { collectStderr = true } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => { if (collectStderr) err += d; });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve({ out, err });
      else reject(new Error(`${cmd} exited ${code}: ${err.slice(-800)}`));
    });
  });
}

export async function probe(filePath) {
  const { out } = await run("ffprobe", [
    "-v", "error", "-print_format", "json",
    "-show_format", "-show_streams", filePath,
  ]);
  const info = JSON.parse(out);
  const duration = parseFloat(info.format?.duration || "0");
  const hasSubtitleTrack = (info.streams || []).some((s) => s.codec_type === "subtitle");
  const hasAudio = (info.streams || []).some((s) => s.codec_type === "audio");
  return { duration, hasSubtitleTrack, hasAudio, format: info.format };
}

/* ---- 1초 간격 프레임 샘플링: out/s000001.jpg (n번째 ≈ t = n-1초) ---- */
export async function sampleFrames(filePath, outDir, { width = 640 } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  await run("ffmpeg", [
    "-y", "-i", filePath,
    "-vf", `fps=1,scale=${width}:-2`,
    "-q:v", "4",
    path.join(outDir, "s%06d.jpg"),
  ]);
  return fs.readdirSync(outDir).filter((f) => /^s\d{6}\.jpg$/.test(f)).length;
}

export async function thumbnail(filePath, outPath, t) {
  await run("ffmpeg", [
    "-y", "-ss", String(Math.max(0, t)), "-i", filePath,
    "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "4", outPath,
  ]);
}

/* ---- 기술 검토: 무음 / 블랙 / 프리즈 (한 패스) ---- */
export async function detectTech(filePath, { hasAudio = true } = {}) {
  const args = ["-i", filePath, "-vf", "blackdetect=d=2:pix_th=0.02,freezedetect=n=-60dB:d=3"];
  if (hasAudio) args.push("-af", "silencedetect=noise=-50dB:d=2");
  args.push("-f", "null", "-");
  const { err } = await run("ffmpeg", args);

  const findings = [];
  // silence
  let m;
  const silRe = /silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g;
  while ((m = silRe.exec(err))) {
    const end = parseFloat(m[1]), dur = parseFloat(m[2]);
    findings.push({ type: "silent", t_start: end - dur, t_end: end, note: `${dur.toFixed(1)}s · -50dB 이하` });
  }
  // black
  const blkRe = /black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g;
  while ((m = blkRe.exec(err))) {
    findings.push({ type: "black", t_start: parseFloat(m[1]), t_end: parseFloat(m[2]), note: `${parseFloat(m[3]).toFixed(1)}s · 휘도 < 2%` });
  }
  // freeze
  const fzStarts = [...err.matchAll(/freeze_start:\s*([\d.]+)/g)].map((x) => parseFloat(x[1]));
  const fzEnds = [...err.matchAll(/freeze_end:\s*([\d.]+)/g)].map((x) => parseFloat(x[1]));
  fzStarts.forEach((s, i) => {
    const e = fzEnds[i] ?? s + 3;
    findings.push({ type: "freeze", t_start: s, t_end: e, note: `${(e - s).toFixed(1)}s · 프레임 정지` });
  });
  return findings;
}

/* ---- 오디오 클리핑: 1초 단위 피크 레벨 → 0dBFS 근접 구간 병합 ---- */
export async function detectClipping(filePath) {
  let res;
  try {
    res = await run("ffmpeg", [
      "-i", filePath, "-vn",
      "-af", "aresample=48000,asetnsamples=n=48000,astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.Peak_level:file=-",
      "-f", "null", "-",
    ]);
  } catch {
    return []; // 오디오 없음 등
  }
  const peaks = []; // [second, peakDb]
  let sec = 0;
  for (const line of res.out.split(/\r?\n/)) {
    const m = line.match(/lavfi\.astats\.Overall\.Peak_level=(-?[\d.]+|inf|-inf)/);
    if (m) { peaks.push([sec, parseFloat(m[1])]); sec++; }
  }
  // 피크가 -0.1dBFS 이상인 초를 클리핑 의심으로 보고 연속 구간 병합
  const hot = peaks.filter(([, p]) => Number.isFinite(p) && p >= -0.1).map(([s]) => s);
  const findings = [];
  let start = null, prev = null, count = 0;
  const flush = () => {
    if (start != null) findings.push({
      type: "clip", t_start: start, t_end: prev + 1,
      note: `${(prev + 1 - start).toFixed(1)}s · 0dBFS 도달 ${count}초`,
    });
  };
  for (const s of hot) {
    if (start == null) { start = s; prev = s; count = 1; }
    else if (s === prev + 1) { prev = s; count++; }
    else { flush(); start = s; prev = s; count = 1; }
  }
  flush();
  return findings;
}

/* ---- 내장 자막 추출 → [{t, text}] ---- */
export async function extractSubtitles(filePath, tmpDir) {
  fs.mkdirSync(tmpDir, { recursive: true });
  const srtPath = path.join(tmpDir, "subs.srt");
  await run("ffmpeg", ["-y", "-i", filePath, "-map", "0:s:0", srtPath]);
  const raw = fs.readFileSync(srtPath, "utf8");
  fs.rmSync(srtPath, { force: true });
  return parseSrt(raw);
}

export function parseSrt(raw) {
  const lines = [];
  const blocks = raw.replace(/\r/g, "").split(/\n\n+/);
  for (const block of blocks) {
    const m = block.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->/);
    if (!m) continue;
    const t = +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
    const text = block.split("\n").slice(2).join(" ").replace(/<[^>]+>/g, "").trim();
    if (text) lines.push({ t, text });
  }
  return lines;
}

/* ---- 음성 인식용 오디오 추출 (mono 16kHz mp3) ---- */
export async function extractAudio(filePath, outPath) {
  await run("ffmpeg", [
    "-y", "-i", filePath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", outPath,
  ]);
  return fs.statSync(outPath).size;
}
