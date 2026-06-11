/* ============================================================
   업로드 + 실시간 병렬 처리 파이프라인 (3개 레인 DAG)
   실제 파일 업로드 → 서버 파이프라인 진행률 폴링
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { uploadFiles, listVideos } from "../api";
import { STAGE_DEFS, tc, fmtSize } from "../meta";
import { Btn, Card, Icon, Progress, SectionLabel, SeverityChip, Thumb } from "../components";

const STAGE_ICON = { subtitle: "type", correct: "check", scene: "eye", tech: "waveform", sample: "film", judge: "alert", index: "layers", summary: "doc" };
const STAGE_DEPS = { correct: ["subtitle"], index: ["scene", "correct"], judge: ["sample", "subtitle"], summary: ["judge", "tech"] };

function stageName(id) { return STAGE_DEFS.find((d) => d.id === id)?.name || id; }

function StageNode({ id, st }) {
  const failed = st.status === "failed";
  const done = st.status === "done";
  const active = st.status === "running";
  const waiting = st.status === "pending";
  const col = failed ? "var(--destructive)" : done ? "var(--secondary)" : active ? "var(--accent)" : "var(--muted-foreground)";
  return (
    <div title={failed ? st.error : undefined} style={{
      background: "var(--card)", border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
      borderLeft: `4px solid ${col}`, padding: "10px 12px", minWidth: 150, flex: 1,
      opacity: waiting ? 0.5 : 1, transition: "opacity 0.3s, border-color 0.3s",
      boxShadow: active ? "var(--shadow)" : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color: col, display: "flex", animation: active ? "doom-pulse 1s ease-in-out infinite" : "none" }}>
          <Icon name={STAGE_ICON[id]} size={16} />
        </span>
        <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{stageName(id)}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: col }}>
          {failed ? "ERR" : waiting ? "대기" : done ? "✓" : Math.floor(st.pct) + "%"}
        </span>
      </div>
      <Progress value={st.pct} color={col} height={6} indeterminate={active && st.pct < 6} failed={failed} />
      {failed && <div style={{ marginTop: 6, fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--destructive)", lineHeight: 1.4 }}>{st.error}</div>}
    </div>
  );
}

function Arrow() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)", padding: "0 2px" }}>
      <Icon name="chevR" size={16} stroke={2.5} />
    </div>
  );
}

function Lane({ label, children }) {
  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--background)", padding: 12 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "stretch", gap: 4, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function ProcessingView({ stages }) {
  const get = (id) => stages?.[id] || { pct: 0, status: "pending" };
  const overall = Math.floor(STAGE_DEFS.reduce((a, d) => a + get(d.id).pct, 0) / STAGE_DEFS.length);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 9, height: 9, background: "var(--accent)", animation: "doom-blink 0.9s steps(1) infinite" }}></span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", color: "var(--accent)", textTransform: "uppercase" }}>병렬 처리 중 — 3개 레인 동시 실행</span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>{overall}%</span>
      </div>
      <Progress value={overall} color="var(--accent)" height={4} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        <Lane label="레인 1 · 자막 (순차)">
          <StageNode id="subtitle" st={get("subtitle")} />
          <Arrow />
          <StageNode id="correct" st={get("correct")} />
        </Lane>
        <Lane label="레인 2 · 분석 (병렬) → 색인">
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
            <StageNode id="scene" st={get("scene")} />
            <StageNode id="tech" st={get("tech")} />
          </div>
          <Arrow />
          <StageNode id="index" st={get("index")} />
        </Lane>
        <Lane label="레인 3 · 금칙 검수 (순차)">
          <StageNode id="sample" st={get("sample")} />
          <Arrow />
          <StageNode id="judge" st={get("judge")} />
          <Arrow />
          <StageNode id="summary" st={get("summary")} />
        </Lane>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 14, lineHeight: 1.6, borderLeft: "2px solid var(--border)", paddingLeft: 10 }}>
        한 단계가 실패해도 나머지 병렬 단계는 계속 진행됩니다. 의존 관계가 있는 단계(교정 · 색인 · 종합 판정)는 선행 단계 완료 후 자동으로 시작됩니다.
      </p>
    </div>
  );
}

function TelegramToast({ video, onClose, onReport }) {
  return (
    <div style={{ position: "fixed", right: 24, bottom: 24, zIndex: 300, width: 340, background: "var(--card)", border: "1.5px solid var(--accent)", borderTop: "3px solid var(--accent)", boxShadow: "var(--shadow-lg)", animation: "doom-fade-up 0.25s ease" }}>
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 9, borderBottom: "1px solid var(--border)" }}>
        <span style={{ color: "var(--accent)", display: "flex" }}><Icon name="send" size={16} /></span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)", flex: 1 }}>
          {video.notified ? "텔레그램 알림 전송됨" : "처리 완료"}
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer", display: "flex" }}><Icon name="x" size={14} /></button>
      </div>
      <div style={{ padding: 14, fontSize: 12.5, lineHeight: 1.7 }}>
        <strong>✓ 처리 완료</strong> · {video.name}<br />
        <span style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
          종합 판정: <span style={{ color: `var(--sev-${video.verdict || "pass"})` }}>
            {{ pass: "통과", review: "검토 필요", block: "방영 불가" }[video.verdict] || "—"} (S{video.maxSev ?? 0})
          </span>
          {video.counts && <> · 위반 {video.counts.block} · 검토 {video.counts.review}</>}
        </span>
        {video.hasReport && <div style={{ marginTop: 10 }}><Btn size="sm" icon="doc" onClick={() => onReport(video.id)}>리포트 확인</Btn></div>}
      </div>
    </div>
  );
}

export function UploadScreen({ onOpenReport, onBack }) {
  const [phase, setPhase] = useState("idle"); // idle | uploading | processing
  const [uploadPct, setUploadPct] = useState(0);
  const [tracked, setTracked] = useState([]); // 이 화면에서 업로드한 영상들 (서버 상태)
  const [drag, setDrag] = useState(false);
  const [toast, setToast] = useState(null);   // 완료된 video 객체
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const notifiedRef = useRef(new Set());

  async function startUpload(fileList) {
    const files = [...fileList].filter((f) => f.size > 0);
    if (!files.length) return;
    setError(null);
    setPhase("uploading");
    setUploadPct(0);
    try {
      const videos = await uploadFiles(files, setUploadPct);
      setTracked(videos);
      setPhase("processing");
    } catch (e) {
      setError(e.message);
      setPhase("idle");
    }
  }

  // 처리 중 폴링
  useEffect(() => {
    if (phase !== "processing" || tracked.length === 0) return;
    const ids = new Set(tracked.map((v) => v.id));
    const iv = setInterval(async () => {
      try {
        const all = await listVideos();
        const mine = all.filter((v) => ids.has(v.id));
        setTracked(mine);
        for (const v of mine) {
          if (v.status === "done" && !notifiedRef.current.has(v.id)) {
            notifiedRef.current.add(v.id);
            setToast(v);
          }
        }
        if (mine.every((v) => v.status !== "processing")) clearInterval(iv);
      } catch { /* 다음 폴링에서 재시도 */ }
    }, 1000);
    return () => clearInterval(iv);
  }, [phase, tracked.length]);

  const allDone = tracked.length > 0 && tracked.every((v) => v.status !== "processing");

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 28px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Btn variant="ghost" size="sm" icon="chevL" onClick={onBack}>대시보드</Btn>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, textTransform: "uppercase", whiteSpace: "nowrap" }}>업로드 & 처리</h1>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", border: "1.5px solid var(--destructive)", color: "var(--destructive)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          ⚠ {error}
        </div>
      )}

      {phase === "idle" && (
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); startUpload(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          style={{ border: `2px dashed ${drag ? "var(--primary)" : "var(--border)"}`, background: drag ? "var(--muted)" : "var(--card)",
            padding: "70px 30px", textAlign: "center", cursor: "pointer", transition: "all 0.15s" }}>
          <input ref={inputRef} type="file" accept="video/*" multiple style={{ display: "none" }}
            onChange={(e) => startUpload(e.target.files)} />
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16, color: drag ? "var(--primary)" : "var(--muted-foreground)" }}><Icon name="upload" size={44} stroke={1.5} /></div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>영상 파일을 끌어다 놓거나 클릭해 선택</div>
          <div style={{ color: "var(--muted-foreground)", fontSize: 13, marginTop: 6 }}>MP4 · MOV · MKV · 여러 개 누적 업로드 가능</div>
          <div style={{ marginTop: 18 }}><Btn icon="plus">파일 선택</Btn></div>
        </div>
      )}

      {phase === "uploading" && (
        <Card style={{ padding: 24 }}>
          <SectionLabel>업로드 중</SectionLabel>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-foreground)", margin: "3px 0 10px" }}>업로드 {Math.floor(uploadPct)}%</div>
              <Progress value={uploadPct} color="var(--primary)" height={8} />
            </div>
          </div>
        </Card>
      )}

      {phase === "processing" && tracked.map((v) => (
        <Card key={v.id} style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
            <div style={{ width: 120, flexShrink: 0 }}>
              <Thumb src={v.thumb} seed={3} tcLabel={tc(v.duration)} glitch={v.status === "processing"} label={v.category} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{v.name}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>
                {fmtSize(v.sizeBytes)} · {tc(v.duration)} · {v.subtitleSource}
              </div>
            </div>
            {v.status === "done" && <SeverityChip band={v.verdict || "pass"} score={`S${v.maxSev ?? 0}`} />}
          </div>

          {v.status === "processing" && <ProcessingView stages={v.stages} />}

          {v.status === "done" && (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: "var(--secondary)" }}><Icon name="check" size={40} stroke={2.5} /></div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>처리 완료</div>
              <p style={{ color: "var(--muted-foreground)", fontSize: 13, margin: "6px auto 18px", maxWidth: 460, lineHeight: 1.6 }}>
                모든 단계가 완료되어 아카이브에 저장되고 검색 색인이 생성되었습니다.
                {v.counts && <> 종합 판정 결과 <strong style={{ color: `var(--sev-${v.verdict})` }}>
                  {{ pass: "통과", review: "검토 필요", block: "방영 불가" }[v.verdict]}(S{v.maxSev ?? 0})
                </strong> · 위반 {v.counts.block}건 · 검토필요 {v.counts.review}건이 확인되었습니다.</>}
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <Btn icon="doc" onClick={() => onOpenReport(v.id)}>검수 리포트 보기</Btn>
              </div>
            </div>
          )}

          {v.status === "failed" && (
            <div style={{ fontSize: 12, color: "var(--destructive)", fontFamily: "var(--font-mono)", borderLeft: "2px solid var(--destructive)", paddingLeft: 10, lineHeight: 1.6 }}>
              ⚠ {v.failNote || "처리 중 오류가 발생했습니다"}
            </div>
          )}
        </Card>
      ))}

      {allDone && (
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 8 }}>
          <Btn variant="outline" icon="upload" onClick={() => { setPhase("idle"); setTracked([]); }}>추가 업로드</Btn>
          <Btn variant="outline" icon="grid" onClick={onBack}>대시보드로</Btn>
        </div>
      )}

      {toast && <TelegramToast video={toast} onClose={() => setToast(null)} onReport={onOpenReport} />}
    </div>
  );
}
