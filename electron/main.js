/* ============================================================
   ClipCheck Electron 메인 프로세스
   — Express 서버를 메인 프로세스에 내장 실행하고 창에서 로드
   — 데이터(.env, DB, 업로드, 프레임, 금칙기준)는 userData 에 저장
   ============================================================ */
import { app, BrowserWindow, dialog, shell } from "electron";
import path from "path";
import fs from "fs";
import net from "net";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, "..");

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

/** userData 에 .env / rules 초기 파일 준비 (asar 내부 fs 읽기는 Electron 이 지원) */
function prepareUserData() {
  const userDir = app.getPath("userData");
  const dataDir = path.join(userDir, "data");
  const rulesDir = path.join(userDir, "rules");
  const envPath = path.join(userDir, ".env");

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(rulesDir, { recursive: true });

  const rulesFile = path.join(rulesDir, "금칙기준.md");
  if (!fs.existsSync(rulesFile)) {
    fs.copyFileSync(path.join(APP_ROOT, "rules", "금칙기준.md"), rulesFile);
  }
  if (!fs.existsSync(envPath)) {
    // 개발용 .env 가 있으면 가져오고, 없으면 템플릿 복사
    const devEnv = path.join(APP_ROOT, ".env");
    const template = path.join(APP_ROOT, ".env.example");
    fs.copyFileSync(fs.existsSync(devEnv) ? devEnv : template, envPath);
  }
  return { dataDir, rulesDir, envPath };
}

async function start() {
  await app.whenReady();

  let envPath;
  if (app.isPackaged) {
    const prepared = prepareUserData();
    process.env.CLIPCHECK_DATA_DIR = prepared.dataDir;
    process.env.CLIPCHECK_RULES_DIR = prepared.rulesDir;
    envPath = prepared.envPath;
  } else {
    // 개발 모드: 프로젝트 폴더의 data/, rules/, .env 그대로 사용
    envPath = path.join(APP_ROOT, ".env");
  }
  dotenv.config({ path: envPath });

  const port = await findFreePort();
  process.env.PORT = String(port);

  // 환경 설정 후 서버 로드 (메인 프로세스 안에서 실행)
  await import("../server/index.js");

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: "#262626",
    title: "ClipCheck",
    webPreferences: { contextIsolation: true },
  });
  win.loadURL(`http://localhost:${port}`);

  // 외부 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // API 키 미설정 안내
  if (!process.env.OPENAI_API_KEY) {
    const { response } = await dialog.showMessageBox(win, {
      type: "warning",
      title: "ClipCheck — API 키 필요",
      message: "OPENAI_API_KEY 가 설정되지 않았습니다.",
      detail: `AI 분석(장면 분석·금칙 판정·자막 교정·검색)을 사용하려면 설정 파일에 OpenAI API 키를 입력한 뒤 앱을 다시 시작하세요.\n\n${envPath}`,
      buttons: ["설정 파일 열기", "나중에"],
    });
    if (response === 0) shell.openPath(envPath);
  }
}

app.on("window-all-closed", () => app.quit());

start().catch((e) => {
  dialog.showErrorBox("ClipCheck 시작 실패", String(e?.stack || e));
  app.quit();
});
