/* ============================================================
   텔레그램 알림 (PRD §4-5) — 토큰 미설정 시 조용히 비활성화
   ============================================================ */
const SEV_LABEL = { pass: "통과", review: "검토 필요", block: "방영 불가" };

export async function notifyDone(video) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const verdict = SEV_LABEL[video.verdict] || video.verdict;
  const text =
    `✅ 처리 완료 · ${video.name}\n` +
    `종합 판정: ${verdict} (S${video.max_sev ?? 0}) · 위반 ${video.block_count} · 검토 ${video.review_count}\n` +
    `길이 ${Math.round(video.duration)}초 · ClipCheck 리포트에서 확인하세요.`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return res.ok;
  } catch (e) {
    console.error("[telegram] 알림 실패:", e.message);
    return false;
  }
}
