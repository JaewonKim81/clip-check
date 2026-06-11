/* ============================================================
   로컬 Whisper 음성 인식 — python whisper 라이브러리 호출
   (scripts/whisper_stt.py 를 서브프로세스로 실행)
   ============================================================ */
import { spawn } from "child_process";
import path from "path";
import { ROOT } from "./db.js";

const PYTHON = process.env.PYTHON_BIN || "python";
const MODEL = process.env.WHISPER_MODEL || "base";
const LANGUAGE = process.env.WHISPER_LANGUAGE || "ko";

/** 오디오 파일 → [{t, text}] */
export function localTranscribe(audioPath) {
  const script = path.join(ROOT, "scripts", "whisper_stt.py");
  return new Promise((resolve, reject) => {
    const p = spawn(PYTHON, [script, audioPath, "--model", MODEL, "--language", LANGUAGE], {
      windowsHide: true,
    });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => reject(new Error(`Python 실행 실패 (${PYTHON}): ${e.message}`)));
    p.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`whisper 음성 인식 실패 (exit ${code}): ${err.slice(-500)}`));
      }
      try {
        const { segments } = JSON.parse(out);
        resolve(segments);
      } catch {
        reject(new Error(`whisper 출력 파싱 실패: ${out.slice(0, 200)}`));
      }
    });
  });
}
