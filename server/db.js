/* ============================================================
   SQLite 영속 계층 — 재시작 후에도 모든 데이터 유지 (PRD §7)
   키워드 검색용 FTS5 + 벡터 검색용 embeddings 테이블 병행 운영
   ============================================================ */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
// Electron 패키징 시 userData 경로로 오버라이드 (asar 내부는 쓰기 불가)
export const DATA_DIR = process.env.CLIPCHECK_DATA_DIR || path.join(ROOT, "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const FRAMES_DIR = path.join(DATA_DIR, "frames");

for (const d of [DATA_DIR, UPLOAD_DIR, FRAMES_DIR]) {
  fs.mkdirSync(d, { recursive: true });
}

export const db = new Database(path.join(DATA_DIR, "clipcheck.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  duration REAL DEFAULT 0,
  uploaded_at TEXT NOT NULL,
  category TEXT DEFAULT '미분류',
  subtitle_source TEXT DEFAULT '—',
  status TEXT NOT NULL DEFAULT 'processing',  -- processing | done | failed
  verdict TEXT,                               -- pass | review | block
  max_sev INTEGER,
  block_count INTEGER DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  notified INTEGER DEFAULT 0,
  stages_json TEXT DEFAULT '{}',
  failed_stage TEXT,
  fail_note TEXT,
  file_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS violations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  t REAL NOT NULL,
  cat TEXT NOT NULL,
  sev INTEGER NOT NULL,
  status TEXT NOT NULL,        -- block | review
  reason TEXT,
  dialogue TEXT,
  audio TEXT,
  rule TEXT,
  frame_times TEXT             -- JSON array of seconds (연속 프레임)
);

CREATE TABLE IF NOT EXISTS segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  start REAL NOT NULL, "end" REAL NOT NULL,
  type TEXT NOT NULL,          -- normal | silent | black | freeze | clip | review | block
  ref INTEGER                  -- violations.id
);

CREATE TABLE IF NOT EXISTS tech_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  type TEXT NOT NULL,          -- silent | black | freeze | clip
  t_start REAL NOT NULL, t_end REAL NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS scenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  t REAL NOT NULL,
  image TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS subtitles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  t REAL NOT NULL,
  text TEXT NOT NULL,
  corrected_from TEXT          -- 원본 (교정된 경우만)
);

CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
  content, video_id UNINDEXED, t UNINDEXED, kind UNINDEXED
);

CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  t REAL NOT NULL,
  kind TEXT NOT NULL,          -- subtitle | scene
  content TEXT NOT NULL,
  vector BLOB NOT NULL
);
`);

/* ---- 재시작 시 처리 중이던 영상은 실패 처리 (좀비 방지) ---- */
db.prepare(`
  UPDATE videos SET status='failed',
    fail_note='서버 재시작으로 처리가 중단되었습니다. 영상을 삭제 후 다시 업로드하세요.'
  WHERE status='processing'
`).run();

export function deleteVideoCascade(id) {
  const tx = db.transaction((vid) => {
    db.prepare("DELETE FROM violations WHERE video_id=?").run(vid);
    db.prepare("DELETE FROM segments WHERE video_id=?").run(vid);
    db.prepare("DELETE FROM tech_findings WHERE video_id=?").run(vid);
    db.prepare("DELETE FROM scenes WHERE video_id=?").run(vid);
    db.prepare("DELETE FROM subtitles WHERE video_id=?").run(vid);
    db.prepare("DELETE FROM search_fts WHERE video_id=?").run(vid);
    db.prepare("DELETE FROM embeddings WHERE video_id=?").run(vid);
    db.prepare("DELETE FROM videos WHERE id=?").run(vid);
  });
  tx(id);
}
