/* ============================================================
   ClipCheck API 서버 — 업로드, 진행 상황, 리포트, 검색, 삭제
   ============================================================ */
import "dotenv/config";
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db, UPLOAD_DIR, FRAMES_DIR, ROOT, deleteVideoCascade } from "./db.js";
import { runPipeline, liveStages } from "./pipeline.js";
import { videoRow, buildReport, reportJson, violationsCsv, opsDoc } from "./reports.js";
import { search } from "./search.js";

const app = express();
app.use(express.json());

/* ---------------- 업로드 (PRD §4-1: 1개 이상 누적 가능) ---------------- */
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const id = crypto.randomUUID().slice(0, 8);
    req._videoId = `v_${id}`;
    cb(null, `${req._videoId}${path.extname(file.originalname) || ".mp4"}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 * 1024 } });

// 로컬(시스템) 시간대 기준 "YYYY-MM-DD HH:MM" — toISOString() 은 UTC 라서 사용하지 않음
function nowLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

app.post("/api/upload", upload.array("files", 10), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: "업로드된 파일이 없습니다" });
  const created = [];
  for (const file of req.files) {
    // multer 는 한글 파일명을 latin1 로 디코딩함 → utf8 복원
    const name = Buffer.from(file.originalname, "latin1").toString("utf8");
    const id = path.basename(file.filename, path.extname(file.filename));
    db.prepare(`
      INSERT INTO videos (id, name, size_bytes, uploaded_at, status, file_path)
      VALUES (?,?,?,?, 'processing', ?)
    `).run(id, name, file.size, nowLocal(), file.path);
    runPipeline(id).catch((e) => console.error(`[pipeline:${id}]`, e));
    created.push(id);
  }
  const videos = created.map((id) =>
    videoRow(db.prepare("SELECT * FROM videos WHERE id=?").get(id), liveStages(id))
  );
  res.json({ videos });
});

/* ---------------- 목록 / 상세 (진행률 폴링 겸용) ---------------- */
app.get("/api/videos", (req, res) => {
  const rows = db.prepare("SELECT * FROM videos ORDER BY uploaded_at DESC").all();
  res.json({ videos: rows.map((v) => videoRow(v, liveStages(v.id))) });
});

app.get("/api/videos/:id", (req, res) => {
  const v = db.prepare("SELECT * FROM videos WHERE id=?").get(req.params.id);
  if (!v) return res.status(404).json({ error: "영상을 찾을 수 없습니다" });
  res.json({ video: videoRow(v, liveStages(v.id)) });
});

/* ---------------- 리포트 ---------------- */
app.get("/api/videos/:id/report", (req, res) => {
  const r = buildReport(req.params.id);
  if (!r) return res.status(404).json({ error: "영상을 찾을 수 없습니다" });
  res.json(r);
});

app.get("/api/videos/:id/report.json", (req, res) => {
  const r = reportJson(req.params.id);
  if (!r) return res.status(404).json({ error: "영상을 찾을 수 없습니다" });
  res.setHeader("Content-Disposition", `attachment; filename="report_${req.params.id}.json"`);
  res.json(r);
});

app.get("/api/videos/:id/violations.csv", (req, res) => {
  const v = db.prepare("SELECT id FROM videos WHERE id=?").get(req.params.id);
  if (!v) return res.status(404).json({ error: "영상을 찾을 수 없습니다" });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="violations_${req.params.id}.csv"`);
  res.send(violationsCsv(req.params.id));
});

app.get("/api/ops-doc", (req, res) => {
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="ops-manual.md"');
  res.send(opsDoc());
});

/* ---------------- 삭제 (PRD §4-6: 관련 데이터 전부 삭제) ---------------- */
app.delete("/api/videos/:id", (req, res) => {
  const v = db.prepare("SELECT * FROM videos WHERE id=?").get(req.params.id);
  if (!v) return res.status(404).json({ error: "영상을 찾을 수 없습니다" });
  if (v.status === "processing") {
    return res.status(409).json({ error: "처리 중인 영상은 삭제할 수 없습니다" });
  }
  deleteVideoCascade(v.id);
  fs.rmSync(v.file_path, { force: true });
  fs.rmSync(path.join(FRAMES_DIR, v.id), { recursive: true, force: true });
  res.json({ ok: true });
});

/* ---------------- 검색 ---------------- */
app.get("/api/search", async (req, res) => {
  try {
    const results = await search({
      q: req.query.q || "",
      mode: req.query.mode || "hybrid",
      category: req.query.category,
      verdict: req.query.verdict,
    });
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------------- 정적 파일 ---------------- */
app.use("/files/frames", express.static(FRAMES_DIR, { maxAge: "1d" }));

const dist = path.join(ROOT, "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|files).*/, (req, res) => res.sendFile(path.join(dist, "index.html")));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ClipCheck 서버 실행 중: http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn("⚠ OPENAI_API_KEY 가 비어 있습니다 — .env 에 키를 입력해야 AI 분석 단계가 동작합니다.");
  }
});
