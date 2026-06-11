/* ============================================================
   App shell — 사이드바 네비, 라우팅
   ============================================================ */
import { useState } from "react";
import { Btn, Icon } from "./components";
import { DashboardScreen } from "./screens/Dashboard";
import { UploadScreen } from "./screens/Upload";
import { SearchScreen } from "./screens/Search";
import { ReportScreen } from "./screens/Report";

const NAV_ITEMS = [
  { id: "dashboard", name: "대시보드", icon: "grid" },
  { id: "search", name: "아카이브검색", icon: "search" },
];

function Brand({ compact }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 30, height: 30, background: "var(--primary)", color: "var(--primary-foreground)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, fontFamily: "var(--font-mono)", flexShrink: 0, boxShadow: "var(--shadow-sm)" }}>CC</div>
      {!compact && (
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: "0.02em" }}>ClipCheck</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--muted-foreground)", letterSpacing: "0.14em" }}>ARCHIVE · REVIEW</div>
        </div>
      )}
    </div>
  );
}

function NavBtn({ item, active, onClick }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px",
        background: active ? "var(--muted)" : h ? "var(--muted)" : "transparent",
        color: active ? "var(--foreground)" : "var(--muted-foreground)",
        border: "none", borderLeft: `3px solid ${active ? "var(--primary)" : "transparent"}`,
        cursor: "pointer", font: "700 13px var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "left" }}>
      <Icon name={item.icon} size={16} />{item.name}
    </button>
  );
}

export default function App() {
  const [screen, setScreen] = useState({ name: "dashboard" });

  function openReport(id) {
    setScreen({ name: "report", videoId: id });
    window.scrollTo(0, 0);
  }
  function go(name) { setScreen({ name }); window.scrollTo(0, 0); }

  const cur = screen.name;

  return (
    <div style={{ display: "flex", flexDirection: "row", minHeight: "100vh", background: "var(--background)" }}>
      <aside style={{ width: 208, flexShrink: 0, background: "var(--sidebar)", borderRight: "1.5px solid var(--sidebar-border)", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "18px 16px", borderBottom: "1px solid var(--sidebar-border)" }}><Brand /></div>
        <nav style={{ display: "flex", flexDirection: "column", padding: "10px 0", gap: 2 }}>
          {NAV_ITEMS.map((it) => <NavBtn key={it.id} item={it} active={cur === it.id} onClick={() => go(it.id)} />)}
        </nav>
        <div style={{ padding: "10px 14px", marginTop: 8 }}>
          <Btn icon="upload" onClick={() => go("upload")} style={{ width: "100%" }}>업로드</Btn>
        </div>
        <div style={{ marginTop: "auto", padding: 14, borderTop: "1px solid var(--sidebar-border)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
          v1.1 · 방송심의 8종<br />키워드 + 벡터 색인
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0 }}>
        {cur === "dashboard" && <DashboardScreen onOpenReport={openReport} onOpenUpload={() => go("upload")} />}
        {cur === "upload" && <UploadScreen onOpenReport={openReport} onBack={() => go("dashboard")} />}
        {cur === "search" && <SearchScreen onOpenReport={openReport} />}
        {cur === "report" && screen.videoId && <ReportScreen videoId={screen.videoId} onBack={() => go("dashboard")} />}
      </main>
    </div>
  );
}
