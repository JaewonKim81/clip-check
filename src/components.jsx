/* ============================================================
   Shared UI primitives for the Doom 64 broadcast-review app.
   ============================================================ */
import { useState, useMemo } from "react";

/* ---------------- Icons (simple stroke set) ---------------- */
export function Icon({ name, size = 18, stroke = 2, style }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "square", strokeLinejoin: "miter" };
  const paths = {
    grid:    <g {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></g>,
    upload:  <g {...p}><path d="M12 16V4"/><path d="M6 9l6-6 6 6"/><path d="M3 20h18"/></g>,
    search:  <g {...p}><circle cx="10.5" cy="10.5" r="6.5"/><path d="M21 21l-5.5-5.5"/></g>,
    film:    <g {...p}><rect x="3" y="4" width="18" height="16"/><path d="M3 9h18M3 15h18M9 4v16M15 4v16"/></g>,
    bell:    <g {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 7 2 7H4s2-2 2-7Z"/><path d="M10 20a2 2 0 0 0 4 0"/></g>,
    trash:   <g {...p}><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15"/></g>,
    alert:   <g {...p}><path d="M12 3 2 21h20L12 3Z"/><path d="M12 10v5M12 18h.01"/></g>,
    check:   <g {...p}><path d="M4 12l5 6L20 5"/></g>,
    x:       <g {...p}><path d="M5 5l14 14M19 5L5 19"/></g>,
    play:    <g {...p}><path d="M6 4l14 8-14 8V4Z"/></g>,
    pause:   <g {...p}><path d="M7 4v16M17 4v16"/></g>,
    chevR:   <g {...p}><path d="M9 5l7 7-7 7"/></g>,
    chevL:   <g {...p}><path d="M15 5l-7 7 7 7"/></g>,
    chevD:   <g {...p}><path d="M5 9l7 7 7-7"/></g>,
    plus:    <g {...p}><path d="M12 5v14M5 12h14"/></g>,
    clock:   <g {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></g>,
    cpu:     <g {...p}><rect x="6" y="6" width="12" height="12"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></g>,
    layers:  <g {...p}><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 12l10 5 10-5M2 17l10 5 10-5"/></g>,
    doc:     <g {...p}><path d="M6 2h9l5 5v15H6V2Z"/><path d="M14 2v6h6"/></g>,
    waveform:<g {...p}><path d="M3 12h2l2-6 3 14 3-18 3 12 2-2h3"/></g>,
    eye:     <g {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></g>,
    type:    <g {...p}><path d="M4 6V4h16v2M12 4v16M8 20h8"/></g>,
    filter:  <g {...p}><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/></g>,
    send:    <g {...p}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></g>,
    refresh: <g {...p}><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></g>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0, ...style }}>
      {paths[name] || null}
    </svg>
  );
}

/* ---------------- Abstract video-frame block ----------------
   Renders a deterministic "scene thumbnail" from a seed + optional
   category hue. Striped/gradient with scanlines + timecode chip.
   Swap for real frame images when the pipeline produces them.    */
export function rng(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

export function FrameBlock({ seed = 1, hue = null, tcLabel, ratio = "16/9", dim = false, label, glitch = false, style }) {
  const r = useMemo(() => { const g = rng(seed + 1); return { a: g(), b: g(), c: g(), d: g() }; }, [seed]);
  const baseHue = hue != null ? hue : Math.floor(r.a * 360);
  const h2 = (baseHue + 30 + r.b * 60) % 360;
  const l1 = dim ? 22 : 30 + r.c * 18;
  const l2 = dim ? 12 : 16 + r.d * 14;
  const sat = hue != null ? 32 : 14;
  const angle = Math.floor(r.b * 180);
  return (
    <div style={{
      position: "relative", aspectRatio: ratio, width: "100%", overflow: "hidden",
      background: `linear-gradient(${angle}deg, hsl(${baseHue} ${sat}% ${l1}%), hsl(${h2} ${sat}% ${l2}%))`,
      border: "1px solid var(--border)", ...style,
    }}>
      {/* horizon band */}
      <div style={{ position: "absolute", left: 0, right: 0, top: `${30 + r.c * 30}%`, height: `${10 + r.d * 18}%`,
        background: `hsl(${baseHue} ${sat + 8}% ${l1 + 10}% / 0.5)` }}></div>
      {/* subject block */}
      <div style={{ position: "absolute", left: `${15 + r.a * 30}%`, bottom: 0, width: `${20 + r.b * 22}%`, height: `${35 + r.c * 35}%`,
        background: `hsl(${h2} ${sat + 6}% ${l2 + 6}%)` }}></div>
      {/* scanlines */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)", pointerEvents: "none",
        animation: glitch ? "doom-scan 0.6s steps(4) infinite" : "none" }}></div>
      {/* vignette */}
      <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 40px rgba(0,0,0,0.5)", pointerEvents: "none" }}></div>
      {tcLabel && (
        <span style={{ position: "absolute", left: 4, bottom: 4, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
          background: "rgba(0,0,0,0.7)", color: "#fff", padding: "1px 4px", letterSpacing: "0.02em" }}>{tcLabel}</span>
      )}
      {label && (
        <span style={{ position: "absolute", left: 4, top: 4, fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, textTransform: "uppercase",
          background: "rgba(0,0,0,0.55)", color: "#fff", padding: "1px 4px", letterSpacing: "0.08em" }}>{label}</span>
      )}
    </div>
  );
}

/* ---------------- 실제 프레임 이미지 썸네일 (없으면 FrameBlock 폴백) ---------------- */
export function Thumb({ src, seed = 1, hue = null, tcLabel, ratio = "16/9", dim, label, glitch, style }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return <FrameBlock seed={seed} hue={hue} tcLabel={tcLabel} ratio={ratio} dim={dim} label={label} glitch={glitch} style={style} />;
  }
  return (
    <div style={{ position: "relative", aspectRatio: ratio, width: "100%", overflow: "hidden", background: "#000", border: "1px solid var(--border)", ...style }}>
      <img src={src} alt="" onError={() => setError(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: dim ? "brightness(0.55)" : "none" }} />
      {glitch && (
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)", pointerEvents: "none", animation: "doom-scan 0.6s steps(4) infinite" }}></div>
      )}
      {tcLabel && (
        <span style={{ position: "absolute", left: 4, bottom: 4, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
          background: "rgba(0,0,0,0.7)", color: "#fff", padding: "1px 4px", letterSpacing: "0.02em" }}>{tcLabel}</span>
      )}
      {label && (
        <span style={{ position: "absolute", left: 4, top: 4, fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, textTransform: "uppercase",
          background: "rgba(0,0,0,0.55)", color: "#fff", padding: "1px 4px", letterSpacing: "0.08em" }}>{label}</span>
      )}
    </div>
  );
}

/* ---------------- severity helpers ---------------- */
const SEV_VAR = { pass: "--sev-pass", caution: "--sev-caution", warn: "--sev-warn", block: "--sev-block", review: "--sev-review" };
export const SEV_LABEL = { pass: "통과", caution: "주의", warn: "경고", block: "방영 불가", review: "검토 필요" };
export function sevColor(band) { return `var(${SEV_VAR[band] || "--muted-foreground"})`; }

export function SeverityChip({ band, score, small }) {
  const c = sevColor(band);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-mono)",
      fontSize: small ? 10 : 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap",
      color: c, border: `1.5px solid ${c}`, padding: small ? "1px 5px" : "2px 7px", lineHeight: 1.3,
    }}>
      <span style={{ width: 7, height: 7, background: c, display: "inline-block" }}></span>
      {SEV_LABEL[band]}{score != null ? ` · ${score}` : ""}
    </span>
  );
}

export function SourceBadge({ source }) {
  const map = { both: { t: "BOTH", c: "var(--accent)" }, keyword: { t: "KEYWORD", c: "var(--secondary)" }, vector: { t: "VECTOR", c: "var(--chart-5)" } };
  const m = map[source] || map.both;
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: m.c, border: `1px solid ${m.c}`, padding: "1px 5px" }}>{m.t}</span>;
}

/* ---------------- Button ---------------- */
export function Btn({ children, variant = "default", size = "md", icon, onClick, disabled, active, style, title, type = "button" }) {
  const [hover, setHover] = useState(false);
  const sizes = { sm: { p: "5px 9px", fs: 12, h: 28 }, md: { p: "8px 14px", fs: 13, h: 36 }, lg: { p: "11px 18px", fs: 14, h: 44 } };
  const s = sizes[size];
  const variants = {
    default: { bg: "var(--primary)", fg: "var(--primary-foreground)", bd: "var(--primary)" },
    secondary: { bg: "var(--secondary)", fg: "var(--secondary-foreground)", bd: "var(--secondary)" },
    ghost: { bg: active ? "var(--muted)" : "transparent", fg: "var(--foreground)", bd: "transparent" },
    outline: { bg: active ? "var(--muted)" : "transparent", fg: "var(--foreground)", bd: "var(--border)" },
    destructive: { bg: "var(--destructive)", fg: "var(--destructive-foreground)", bd: "var(--destructive)" },
  };
  const v = variants[variant] || variants.default;
  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
        font: `700 ${s.fs}px var(--font-sans)`, letterSpacing: "0.02em", textTransform: "uppercase", whiteSpace: "nowrap",
        padding: s.p, minHeight: s.h, cursor: disabled ? "not-allowed" : "pointer",
        background: v.bg, color: v.fg, border: `1.5px solid ${v.bd}`, borderRadius: 0,
        opacity: disabled ? 0.4 : 1, transition: "transform 0.08s, box-shadow 0.08s, background 0.12s",
        boxShadow: hover && !disabled && variant !== "ghost" ? "var(--shadow)" : "none",
        transform: hover && !disabled && variant !== "ghost" ? "translate(-1px,-1px)" : "none",
        ...style,
      }}>
      {icon && <Icon name={icon} size={s.fs + 3} />}
      {children}
    </button>
  );
}

/* ---------------- Card ---------------- */
export function Card({ children, style, hover, onClick, accent }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 0,
        borderTop: accent ? `3px solid ${accent}` : "1.5px solid var(--border)",
        cursor: onClick ? "pointer" : "default",
        boxShadow: hover && h ? "var(--shadow-md)" : "none",
        transform: hover && h ? "translate(-2px,-2px)" : "none",
        transition: "transform 0.1s, box-shadow 0.1s",
        ...style,
      }}>
      {children}
    </div>
  );
}

/* ---------------- Progress bar ---------------- */
export function Progress({ value, color = "var(--primary)", height = 8, indeterminate, failed }) {
  return (
    <div style={{ position: "relative", height, background: "var(--muted)", border: "1px solid var(--border)", overflow: "hidden" }}>
      {failed ? (
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(45deg, var(--destructive) 0 6px, transparent 6px 12px)", opacity: 0.6 }}></div>
      ) : indeterminate ? (
        <div style={{ position: "absolute", top: 0, bottom: 0, width: "25%", background: color, animation: "doom-indeterminate 1.1s linear infinite" }}></div>
      ) : (
        <div style={{ height: "100%", width: `${value}%`, background: color, transition: "width 0.4s ease" }}></div>
      )}
    </div>
  );
}

/* ---------------- Tag / pill ---------------- */
export function Tag({ children, color, mono }) {
  return <span style={{ fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)", fontSize: 11, fontWeight: 600, color: color || "var(--muted-foreground)", border: `1px solid ${color || "var(--border)"}`, padding: "1px 6px", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{children}</span>;
}

/* ---------------- 삭제 확인 모달 (PRD §4-6) ---------------- */
export function DeleteModal({ video, onConfirm, onCancel }) {
  if (!video) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "doom-fade-up 0.15s ease" }}
      onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--card)", border: "1.5px solid var(--border)", borderTop: "3px solid var(--destructive)", maxWidth: 460, width: "100%", boxShadow: "var(--shadow-xl)" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--destructive)" }}><Icon name="alert" size={22} /></span>
          <span style={{ fontWeight: 800, fontSize: 17, textTransform: "uppercase", letterSpacing: "0.03em" }}>영상 삭제</span>
        </div>
        <div style={{ padding: 20, fontSize: 13.5, lineHeight: 1.7, color: "var(--card-foreground)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>{video.name}</div>
          이 영상을 삭제하면 <strong style={{ color: "var(--destructive)" }}>원본 영상 · 리포트 · 검색 색인 · 프레임 이미지</strong>가 모두 함께 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
        </div>
        <div style={{ padding: "0 20px 20px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="outline" onClick={onCancel}>취소</Btn>
          <Btn variant="destructive" icon="trash" onClick={() => onConfirm(video.id)}>모두 삭제</Btn>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Section label ---------------- */
export function SectionLabel({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{children}</span>
      {right}
    </div>
  );
}
