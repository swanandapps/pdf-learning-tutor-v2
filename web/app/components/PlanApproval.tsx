"use client";
import { useState } from "react";
import type { Difficulty, Objective } from "../lib/api";
import { BRAND, DIFFICULTY_COLOR } from "../lib/theme";

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];

// the approval gate: edit / add / remove objectives, then approve to start
export function PlanApproval({
  objectives,
  busy,
  onApprove,
}: {
  objectives: Objective[];
  busy: boolean;
  onApprove: (objectives: Objective[], questionsPerQuiz: number) => void;
}) {
  const [items, setItems] = useState<Objective[]>(objectives);
  const [perQuiz, setPerQuiz] = useState(3);

  function update(id: string, patch: Partial<Objective>) {
    setItems((xs) => xs.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }
  function remove(id: string) {
    setItems((xs) => xs.filter((o) => o.id !== id));
  }
  function add() {
    setItems((xs) => [
      ...xs,
      {
        id: crypto.randomUUID(),
        title: "",
        difficulty: "beginner",
        focus: "",
      },
    ]);
  }

  // drop blank objectives; need at least one
  const valid = items.filter((o) => o.title.trim());
  const canApprove = !busy && valid.length > 0;

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
          Step 1 · Review your lesson plan
        </div>
        <div
          style={{
            fontFamily: BRAND.serif,
            fontSize: 22,
            fontWeight: 600,
            marginTop: 2,
          }}
        >
          Here&apos;s what we&apos;ll cover
        </div>
        <div style={{ color: BRAND.muted, fontSize: 14, marginTop: 4 }}>
          Edit any field, remove objectives, or add your own. Nothing is
          generated until you approve.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((o, i) => (
          <div
            key={o.id}
            style={{
              border: `1px solid ${BRAND.line}`,
              borderRadius: 14,
              padding: 16,
              background: "#fff",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: BRAND.greenSoft,
                color: BRAND.green,
                fontWeight: 700,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {i + 1}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                value={o.title}
                onChange={(e) => update(o.id, { title: e.target.value })}
                placeholder="Objective title…"
                style={{
                  width: "100%",
                  border: "none",
                  outline: "none",
                  fontSize: 16,
                  fontWeight: 600,
                  color: BRAND.text,
                  background: "transparent",
                }}
              />
              <input
                value={o.focus}
                onChange={(e) => update(o.id, { focus: e.target.value })}
                placeholder="What this objective covers (one sentence)…"
                style={{
                  width: "100%",
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  color: BRAND.muted,
                  background: "transparent",
                  marginTop: 4,
                }}
              />
              <select
                value={o.difficulty}
                onChange={(e) =>
                  update(o.id, { difficulty: e.target.value as Difficulty })
                }
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  color: DIFFICULTY_COLOR[o.difficulty] ?? BRAND.muted,
                  border: `1px solid ${BRAND.line}`,
                  borderRadius: 8,
                  padding: "4px 8px",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => remove(o.id)}
              title="Remove objective"
              style={{
                border: `1px solid ${BRAND.line}`,
                background: "#fff",
                color: BRAND.muted,
                borderRadius: 8,
                width: 28,
                height: 28,
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        ))}

        <button
          onClick={add}
          style={{
            border: `1.5px dashed ${BRAND.green}`,
            background: BRAND.greenSoft,
            color: BRAND.green,
            borderRadius: 14,
            padding: "12px 16px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          + Add an objective
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 14,
          color: BRAND.text,
        }}
      >
        <span style={{ fontWeight: 600 }}>Questions per quiz</span>
        <input
          type="number"
          min={1}
          max={10}
          value={perQuiz}
          onChange={(e) =>
            setPerQuiz(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
          }
          style={{
            width: 64,
            border: `1px solid ${BRAND.line}`,
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 14,
            outline: "none",
          }}
        />
      </div>

      <button
        disabled={!canApprove}
        onClick={() => onApprove(valid, perQuiz)}
        style={{
          alignSelf: "flex-start",
          background: canApprove ? BRAND.green : "#D1D5DB",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          padding: "12px 26px",
          fontSize: 15,
          fontWeight: 600,
          cursor: busy ? "wait" : canApprove ? "pointer" : "not-allowed",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Preparing your first quiz…" : "Approve & start learning →"}
      </button>
    </div>
  );
}
