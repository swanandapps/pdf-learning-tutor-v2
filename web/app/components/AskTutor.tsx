"use client";
import { useState } from "react";
import { api } from "../lib/api";
import { BRAND } from "../lib/theme";

// ask the tutor for a hint — the server keeps it from giving away the answer
export function AskTutor({ lessonId }: { lessonId: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [thread, setThread] = useState<{ q: string; a: string }[]>([]);
  const [loading, setLoading] = useState(false);

  async function ask() {
    const question = q.trim();
    if (!question || loading) return;
    setLoading(true);
    setQ("");
    try {
      const { answer } = await api.ask(lessonId, question);
      setThread((t) => [...t, { q: question, a: answer }]);
    } catch {
      setThread((t) => [
        ...t,
        { q: question, a: "Sorry — I couldn't answer that right now." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        border: `1px dashed ${BRAND.line}`,
        borderRadius: 14,
        padding: 14,
        background: BRAND.card,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "none",
          border: "none",
          color: BRAND.green,
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
          padding: 0,
        }}
      >
        {open ? "▾" : "▸"} Stuck? Ask the tutor for a hint
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {thread.map((m, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.text }}>
                You: {m.q}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: BRAND.text,
                  background: "#fff",
                  border: `1px solid ${BRAND.line}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  marginTop: 4,
                  lineHeight: 1.5,
                }}
              >
                {m.a}
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="e.g. Can you explain this concept more simply?"
              style={{
                flex: 1,
                border: `1px solid ${BRAND.line}`,
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              onClick={ask}
              disabled={loading}
              style={{
                background: BRAND.green,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "…" : "Ask"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
