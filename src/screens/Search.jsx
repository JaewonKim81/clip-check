/* ============================================================
   아카이브검색 — 4종 모드 (hybrid / keyword / vector / filter)
   결과: 장면 썸네일 + 타임코드 + 출처 + 이유
   ============================================================ */
import { useState } from "react";
import { searchApi } from "../api";
import { tc } from "../meta";
import { Btn, Card, Icon, SourceBadge, Thumb } from "../components";

const MODES = [
  { id: "hybrid",  name: "하이브리드", desc: "키워드 + 의미 점수 합산", icon: "layers", tag: "기본값" },
  { id: "keyword", name: "키워드",     desc: "정확한 단어 매칭",       icon: "type" },
  { id: "vector",  name: "벡터",       desc: "의미가 비슷한 내용",     icon: "eye" },
  { id: "filter",  name: "필터",       desc: "카테고리 · 판정 조건",   icon: "filter" },
];

function ModeTab({ m, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, minWidth: 140, textAlign: "left", padding: "12px 14px", cursor: "pointer",
      background: active ? "var(--card)" : "transparent",
      border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
      borderBottom: active ? "1.5px solid var(--card)" : "1.5px solid var(--border)",
      color: "var(--foreground)", transition: "all 0.12s", position: "relative", top: active ? 1 : 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
        <span style={{ color: active ? "var(--primary)" : "var(--muted-foreground)", display: "flex" }}><Icon name={m.icon} size={15} /></span>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{m.name}</span>
        {m.tag && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--secondary)", border: "1px solid var(--secondary)", padding: "0 4px" }}>{m.tag}</span>}
      </div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{m.desc}</div>
    </button>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--foreground)", border: "1px solid var(--border)", padding: "5px 9px", background: "var(--background)" }}>
      {label}:
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ background: "var(--background)", color: "var(--foreground)", border: "none", outline: "none", font: "600 11px var(--font-mono)" }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function ResultCard({ r, mode, onOpen }) {
  const showScore = mode !== "filter";
  return (
    <Card hover onClick={() => onOpen(r.videoId)} style={{ display: "flex", gap: 14, padding: 12 }}>
      <div style={{ width: 168, flexShrink: 0, position: "relative" }}>
        <Thumb src={r.thumb} seed={7} tcLabel={tc(r.t)} />
        <span style={{ position: "absolute", top: 4, right: 4 }}><SourceBadge source={r.source} /></span>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.videoName}</span>
          {showScore && <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{Math.min(0.99, r.score).toFixed(2)}</span>}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-foreground)" }}>@ {tc(r.t)}</div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{r.snippet}</div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-start", gap: 7, fontSize: 11.5, color: "var(--muted-foreground)", borderTop: "1px solid var(--border)", paddingTop: 7 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted-foreground)", border: "1px solid var(--border)", padding: "0 4px", whiteSpace: "nowrap" }}>이유</span>
          <span style={{ lineHeight: 1.5 }}>{r.reason}</span>
        </div>
      </div>
    </Card>
  );
}

export function SearchScreen({ onOpenReport }) {
  const [mode, setMode] = useState("hybrid");
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [results, setResults] = useState(null); // null = 검색 전
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState("전체");
  const [verdict, setVerdict] = useState("전체");

  async function doSearch(nextMode = mode) {
    setLoading(true);
    setError(null);
    setSubmitted(q);
    try {
      setResults(await searchApi({
        q, mode: nextMode,
        category: nextMode === "filter" ? category : undefined,
        verdict: nextMode === "filter" ? verdict : undefined,
      }));
    } catch (e) {
      setError(e.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 28px 80px" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 800, textTransform: "uppercase" }}>아카이브검색</h1>
      <p style={{ margin: "0 0 22px", color: "var(--muted-foreground)", fontSize: 13 }}>자연어로 영상 속 장면을 검색합니다. 각 결과에 장면 썸네일 · 출처 · 이유가 함께 표시됩니다.</p>

      <form onSubmit={(e) => { e.preventDefault(); doSearch(); }}
        style={{ display: "flex", gap: 0, marginBottom: 4 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "var(--card)", border: "1.5px solid var(--border)", borderRight: "none", padding: "0 14px" }}>
          <span style={{ color: "var(--muted-foreground)", display: "flex" }}><Icon name="search" size={18} /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 뺨 때리는 장면, 로고 노출, 요리하는 장면…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--foreground)", font: "500 14px var(--font-sans)", padding: "13px 0" }} />
          {mode !== "filter" && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted-foreground)", border: "1px solid var(--border)", padding: "1px 5px", textTransform: "uppercase" }}>{mode}</span>}
        </div>
        <Btn type="submit" size="lg" icon="search" style={{ minWidth: 110 }} disabled={loading}>{loading ? "검색 중…" : "검색"}</Btn>
      </form>

      <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
        {MODES.map((m) => <ModeTab key={m.id} m={m} active={mode === m.id} onClick={() => { setMode(m.id); if (results != null || m.id === "filter") doSearch(m.id); }} />)}
      </div>

      <div style={{ border: "1.5px solid var(--border)", borderTop: "none", padding: 18, background: "var(--card)" }}>
        {mode === "filter" && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
            <FilterSelect label="카테고리" value={category} onChange={(v) => setCategory(v)}
              options={["전체", "보도", "예능", "드라마", "교양", "광고", "스포츠", "미분류"].map((v) => ({ value: v, label: v }))} />
            <FilterSelect label="판정" value={verdict} onChange={(v) => setVerdict(v)}
              options={[{ value: "전체", label: "전체" }, { value: "block", label: "방영 불가" }, { value: "review", label: "검토 필요" }, { value: "pass", label: "통과" }]} />
            <Btn size="sm" variant="outline" icon="filter" onClick={() => doSearch("filter")}>조건 적용</Btn>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 12, padding: "8px 12px", border: "1px solid var(--destructive)", color: "var(--destructive)", fontFamily: "var(--font-mono)", fontSize: 11.5 }}>⚠ {error}</div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-foreground)", letterSpacing: "0.06em" }}>
            {results == null ? "검색어를 입력하세요" : `결과 ${results.length}건${submitted ? ` · "${submitted}"` : ""}`}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted-foreground)" }}>2개 저장소 병행 (키워드 + 벡터)</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {(results || []).map((r, i) => <ResultCard key={i} r={r} mode={mode} onOpen={onOpenReport} />)}
          {results != null && results.length === 0 && !error && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--muted-foreground)", border: "1px dashed var(--border)" }}>검색 결과가 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}
