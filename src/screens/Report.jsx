/* ============================================================
   검수 리포트 — 인터랙티브 타임라인 + 스크러빙 플레이어,
   위반 프레임 그리드, 연속 프레임 상세, 분석 탭 (실데이터)
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { getReport, deleteVideo } from "../api";
import { CATEGORIES, tc, fmtSize } from "../meta";
import { Btn, Card, DeleteModal, Icon, SectionLabel, SeverityChip, SEV_LABEL, Thumb, sevColor } from "../components";
import { CorrectionPanel, MetaPanel, ScenePanel, TechPanel, TranscriptPanel } from "./analysis-panels";

const SEG_COLOR = {
  normal: "var(--seg-normal)", silent: "var(--seg-silent)", black: "var(--seg-black)",
  freeze: "var(--seg-freeze)", clip: "var(--seg-clip)", review: "var(--seg-review)", block: "var(--seg-block)",
};
const SEG_LABEL = { normal: "정상", silent: "무음", black: "블랙", freeze: "프리즈", clip: "클리핑", review: "검토필요", block: "위반" };

function frameSrc(videoId, sec) {
  return `/files/frames/${videoId}/s${String(Math.max(1, Math.floor(sec) + 1)).padStart(6, "0")}.jpg`;
}

/* ---------------- Timeline ---------------- */
function Timeline({ duration, segments, frames, current, onSeek, onPickFrame, selectedFrame }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  function pos(e) {
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return x * duration;
  }
  return (
    <div>
      <div style={{ position: "relative", height: 16, marginBottom: 6 }}>
        {frames.map((f) => (
          <button key={f.id} title={`${f.cat} · ${tc(f.t)}`} onClick={() => { onSeek(f.t); onPickFrame(f.id); }}
            style={{ position: "absolute", left: `${(f.t / duration) * 100}%`, transform: "translateX(-50%)", bottom: 0,
              width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
              borderTop: `8px solid ${sevColor(f.status)}`, background: "none", padding: 0, cursor: "pointer",
              filter: selectedFrame === f.id ? "drop-shadow(0 0 3px var(--foreground))" : "none" }} />
        ))}
      </div>
      <div ref={ref} onClick={(e) => onSeek(pos(e))}
        onMouseMove={(e) => setHover({ t: pos(e) })} onMouseLeave={() => setHover(null)}
        style={{ position: "relative", height: 34, background: "var(--seg-black)", border: "1.5px solid var(--border)", cursor: "pointer", overflow: "hidden" }}>
        {segments.map((s, i) => (
          <div key={i} title={`${SEG_LABEL[s.type]} · ${tc(s.start)}–${tc(s.end)}`}
            style={{ position: "absolute", top: 0, bottom: 0, left: `${(s.start / duration) * 100}%`, width: `${((s.end - s.start) / duration) * 100}%`,
              background: SEG_COLOR[s.type], opacity: s.type === "normal" ? 0.55 : 0.92,
              borderRight: "1px solid rgba(0,0,0,0.25)" }} />
        ))}
        <div style={{ position: "absolute", top: -2, bottom: -2, left: `${(current / duration) * 100}%`, width: 2, background: "var(--foreground)", boxShadow: "0 0 0 1px rgba(0,0,0,0.6)", pointerEvents: "none", transform: "translateX(-1px)" }}>
          <div style={{ position: "absolute", top: -4, left: -4, width: 10, height: 6, background: "var(--foreground)" }}></div>
        </div>
        {hover && (
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(hover.t / duration) * 100}%`, width: 1, background: "var(--foreground)", opacity: 0.4, pointerEvents: "none" }}></div>
        )}
      </div>
      {hover && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 4 }}>{tc(hover.t)}</div>
      )}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
        {Object.keys(SEG_LABEL).map((k) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--muted-foreground)" }}>
            <span style={{ width: 11, height: 11, background: SEG_COLOR[k], border: k === "black" ? "1px solid var(--border)" : "none" }}></span>{SEG_LABEL[k]}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Player (1초 샘플 프레임 스크러빙) ---------------- */
function Player({ videoId, duration, current, segments, frames, playing, onToggle, onSeek, onStep }) {
  const seg = segments.find((s) => current >= s.start && current < s.end) || segments[0] || { type: "normal" };
  const refFrame = seg.ref != null ? frames.find((f) => f.id === seg.ref) : null;
  const label = seg.type === "normal" ? null : SEG_LABEL[seg.type];
  return (
    <div>
      <div style={{ position: "relative", border: "1.5px solid var(--border)" }}>
        <Thumb src={frameSrc(videoId, current)} seed={Math.floor(current / 4) * 5 + 11}
          hue={refFrame ? CATEGORIES[refFrame.cat]?.hue : null}
          tcLabel={tc(current)} label={label} glitch={playing && seg.type !== "normal"} style={{ border: "none" }} />
        {refFrame && (
          <div style={{ position: "absolute", top: 8, right: 8 }}><SeverityChip band={refFrame.status} score={`S${refFrame.sev}`} /></div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        <Btn size="sm" variant="outline" icon="chevL" onClick={() => onStep(-1)}>이전 위반</Btn>
        <Btn size="sm" variant={playing ? "secondary" : "default"} icon={playing ? "pause" : "play"} onClick={onToggle}>{playing ? "일시정지" : "재생"}</Btn>
        <Btn size="sm" variant="outline" onClick={() => onStep(1)}>다음 위반 <Icon name="chevR" size={14} /></Btn>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted-foreground)" }}>{tc(current)} / {tc(duration)}</span>
      </div>
    </div>
  );
}

/* ---------------- Violation grid + detail ---------------- */
function ViolationGrid({ frames, selected, onSelect }) {
  if (!frames.length) {
    return <div style={{ padding: 32, textAlign: "center", color: "var(--muted-foreground)", border: "1px dashed var(--border)", fontSize: 12.5 }}>위반 또는 검토필요로 분류된 프레임이 없습니다. ✓</div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(124px, 1fr))", gap: 10 }}>
      {frames.map((f) => {
        const on = selected === f.id;
        return (
          <button key={f.id} onClick={() => onSelect(f.id)}
            style={{ padding: 0, border: `2px solid ${on ? sevColor(f.status) : "var(--border)"}`, background: "var(--card)", cursor: "pointer", textAlign: "left",
              boxShadow: on ? "var(--shadow)" : "none", transition: "all 0.1s" }}>
            <div style={{ position: "relative" }}>
              <Thumb src={f.thumb} seed={f.id * 7} hue={CATEGORIES[f.cat]?.hue} tcLabel={tc(f.t)} style={{ border: "none" }} />
              <span style={{ position: "absolute", top: 3, left: 3, width: 9, height: 9, background: sevColor(f.status) }}></span>
            </div>
            <div style={{ padding: "6px 7px" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{f.cat}</span>
                <span style={{ fontFamily: "var(--font-mono)", color: sevColor(f.status) }}>S{f.sev}</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>{SEV_LABEL[f.status]}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function FrameDetail({ frame, onSeek }) {
  if (!frame) return (
    <div style={{ border: "1px dashed var(--border)", padding: 40, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      위반/검토 프레임을 선택하면 연속 프레임과 판정 근거가 표시됩니다.
    </div>
  );
  const c = sevColor(frame.status);
  const mid = Math.floor(frame.frames.length / 2);
  return (
    <div style={{ border: "1.5px solid var(--border)", borderTop: `3px solid ${c}`, background: "var(--card)" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 16 }}>{frame.cat}</span>
            <SeverityChip band={frame.status} score={`S${frame.sev}`} />
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", marginTop: 4, cursor: "pointer" }} onClick={() => onSeek(frame.t)}>@ {tc(frame.t)} · 타임라인 이동 ↗</div>
        </div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 7 }}>연속 {frame.frames.length}프레임 (≈1초 간격) — 동작의 흐름</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {frame.frames.map((ft, i) => (
            <div key={i} style={{ flex: 1, position: "relative" }}>
              <Thumb src={ft.url} seed={frame.id * 7 + i} hue={CATEGORIES[frame.cat]?.hue} tcLabel={tc(ft.t)} />
              {i === mid && <span style={{ position: "absolute", top: 3, right: 3, fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, background: c, color: "#000", padding: "0 3px" }}>KEY</span>}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.65, marginBottom: 14 }}>{frame.reason}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 8 }}>판정 근거</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, border: "1px solid var(--border)" }}>
          <BasisRow icon="type" k="대사" v={frame.basis.dialogue} />
          <BasisRow icon="waveform" k="소리" v={frame.basis.audio} />
          <BasisRow icon="doc" k="근거 조문" v={frame.basis.rule} mono />
        </div>
      </div>
    </div>
  );
}

function BasisRow({ icon, k, v, mono }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "9px 12px", borderBottom: "1px solid var(--border)", background: "var(--background)" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, width: 84, flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-foreground)" }}>
        <Icon name={icon} size={13} />{k}
      </span>
      <span style={{ fontSize: 12.5, fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)", lineHeight: 1.5, color: v === "—" ? "var(--muted-foreground)" : "var(--foreground)" }}>{v}</span>
    </div>
  );
}

/* ---------------- Category summary ---------------- */
function CategorySummary({ frames }) {
  const cats = Object.keys(CATEGORIES);
  const byCat = {};
  frames.forEach((f) => { byCat[f.cat] = byCat[f.cat] || { max: -1, n: 0 }; byCat[f.cat].n++; byCat[f.cat].max = Math.max(byCat[f.cat].max, f.sev); });
  function band(sev) { return sev >= 4 ? "block" : sev === 3 ? "warn" : sev >= 1 ? "caution" : "pass"; }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(108px, 1fr))", gap: 6 }}>
      {cats.map((c) => {
        const d = byCat[c];
        const active = !!d;
        const col = active ? sevColor(band(d.max)) : "var(--border)";
        return (
          <div key={c} style={{ border: "1px solid var(--border)", borderTop: `3px solid ${col}`, padding: "8px 10px", background: active ? "var(--card)" : "var(--background)", opacity: active ? 1 : 0.5 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{c}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: active ? col : "var(--muted-foreground)", marginTop: 3 }}>
              {active ? `${d.n}건 · S${d.max}` : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Report screen ---------------- */
export function ReportScreen({ videoId, onBack }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("review");
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    getReport(videoId)
      .then((r) => {
        setReport(r);
        setSelected(r.violations[0]?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, [videoId]);

  const duration = report?.video.duration || 1;

  useEffect(() => {
    if (!playing || !report) return;
    const iv = setInterval(() => setCurrent((c) => { const n = c + duration / 240; return n >= duration ? 0 : n; }), 80);
    return () => clearInterval(iv);
  }, [playing, duration, report]);

  if (error) return (
    <div style={{ maxWidth: 800, margin: "60px auto", padding: 28, textAlign: "center", color: "var(--destructive)", fontFamily: "var(--font-mono)" }}>
      ⚠ 리포트를 불러올 수 없습니다: {error}
      <div style={{ marginTop: 16 }}><Btn variant="outline" onClick={onBack}>대시보드로</Btn></div>
    </div>
  );
  if (!report) return (
    <div style={{ padding: 80, textAlign: "center", color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", fontSize: 13 }}>리포트 불러오는 중…</div>
  );

  const { video, violations: frames, segments, tech, scenes, subtitles } = report;

  function stepViolation(dir) {
    if (!frames.length) return;
    const sorted = frames.slice().sort((a, b) => a.t - b.t);
    let target;
    if (dir > 0) target = sorted.find((f) => f.t > current + 0.1) || sorted[0];
    else target = sorted.slice().reverse().find((f) => f.t < current - 0.1) || sorted[sorted.length - 1];
    if (target) { setCurrent(target.t); setSelected(target.id); }
  }
  const selFrame = frames.find((f) => f.id === selected);

  async function confirmDelete(id) {
    try {
      await deleteVideo(id);
      setPendingDelete(null);
      onBack();
    } catch (e) {
      setPendingDelete(null);
      alert(e.message);
    }
  }

  const exports = [
    { f: "report.json", href: `/api/videos/${video.id}/report.json` },
    { f: "violations.csv", href: `/api/videos/${video.id}/violations.csv` },
    { f: "운영절차서.md", href: "/api/ops-doc" },
  ];

  const tabs = [
    { id: "review", name: "금칙 검수", icon: "alert" },
    { id: "analysis", name: "분석 정보", icon: "cpu" },
    { id: "subtitle", name: "자막", icon: "type" },
  ];

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 28px 80px" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Btn variant="ghost" size="sm" icon="chevL" onClick={onBack}>대시보드</Btn>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "var(--font-mono)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{video.name}</h1>
            {video.verdict && <SeverityChip band={video.verdict} score={video.maxSev != null ? `S${video.maxSev}` : null} />}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
            {fmtSize(video.sizeBytes)} · {tc(duration)} · 위반 {video.counts?.block ?? 0} · 검토 {video.counts?.review ?? 0}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {exports.map((e) => (
            <a key={e.f} href={e.href} download style={{ textDecoration: "none" }}>
              <Btn size="sm" variant="outline" icon="doc" title={`${e.f} 내보내기`}>{e.f}</Btn>
            </a>
          ))}
          <Btn size="sm" variant="destructive" icon="trash" onClick={() => setPendingDelete(video)}>삭제</Btn>
        </div>
      </div>

      {/* category summary */}
      <div style={{ marginBottom: 18 }}>
        <SectionLabel>카테고리별 판정 — 방송심의 규정 8종</SectionLabel>
        <CategorySummary frames={frames} />
      </div>

      {/* player + timeline */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: 18, marginBottom: 22, alignItems: "start" }} className="report-pt">
        <Card style={{ padding: 16 }}>
          <Player videoId={video.id} duration={duration} current={current} segments={segments} frames={frames} playing={playing}
            onToggle={() => setPlaying((p) => !p)} onSeek={setCurrent} onStep={stepViolation} />
        </Card>
        <Card style={{ padding: 16 }}>
          <SectionLabel>타임라인 · 구간 분석</SectionLabel>
          <Timeline duration={duration} segments={segments} frames={frames} current={current}
            onSeek={setCurrent} onPickFrame={(id) => { setSelected(id); setTab("review"); }} selectedFrame={selected} />
        </Card>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 0 }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", cursor: "pointer",
            font: "700 13px var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap",
            background: tab === t.id ? "var(--card)" : "transparent", color: tab === t.id ? "var(--foreground)" : "var(--muted-foreground)",
            border: `1.5px solid ${tab === t.id ? "var(--border)" : "transparent"}`, borderBottom: tab === t.id ? "1.5px solid var(--card)" : "1.5px solid var(--border)", position: "relative", top: 1 }}>
            <Icon name={t.icon} size={15} />{t.name}
          </button>
        ))}
        <div style={{ flex: 1, borderBottom: "1.5px solid var(--border)" }}></div>
      </div>

      <div style={{ border: "1.5px solid var(--border)", borderTop: "none", padding: 20, background: "var(--card)" }}>
        {tab === "review" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: 18 }} className="report-review">
            <div>
              <SectionLabel right={<span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-foreground)" }}>{frames.length}건</span>}>위반 · 검토 프레임</SectionLabel>
              <ViolationGrid frames={frames} selected={selected} onSelect={(id) => { setSelected(id); const f = frames.find((x) => x.id === id); if (f) setCurrent(f.t); }} />
            </div>
            <div>
              <SectionLabel>프레임 상세 판정</SectionLabel>
              <FrameDetail frame={selFrame} onSeek={(t) => setCurrent(t)} />
            </div>
          </div>
        )}
        {tab === "analysis" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div><SectionLabel>메타데이터</SectionLabel><MetaPanel video={video} /></div>
            <div><SectionLabel>기술 검토 — 무음 · 블랙 · 프리즈 · 클리핑</SectionLabel><TechPanel tech={tech} /></div>
            <div><SectionLabel>장면 분석 — 구간별 대표화면 + 설명</SectionLabel><ScenePanel scenes={scenes} /></div>
          </div>
        )}
        {tab === "subtitle" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 24 }} className="report-sub">
            <div><SectionLabel>AI 자막 교정 내역</SectionLabel><CorrectionPanel subtitles={subtitles} /></div>
            <div><SectionLabel>자막 전문 (시간순)</SectionLabel><TranscriptPanel subtitles={subtitles} current={current} onSeek={setCurrent} /></div>
          </div>
        )}
      </div>

      <DeleteModal video={pendingDelete} onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete} />
    </div>
  );
}
