/* ============================================================
   리포트 분석 패널 — 메타데이터, 기술 검토, 장면 분석,
   AI 자막 교정 내역, 자막 전문 (실데이터 기반)
   ============================================================ */
import { tc, fmtSize } from "../meta";
import { Thumb } from "../components";

export function MetaPanel({ video }) {
  const rows = [
    ["파일명", video.name],
    ["크기", fmtSize(video.sizeBytes)],
    ["길이", tc(video.duration)],
    ["카테고리", video.category],
    ["업로드 시각", video.uploadedAt],
    ["자막 획득 방식", video.subtitleSource],
    ["저장소", "키워드 색인 + 벡터 색인 (병행)"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 0, border: "1px solid var(--border)" }}>
      {rows.map(([k, v], i) => (
        <div key={k} style={{ display: "flex", borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
          <div style={{ width: 130, flexShrink: 0, padding: "9px 12px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-foreground)", background: "var(--background)", borderRight: "1px solid var(--border)", letterSpacing: "0.04em" }}>{k}</div>
          <div style={{ padding: "9px 12px", fontSize: 13, fontFamily: k === "파일명" ? "var(--font-mono)" : "var(--font-sans)", wordBreak: "break-all" }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

const TECH_COLOR = { silent: "var(--seg-silent)", black: "var(--seg-black)", freeze: "var(--seg-freeze)", clip: "var(--seg-clip)" };
const TECH_LABEL = { silent: "무음 구간", black: "블랙 구간", freeze: "프리즈 화면", clip: "오디오 클리핑" };

export function TechPanel({ tech }) {
  if (!tech?.length) {
    return <div style={{ padding: 24, textAlign: "center", color: "var(--muted-foreground)", border: "1px dashed var(--border)", fontSize: 12.5 }}>감지된 기술 이슈가 없습니다.</div>;
  }
  const short = (s) => tc(s).slice(0, 8);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {tech.map((t, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", border: "1px solid var(--border)", borderLeft: `4px solid ${TECH_COLOR[t.type]}`, background: "var(--card)" }}>
          <span style={{ width: 12, height: 12, background: TECH_COLOR[t.type], flexShrink: 0, border: t.type === "black" ? "1px solid var(--border)" : "none" }}></span>
          <span style={{ fontWeight: 700, fontSize: 13, minWidth: 90 }}>{TECH_LABEL[t.type] || t.type}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)" }}>{short(t.t_start)} – {short(t.t_end)}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--muted-foreground)", marginLeft: "auto" }}>{t.note}</span>
        </div>
      ))}
    </div>
  );
}

export function ScenePanel({ scenes }) {
  if (!scenes?.length) {
    return <div style={{ padding: 24, textAlign: "center", color: "var(--muted-foreground)", border: "1px dashed var(--border)", fontSize: 12.5 }}>장면 분석 결과가 없습니다.</div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
      {scenes.map((s, i) => (
        <div key={i} style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
          <Thumb src={s.url} seed={i * 7 + 3} tcLabel={tc(s.t)} />
          <div style={{ padding: "9px 11px", fontSize: 12, lineHeight: 1.55, color: "var(--card-foreground)" }}>{s.desc}</div>
        </div>
      ))}
    </div>
  );
}

export function CorrectionPanel({ subtitles }) {
  const corrected = (subtitles || []).filter((s) => s.corrected);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 2 }}>AI가 교정으로 <strong style={{ color: "var(--foreground)" }}>바뀐 문장만</strong> 표시합니다 · 총 {corrected.length}건</div>
      {corrected.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: "var(--muted-foreground)", border: "1px dashed var(--border)", fontSize: 12.5 }}>교정된 자막이 없습니다.</div>
      )}
      {corrected.map((s, i) => (
        <div key={i} style={{ border: "1px solid var(--border)", background: "var(--card)", padding: "11px 13px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-foreground)", marginBottom: 7 }}>@ {tc(s.t)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--destructive)", border: "1px solid var(--destructive)", padding: "0 5px", flexShrink: 0 }}>원본</span>
              <span style={{ fontSize: 13, color: "var(--muted-foreground)", textDecoration: "line-through", textDecorationColor: "var(--destructive)" }}>{s.corrected.from}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--secondary)", border: "1px solid var(--secondary)", padding: "0 5px", flexShrink: 0 }}>교정</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{s.corrected.to}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TranscriptPanel({ subtitles, onSeek, current }) {
  if (!subtitles?.length) {
    return <div style={{ padding: 24, textAlign: "center", color: "var(--muted-foreground)", border: "1px dashed var(--border)", fontSize: 12.5 }}>자막이 없습니다.</div>;
  }
  return (
    <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid var(--border)", background: "var(--card)" }}>
      {subtitles.map((s, i) => {
        const active = current != null && Math.abs(current - s.t) < 6;
        return (
          <button key={i} onClick={() => onSeek && onSeek(s.t)}
            style={{ display: "flex", gap: 12, width: "100%", textAlign: "left", padding: "9px 13px", cursor: "pointer",
              background: active ? "var(--muted)" : "transparent", border: "none", borderBottom: "1px solid var(--border)",
              borderLeft: active ? "3px solid var(--primary)" : "3px solid transparent", color: "var(--foreground)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", flexShrink: 0, paddingTop: 1 }}>{tc(s.t)}</span>
            <span style={{ fontSize: 13, lineHeight: 1.5 }}>{s.text}{s.corrected && <span title="AI 교정됨" style={{ marginLeft: 6, fontSize: 10, color: "var(--secondary)" }}>✎</span>}</span>
          </button>
        );
      })}
    </div>
  );
}
