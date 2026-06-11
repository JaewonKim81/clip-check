/* ============================================================
   대시보드 — 실시간 처리 상태 폴링, 판정 요약, 삭제
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import { listVideos, deleteVideo } from "../api";
import { STAGE_DEFS, tc, fmtSize } from "../meta";
import { Btn, Card, DeleteModal, Icon, Progress, SeverityChip, Tag, Thumb, sevColor } from "../components";

function StatTile({ label, value, color, sub }) {
  return (
    <div style={{ background: "var(--card)", border: "1.5px solid var(--border)", borderTop: `3px solid ${color}`, padding: "14px 16px", flex: 1, minWidth: 130 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 800, color, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function StagePips({ stages }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 10 }}>
      {STAGE_DEFS.map((d) => {
        const st = stages?.[d.id] || { pct: 0, status: "pending" };
        const failed = st.status === "failed";
        const done = st.status === "done";
        const active = st.status === "running";
        const col = failed ? "var(--destructive)" : done ? "var(--secondary)" : active ? "var(--accent)" : "var(--muted-foreground)";
        return (
          <div key={d.id} title={`${d.name} ${failed ? "실패: " + (st.error || "") : st.pct + "%"}`}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 9.5, fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
              <span style={{ fontSize: 9.5, fontFamily: "var(--font-mono)", color: col, fontWeight: 700 }}>{failed ? "ERR" : done ? "✓" : st.pct + "%"}</span>
            </div>
            <Progress value={st.pct} color={col} height={5} indeterminate={active && st.pct < 8} failed={failed} />
          </div>
        );
      })}
    </div>
  );
}

function VerdictBadge({ verdict, maxSev, counts }) {
  if (verdict == null) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <SeverityChip band={verdict} score={maxSev != null ? `S${maxSev}` : null} />
      {counts && (counts.block > 0 || counts.review > 0) && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-foreground)" }}>
          {counts.block > 0 && <span style={{ color: "var(--sev-block)" }}>위반 {counts.block}</span>}
          {counts.block > 0 && counts.review > 0 && " · "}
          {counts.review > 0 && <span style={{ color: "var(--sev-review)" }}>검토 {counts.review}</span>}
        </span>
      )}
    </div>
  );
}

function VideoRow({ v, onOpen, onDelete }) {
  const processing = v.status === "processing";
  const failed = v.status === "failed";

  return (
    <Card hover style={{ padding: 14, display: "flex", flexDirection: "row", gap: 14, alignItems: "flex-start" }}
      accent={v.verdict ? sevColor(v.verdict) : processing ? "var(--accent)" : failed ? "var(--destructive)" : "var(--border)"}>
      <div style={{ position: "relative", width: 150, flexShrink: 0 }}>
        <Thumb src={v.thumb} seed={3} tcLabel={tc(v.duration)} glitch={processing} dim={processing} label={v.category} style={{ width: 150 }} />
        {v.hasReport && (
          <button onClick={(e) => { e.stopPropagation(); onOpen(v.id); }}
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0)", border: "none", cursor: "pointer", color: "#fff", opacity: 0, transition: "opacity 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = "rgba(0,0,0,0.45)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; e.currentTarget.style.background = "rgba(0,0,0,0)"; }}>
            <Icon name="play" size={26} />
          </button>
        )}
        {processing && (
          <span style={{ position: "absolute", top: 4, right: 4, fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "var(--accent)", background: "rgba(0,0,0,0.7)", padding: "1px 5px", animation: "doom-blink 1.2s steps(1) infinite" }}>● 처리중</span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-foreground)", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span>{fmtSize(v.sizeBytes)}</span><span>·</span><span>{tc(v.duration)}</span><span>·</span><span>{v.uploadedAt}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            {v.notified && <span title="텔레그램 알림 전송됨" style={{ color: "var(--accent)", display: "flex" }}><Icon name="send" size={14} /></span>}
            <button title={processing ? "처리 중인 영상은 삭제할 수 없습니다" : "삭제"} disabled={processing}
              onClick={(e) => { e.stopPropagation(); if (!processing) onDelete(v); }}
              style={{ background: "transparent", border: "1px solid var(--border)", color: processing ? "var(--muted-foreground)" : "var(--foreground)",
                padding: 5, cursor: processing ? "not-allowed" : "pointer", opacity: processing ? 0.4 : 1, display: "flex" }}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Tag mono>{v.subtitleSource}</Tag>
          {failed && <Tag color="var(--destructive)" mono>처리 실패</Tag>}
        </div>

        {processing && <StagePips stages={v.stages} />}
        {failed && (
          <div style={{ fontSize: 11.5, color: "var(--destructive)", fontFamily: "var(--font-mono)", borderLeft: "2px solid var(--destructive)", paddingLeft: 8, lineHeight: 1.5 }}>
            ⚠ {v.failNote || "처리 중 오류가 발생했습니다"}
          </div>
        )}
        {!processing && !failed && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: "auto" }}>
            <VerdictBadge verdict={v.verdict} maxSev={v.maxSev} counts={v.counts} />
            {v.hasReport && <Btn size="sm" variant="outline" icon="doc" onClick={() => onOpen(v.id)}>리포트</Btn>}
          </div>
        )}
      </div>
    </Card>
  );
}

export function DashboardScreen({ onOpenReport, onOpenUpload }) {
  const [videos, setVideos] = useState([]);
  const [pending, setPending] = useState(null);
  const [filter, setFilter] = useState("전체");
  const [error, setError] = useState(null);

  async function refresh() {
    try {
      setVideos(await listVideos());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 2000);
    return () => clearInterval(iv);
  }, []);

  const stats = useMemo(() => {
    const s = { total: videos.length, processing: 0, block: 0, review: 0, pass: 0 };
    videos.forEach((v) => {
      if (v.status === "processing") s.processing++;
      if (v.verdict === "block") s.block++;
      else if (v.verdict === "review") s.review++;
      else if (v.verdict === "pass") s.pass++;
    });
    return s;
  }, [videos]);

  const filters = ["전체", "처리중", "방영 불가", "검토 필요", "통과", "실패"];
  const shown = videos.filter((v) => {
    if (filter === "전체") return true;
    if (filter === "처리중") return v.status === "processing";
    if (filter === "실패") return v.status === "failed";
    if (filter === "방영 불가") return v.verdict === "block";
    if (filter === "검토 필요") return v.verdict === "review";
    if (filter === "통과") return v.verdict === "pass";
    return true;
  });

  async function confirmDelete(id) {
    try {
      await deleteVideo(id);
      setPending(null);
      refresh();
    } catch (e) {
      setPending(null);
      alert(e.message);
    }
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 28px 80px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em", textTransform: "uppercase" }}>대시보드</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted-foreground)", fontSize: 13 }}>업로드된 영상의 처리 상태와 검수 결과를 한곳에서 관리합니다.</p>
        </div>
        <Btn size="lg" icon="upload" onClick={onOpenUpload}>영상 업로드</Btn>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", border: "1.5px solid var(--destructive)", color: "var(--destructive)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          ⚠ 서버 연결 실패: {error} — 백엔드(npm run server)가 실행 중인지 확인하세요.
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
        <StatTile label="전체 영상" value={stats.total} color="var(--foreground)" />
        <StatTile label="처리 중" value={stats.processing} color="var(--accent)" sub="병렬 진행" />
        <StatTile label="방영 불가" value={stats.block} color="var(--sev-block)" />
        <StatTile label="검토 필요" value={stats.review} color="var(--sev-review)" />
        <StatTile label="통과" value={stats.pass} color="var(--sev-pass)" />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
        {filters.map((f) => (
          <Btn key={f} size="sm" variant="ghost" active={filter === f} onClick={() => setFilter(f)}>{f}</Btn>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {shown.map((v) => (
          <VideoRow key={v.id} v={v} onOpen={onOpenReport} onDelete={setPending} />
        ))}
        {shown.length === 0 && (
          <div style={{ padding: 60, textAlign: "center", color: "var(--muted-foreground)", border: "1px dashed var(--border)" }}>
            {videos.length === 0 ? "아직 업로드된 영상이 없습니다. 영상을 업로드하면 분석과 검수가 자동으로 시작됩니다." : "해당 조건의 영상이 없습니다."}
          </div>
        )}
      </div>

      <DeleteModal video={pending} onCancel={() => setPending(null)} onConfirm={confirmDelete} />
    </div>
  );
}
