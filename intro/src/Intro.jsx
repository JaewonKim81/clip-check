/* ============================================================
   ClipCheck 인트로 — Doom 64 브랜드 무드 (다크 · 레드 · 스캔라인)
   1920x1080 · 30fps · 약 14초
   ============================================================ */
import React from "react";
import {
  AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing,
} from "remotion";
import { loadFont as loadOxanium } from "@remotion/google-fonts/Oxanium";
import { loadFont as loadMono } from "@remotion/google-fonts/SourceCodePro";

const { fontFamily: SANS } = loadOxanium();
const { fontFamily: MONO } = loadMono();

export const FPS = 30;
export const INTRO_DURATION = 414;

/* ---- Doom 64 팔레트 ---- */
const C = {
  bg: "#1d1d1d",
  card: "#2e2e2e",
  border: "#5a5a5a",
  fg: "#e3e3e3",
  muted: "#a8a8a8",
  red: "#e0432f",
  green: "#84b441",
  blue: "#56b6e3",
  orange: "#f08c2e",
  yellow: "#e3c33c",
  gray: "#777777",
};

/* ============ 공통 오버레이 ============ */
const Scanlines = () => (
  <AbsoluteFill style={{
    backgroundImage: "repeating-linear-gradient(0deg, transparent 0, transparent 4px, rgba(0,0,0,0.22) 5px, rgba(0,0,0,0.22) 7px)",
    pointerEvents: "none",
  }} />
);

const Vignette = () => (
  <AbsoluteFill style={{ boxShadow: "inset 0 0 380px rgba(0,0,0,0.75)", pointerEvents: "none" }} />
);

const Flicker = () => {
  const frame = useCurrentFrame();
  const o = 0.04 + 0.025 * Math.sin(frame * 2.1) * Math.sin(frame * 0.73);
  return <AbsoluteFill style={{ background: `rgba(255,255,255,${Math.max(0, o)})`, mixBlendMode: "overlay", pointerEvents: "none" }} />;
};

/* 타자기 텍스트 */
function typed(text, frame, start, speed = 2) {
  const n = Math.max(0, Math.floor((frame - start) / speed));
  return text.slice(0, n);
}

function SectionTag({ children, color = C.red, style }) {
  return (
    <div style={{
      fontFamily: MONO, fontSize: 26, fontWeight: 700, letterSpacing: "0.3em",
      color, border: `2px solid ${color}`, padding: "10px 22px", display: "inline-block",
      textTransform: "uppercase", ...style,
    }}>{children}</div>
  );
}

/* ============ Scene 1 — 로고 리빌 (0~96) ============ */
const SceneLogo = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stamp = spring({ frame, fps, config: { damping: 11, stiffness: 160, mass: 0.8 } });
  const name = typed("ClipCheck", frame, 18, 3);
  const cursorOn = frame % 16 < 8 && frame < 70;
  const subOp = interpolate(frame, [52, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subTrack = interpolate(frame, [52, 80], [0.9, 0.42], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
        <div style={{
          width: 170, height: 170, background: C.red, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: MONO, fontWeight: 800, fontSize: 84,
          transform: `scale(${stamp}) rotate(${(1 - stamp) * -12}deg)`,
          boxShadow: "14px 14px 0 rgba(0,0,0,0.65)",
        }}>CC</div>
        <div>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 130, color: C.fg, lineHeight: 1 }}>
            {name}
            <span style={{ opacity: cursorOn ? 1 : 0, color: C.red }}>▌</span>
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 34, color: C.muted, marginTop: 18,
            letterSpacing: `${subTrack}em`, opacity: subOp, textTransform: "uppercase",
          }}>Archive · Review</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ============ Scene 2 — 병렬 파이프라인 (96~192) ============ */
const LANES = [
  { label: "LANE 1 · 자막", color: C.blue, stages: ["자막 추출", "자막 교정"] },
  { label: "LANE 2 · 분석", color: C.green, stages: ["장면 분석", "기술 검토", "색인 생성"] },
  { label: "LANE 3 · 검수", color: C.red, stages: ["프레임 샘플링", "금칙 판정", "종합 판정"] },
];

const StageChip = ({ name, color, start }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - start, fps, config: { damping: 13, stiffness: 170 } });
  const pct = interpolate(frame, [start + 4, start + 34], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const done = pct >= 100;
  return (
    <div style={{
      background: C.card, border: `2px solid ${done ? color : C.border}`,
      borderLeft: `8px solid ${color}`, padding: "16px 22px", width: 300,
      transform: `scale(${Math.max(0.0001, pop)})`, opacity: pop,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, color: C.fg }}>{name}</span>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 24, color }}>
          {done ? "✓" : `${Math.floor(pct)}%`}
        </span>
      </div>
      <div style={{ height: 10, background: "#222", border: `1px solid ${C.border}` }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
};

const ScenePipeline = () => {
  const frame = useCurrentFrame();
  const titleOp = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center", gap: 50 }}>
      <div style={{ opacity: titleOp, textAlign: "center" }}>
        <SectionTag color={C.blue}>Parallel Pipeline</SectionTag>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 64, color: C.fg, marginTop: 22 }}>
          업로드 한 번으로, <span style={{ color: C.blue }}>8단계 병렬 처리</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {LANES.map((lane, li) => (
          <div key={lane.label} style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{
              fontFamily: MONO, fontSize: 20, color: C.muted, width: 200,
              letterSpacing: "0.15em", textAlign: "right",
            }}>{lane.label}</div>
            {lane.stages.map((s, si) => (
              <React.Fragment key={s}>
                {si > 0 && <div style={{ fontFamily: MONO, fontSize: 30, color: C.muted }}>▶</div>}
                <StageChip name={s} color={lane.color} start={10 + li * 6 + si * 16} />
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* ============ Scene 3 — 금칙 판정 (192~288) ============ */
const SEGMENTS = [
  { w: 14, color: C.green }, { w: 5, color: C.gray }, { w: 16, color: C.green },
  { w: 4, color: C.red }, { w: 18, color: C.green }, { w: 4, color: "#161616" },
  { w: 12, color: C.green }, { w: 5, color: C.yellow }, { w: 14, color: C.green },
  { w: 4, color: C.red }, { w: 4, color: C.green },
];

const Marker = ({ left, color, start }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drop = spring({ frame: frame - start, fps, config: { damping: 10, stiffness: 200 } });
  return (
    <div style={{
      position: "absolute", left: `${left}%`, top: -38,
      transform: `translateY(${(1 - drop) * -60}px)`, opacity: drop,
      width: 0, height: 0,
      borderLeft: "16px solid transparent", borderRight: "16px solid transparent",
      borderTop: `26px solid ${color}`,
    }} />
  );
};

const Chip = ({ label, score, color, start }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - start, fps, config: { damping: 12, stiffness: 180 } });
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, color,
      border: `3px solid ${color}`, padding: "12px 26px",
      fontFamily: MONO, fontWeight: 700, fontSize: 34, textTransform: "uppercase",
      transform: `scale(${Math.max(0.0001, pop)})`,
      background: "rgba(0,0,0,0.35)",
    }}>
      <span style={{ width: 18, height: 18, background: color, display: "inline-block" }} />
      {label} · {score}
    </div>
  );
};

const SceneJudge = () => {
  const frame = useCurrentFrame();
  const titleOp = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const grow = interpolate(frame, [8, 44], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center", gap: 70 }}>
      <div style={{ opacity: titleOp, textAlign: "center" }}>
        <SectionTag color={C.red}>Broadcast Review</SectionTag>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 64, color: C.fg, marginTop: 22 }}>
          1초 간격 · 연속 3프레임 <span style={{ color: C.red }}>금칙 판정</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 28, color: C.muted, marginTop: 14 }}>
          짧은 장면도 놓치지 않습니다 — 대사·소리까지 판단 근거로
        </div>
      </div>

      <div style={{ width: 1380, position: "relative" }}>
        <Marker left={37} color={C.red} start={48} />
        <Marker left={62} color={C.yellow} start={56} />
        <Marker left={87} color={C.red} start={64} />
        <div style={{
          height: 64, border: `3px solid ${C.border}`, display: "flex",
          overflow: "hidden", width: `${grow}%`, background: "#161616",
        }}>
          {SEGMENTS.map((s, i) => (
            <div key={i} style={{ width: `${s.w}%`, background: s.color, borderRight: "2px solid rgba(0,0,0,0.4)" }} />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 36 }}>
        <Chip label="통과" score="S0" color={C.green} start={58} />
        <Chip label="검토 필요" score="S3" color={C.yellow} start={66} />
        <Chip label="방영 불가" score="S4" color={C.red} start={74} />
      </div>
    </AbsoluteFill>
  );
};

/* ============ Scene 4 — 자연어 검색 (288~348) ============ */
const SceneSearch = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const q = typed("뺨 때리는 장면", frame, 10, 3);
  const cardUp = spring({ frame: frame - 34, fps, config: { damping: 14, stiffness: 130 } });
  const titleOp = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center", gap: 48 }}>
      <div style={{ opacity: titleOp, textAlign: "center" }}>
        <SectionTag color={C.green}>Natural Language Search</SectionTag>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 64, color: C.fg, marginTop: 22 }}>
          말하듯 검색하면, <span style={{ color: C.green }}>장면이 나온다</span>
        </div>
      </div>

      <div style={{ display: "flex", width: 1100, border: `3px solid ${C.border}` }}>
        <div style={{
          flex: 1, background: C.card, padding: "26px 34px",
          fontFamily: SANS, fontSize: 42, color: C.fg, display: "flex", alignItems: "center", gap: 20,
        }}>
          <span style={{ color: C.muted, fontSize: 38 }}>⌕</span>
          {q}<span style={{ opacity: frame % 14 < 7 ? 1 : 0, color: C.green }}>▌</span>
        </div>
        <div style={{
          background: C.red, color: "#fff", fontFamily: SANS, fontWeight: 800,
          fontSize: 36, display: "flex", alignItems: "center", padding: "0 46px", textTransform: "uppercase",
        }}>검색</div>
      </div>

      <div style={{
        display: "flex", gap: 30, width: 1100, background: C.card,
        border: `2px solid ${C.border}`, padding: 24,
        transform: `translateY(${(1 - cardUp) * 120}px)`, opacity: cardUp,
      }}>
        <div style={{
          width: 320, height: 180, position: "relative", overflow: "hidden",
          background: "linear-gradient(125deg, #5a2a26, #2a1a3a)", border: `1px solid ${C.border}`,
        }}>
          <div style={{ position: "absolute", left: "22%", bottom: 0, width: "30%", height: "62%", background: "#7a4038" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(0,0,0,0.25) 4px, rgba(0,0,0,0.25) 5px)" }} />
          <span style={{
            position: "absolute", left: 10, bottom: 10, fontFamily: MONO, fontSize: 20,
            background: "rgba(0,0,0,0.75)", color: "#fff", padding: "2px 10px",
          }}>00:00:47:04</span>
          <span style={{
            position: "absolute", top: 10, right: 10, fontFamily: MONO, fontSize: 18, fontWeight: 700,
            color: C.blue, border: `2px solid ${C.blue}`, padding: "2px 10px",
          }}>BOTH</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: C.fg }}>뉴스데스크_0610_본방.mp4</div>
          <div style={{ fontFamily: SANS, fontSize: 28, color: C.muted, marginTop: 14, lineHeight: 1.5 }}>
            한 인물이 다른 인물의 뺨을 가격하는 장면
          </div>
          <div style={{ fontFamily: MONO, fontSize: 22, color: C.muted, marginTop: 16 }}>
            <span style={{ color: C.green }}>이유</span> 키워드 일치 + 장면 설명 벡터 유사도 0.91
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ============ Scene 5 — 아웃트로 (348~414) ============ */
const SceneOutro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stamp = spring({ frame, fps, config: { damping: 12, stiffness: 150 } });
  const tagOp = interpolate(frame, [20, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [56, 66], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center", opacity: fadeOut }}>
      <div style={{ display: "flex", alignItems: "center", gap: 36, transform: `scale(${stamp})` }}>
        <div style={{
          width: 120, height: 120, background: C.red, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: MONO, fontWeight: 800, fontSize: 58,
          boxShadow: "10px 10px 0 rgba(0,0,0,0.65)",
        }}>CC</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 96, color: C.fg }}>ClipCheck</div>
      </div>
      <div style={{
        fontFamily: SANS, fontWeight: 600, fontSize: 44, color: C.fg, marginTop: 46, opacity: tagOp,
      }}>
        영상을 올리면, <span style={{ color: C.red, fontWeight: 800 }}>검수까지 한 번에.</span>
      </div>
      <div style={{
        fontFamily: MONO, fontSize: 24, color: C.muted, marginTop: 22,
        letterSpacing: "0.25em", opacity: tagOp, textTransform: "uppercase",
      }}>Archive · Search · Review</div>
    </AbsoluteFill>
  );
};

/* ============ 메인 컴포지션 ============ */
export const Intro = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Sequence from={0} durationInFrames={96}><SceneLogo /></Sequence>
    <Sequence from={96} durationInFrames={96}><ScenePipeline /></Sequence>
    <Sequence from={192} durationInFrames={96}><SceneJudge /></Sequence>
    <Sequence from={288} durationInFrames={60}><SceneSearch /></Sequence>
    <Sequence from={348} durationInFrames={66}><SceneOutro /></Sequence>
    <Scanlines />
    <Flicker />
    <Vignette />
  </AbsoluteFill>
);
