"use client";
import type { Result, Summary as SummaryT } from "../lib/api";
import { BRAND } from "../lib/theme";

// end-of-lesson report
export function Summary({
  summary,
  results,
  onRestart,
}: {
  summary: SummaryT;
  results: Result[];
  onRestart: () => void;
}) {
  const byTitle = new Map(results.map((r) => [r.objectiveTitle, r]));
  const totalScore = results.reduce((s, r) => s + r.score, 0);
  const totalQ = results.reduce((s, r) => s + r.total, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: BRAND.green,
          }}
        >
          Lesson complete 🎉
        </div>
        <div
          style={{
            fontFamily: BRAND.serif,
            fontSize: 24,
            fontWeight: 600,
            marginTop: 2,
          }}
        >
          You scored {totalScore}/{totalQ} on the first try
        </div>
        <div style={{ color: BRAND.text, fontSize: 15, marginTop: 8, lineHeight: 1.5 }}>
          {summary.overall}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {summary.perObjective.map((p, i) => {
          const r = byTitle.get(p.title);
          return (
            <div
              key={i}
              style={{
                border: `1px solid ${BRAND.line}`,
                borderRadius: 14,
                padding: 16,
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 16 }}>{p.title}</div>
                {r && (
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: BRAND.green,
                      background: BRAND.greenSoft,
                      padding: "4px 10px",
                      borderRadius: 8,
                      flexShrink: 0,
                    }}
                  >
                    {r.score}/{r.total}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 14, color: BRAND.muted, marginTop: 6, lineHeight: 1.5 }}>
                {p.comment}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          border: `1px solid ${BRAND.line}`,
          borderRadius: 14,
          padding: 16,
          background: BRAND.greenSoft,
        }}
      >
        <div style={{ fontWeight: 700, color: BRAND.greenDark, marginBottom: 8 }}>
          📚 Study tips
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, color: BRAND.text }}>
          {summary.studyTips.map((tip, i) => (
            <li key={i} style={{ marginBottom: 6, lineHeight: 1.5 }}>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onRestart}
        style={{
          alignSelf: "flex-start",
          background: "#fff",
          color: BRAND.green,
          border: `1.5px solid ${BRAND.green}`,
          borderRadius: 12,
          padding: "11px 24px",
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Study another PDF
      </button>
    </div>
  );
}
